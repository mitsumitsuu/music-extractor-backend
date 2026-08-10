from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import hashlib
import re
import json
import urllib.parse
import datetime
import uuid
import base64
from io import BytesIO
from googleapiclient.discovery import build
import google.generativeai as genai
import yt_dlp

DEFAULT_KEYWORDS = "初音ミク, 鏡音リン, 鏡音レン, 巡音ルカ, MEIKO, KAITO, 星界, 可不, 重音テト, 花隈千冬, 夏色花梨, 小春六花, GUMI, 音街ウナ"
DEFAULT_NG_WORDS = "アルバム, クロスフェード, 配信, BOOTH, Tracklist, 参加, 収録, 歌ってみた"

app = FastAPI(title="楽曲抽出システム Backend API", version="7.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://music-extractor-frontend.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db():
    conn = sqlite3.connect('app_data.db', check_same_thread=False)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, email TEXT, language TEXT, login_notify BOOLEAN DEFAULT 1, update_notify BOOLEAN DEFAULT 1)''')
    c.execute('''CREATE TABLE IF NOT EXISTS presets (username TEXT, preset_id INTEGER, data TEXT, PRIMARY KEY(username, preset_id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS usage_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, timestamp DATETIME, mode TEXT, source TEXT, count INTEGER)''')
    c.execute('''CREATE TABLE IF NOT EXISTS password_resets (token TEXT PRIMARY KEY, email TEXT, expiry DATETIME)''')
    conn.commit()
    conn.close()

init_db()

def get_db():
    conn = sqlite3.connect('app_data.db', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def validate_password(pwd: str):
    if len(pwd) < 8: return False, "パスワードは8文字以上にしてください。"
    if not re.search(r'[A-Z]', pwd): return False, "大文字の英字(A-Z)を1文字以上含めてください。"
    if not re.search(r'[a-z]', pwd): return False, "小文字の英字(a-z)を1文字以上含めてください。"
    if not re.search(r'\d', pwd): return False, "数字(0-9)を1文字以上含めてください。"
    return True, ""

def log_usage(db: sqlite3.Connection, username: str, mode: str, source: str, count: int):
    uname = username if username else "guest"
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        db.execute("INSERT INTO usage_logs (username, timestamp, mode, source, count) VALUES (?, ?, ?, ?, ?)", 
                   (uname, now_str, mode, str(source)[:100], count))
        db.commit()
    except Exception:
        pass

def parse_flexible_input(text: str) -> List[str]:
    if not text: return []
    return [w.strip() for w in re.split(r'[,\n\s、]+', text) if w.strip()]

def clean_title(raw_title: str) -> str:
    title = str(raw_title)
    title = re.split(r'\s*[/／]\s*', title)[0]
    title = re.sub(r'\s+[^\s]*P\b', '', title, flags=re.IGNORECASE)
    title = re.sub(r"(?i)[\(（\[【].*?(remix|bootleg|edit|mashup|flip|vip|cover|feat\.|long ver|short ver|MV|PV).*?[\)）\]】]", "", title)
    title = re.sub(r"【.*?】|\[.*?\]", "", title)
    title = re.split(r"(?i)\s+feat\.\s+|\s+ft\.\s+", title)[0]
    return title.strip()

def extract_vocals_manual(title: str, description: str, keywords: List[str], ng_list: List[str]) -> str:
    found = set()
    title_str = str(title) if title else ""
    desc_str = str(description) if description else ""
    for kw in keywords:
        if kw in title_str: found.add(kw)
    if not any(ng in desc_str for ng in ng_list):
        for kw in keywords:
            if kw in desc_str: found.add(kw)
    return " / ".join(list(found))

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str

class ForgotRequest(BaseModel):
    email: str

class ExtractUrlRequest(BaseModel):
    username: Optional[str] = None
    url: str = ""
    pasted_text: str = ""
    file_data: str = ""
    file_name: str = ""
    mode: str
    title_mode: str = "✨ スッキリ出力"
    yt_key: str = ""
    gemini_key: str = ""
    exclude_words: str = ""
    target_vocal: str = ""
    target_producer: str = ""
    target_bpm: int = 0
    target_key: str = ""
    theme: str = ""
    require_mmd: bool = False
    multi_only: bool = False
    min_v: int = 0
    max_v: int = 0
    min_c: int = 0
    max_c: int = 0
    add_lyrics: bool = True
    add_analysis: bool = False
    add_bpm: bool = True

@app.post("/api/auth/login")
def login(req: LoginRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.execute("SELECT username FROM users WHERE username=? AND password=?", (req.username, hash_password(req.password)))
    user = cursor.fetchone()
    if user: return {"status": "success", "username": user["username"]}
    raise HTTPException(status_code=401, detail="ユーザー名またはパスワードが違います。")

@app.post("/api/auth/register")
def register(req: RegisterRequest, db: sqlite3.Connection = Depends(get_db)):
    is_valid, msg = validate_password(req.password)
    if not is_valid: raise HTTPException(status_code=400, detail=msg)
    try:
        db.execute("INSERT INTO users (username, password, email, language, login_notify, update_notify) VALUES (?, ?, ?, ?, ?, ?)", 
            (req.username, hash_password(req.password), req.email, "日本語", 1, 1))
        db.commit()
        return {"status": "success", "message": "登録完了！ログインしてください。"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="そのユーザー名は既に使用されています。")
    except Exception:
        raise HTTPException(status_code=500, detail="サーバーエラーが発生しました。")

@app.post("/api/auth/forgot")
def forgot(req: ForgotRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.execute("SELECT email FROM users WHERE email=?", (req.email,))
    if cursor.fetchone():
        token = str(uuid.uuid4())
        expiry = datetime.datetime.now() + datetime.timedelta(minutes=5)
        db.execute("INSERT INTO password_resets (token, email, expiry) VALUES (?, ?, ?)", (token, req.email, expiry))
        db.commit()
        return {"status": "success", "message": "再設定リンクを送信しました。"}
    raise HTTPException(status_code=404, detail="そのメールアドレスは登録されていません。")

@app.post("/api/extract/url")
def extract_from_url(req: ExtractUrlRequest, db: sqlite3.Connection = Depends(get_db)):
    if not req.url and not req.file_data and not req.pasted_text:
        raise HTTPException(status_code=400, detail="データが空です。チェックした入力元にデータを入力してください。")
    
    videos = []
    extracted_queries = []

    # 1. ファイルからの抽出処理
    if req.file_data and req.file_name:
        try:
            file_bytes = base64.b64decode(req.file_data)
            ext = req.file_name.lower().split('.')[-1]
            
            if ext in ['png', 'jpg', 'jpeg']:
                if not req.gemini_key: raise HTTPException(status_code=400, detail="画像からの抽出にはGemini APIキーが必要です。")
                genai.configure(api_key=req.gemini_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                mime_type = "image/jpeg" if ext in ["jpg", "jpeg"] else "image/png"
                image_parts = [{"mime_type": mime_type, "data": file_bytes}]
                prompt = "この画像から「楽曲の題名」と「アーティスト名(または合成音声名)」を読み取り、以下のJSON配列で出力してください。\n[{\"title\": \"曲名\", \"artist\": \"アーティスト名\"}]"
                res = model.generate_content([prompt, image_parts[0]])
                match = re.search(r'\[.*\]', res.text, re.DOTALL)
                if match:
                    items = json.loads(match.group(0))
                    for item in items: extracted_queries.append(f"{item.get('title', '')} {item.get('artist', '')}".strip())
            else:
                raw_text = ""
                if ext == 'pdf':
                    import PyPDF2
                    reader = PyPDF2.PdfReader(BytesIO(file_bytes))
                    for page in reader.pages: raw_text += page.extract_text() or ""
                elif ext == 'csv':
                    import pandas as pd
                    df = pd.read_csv(BytesIO(file_bytes))
                    raw_text = " ".join(df.astype(str).apply(lambda x: ' '.join(x), axis=1))
                elif ext in ['xls', 'xlsx']:
                    import pandas as pd
                    df = pd.read_excel(BytesIO(file_bytes))
                    raw_text = " ".join(df.astype(str).apply(lambda x: ' '.join(x), axis=1))

                if req.gemini_key:
                    genai.configure(api_key=req.gemini_key)
                    model = genai.GenerativeModel('gemini-1.5-flash')
                    prompt = f"以下のテキストから「楽曲の題名」と「アーティスト名」を抽出し、JSON配列で出力してください。\n[{{\"title\": \"曲名\", \"artist\": \"アーティスト\"}}]\n\n{raw_text[:3000]}"
                    res = model.generate_content(prompt)
                    match = re.search(r'\[.*\]', res.text, re.DOTALL)
                    if match:
                        items = json.loads(match.group(0))
                        for item in items: extracted_queries.append(f"{item.get('title', '')} {item.get('artist', '')}".strip())
                else:
                    titles = set([clean_title(t) for t in re.split(r'[\s\n,]+', raw_text) if len(t)>1])
                    extracted_queries.extend(list(titles))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ファイル解析エラー: {e}")

    # 2. ランキングテキスト（ペースト）からの抽出処理
    if req.pasted_text:
        if req.gemini_key:
            genai.configure(api_key=req.gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"以下のテキストから、「楽曲の題名」と「アーティスト名(または合成音声名)」を抽出してJSON配列で出力してください。\nフォーマット: [{{\"title\": \"曲名\", \"artist\": \"アーティスト名\"}}]\n【テキスト】\n{req.pasted_text[:3000]}"
            try:
                res = model.generate_content(prompt)
                match = re.search(r'\[.*\]', res.text, re.DOTALL)
                if match:
                    items = json.loads(match.group(0))
                    for item in items:
                        extracted_queries.append(f"{item.get('title', '')} {item.get('artist', '')}".strip())
            except Exception as e:
                pass
        else:
            titles = set([clean_title(t) for t in re.split(r'[\s\n,]+', req.pasted_text) if len(t)>1])
            extracted_queries.extend(list(titles))

    # ytsearch1でYouTube動画情報を取得 (ファイルとテキスト合算)
    if extracted_queries:
        ydl_opts = {'extract_flat': True, 'quiet': True, 'ignoreerrors': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            for query in extracted_queries:
                if not query: continue
                info = ydl.extract_info(f"ytsearch1:{query}", download=False)
                if info and 'entries' in info and len(info['entries']) > 0:
                    entry = info['entries'][0]
                    vid_url = entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}"
                    videos.append({"title": entry.get('title', query), "description": entry.get('description', ''), "url": vid_url})

    # 3. URLからの抽出処理
    if req.url:
        urls_to_process = [u.strip() for u in req.url.split('\n') if u.strip()]
        for current_url in urls_to_process:
            if "統計" in req.mode:
                if not req.yt_key: raise HTTPException(status_code=400, detail="YouTube APIキーが必要です。")
                youtube = build("youtube", "v3", developerKey=req.yt_key)
                playlist_match = re.search(r"list=([a-zA-Z0-9_-]+)", current_url)
                single_match = re.search(r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})", current_url)
                
                if playlist_match:
                    next_page_token = None
                    while True:
                        request = youtube.playlistItems().list(part="snippet", playlistId=playlist_match.group(1), maxResults=50, pageToken=next_page_token)
                        response = request.execute()
                        video_ids = [item["snippet"]["resourceId"]["videoId"] for item in response.get("items", []) if item["snippet"]["title"] not in ["Private video", "Deleted video"]]
                        if not video_ids: break
                        stats_req = youtube.videos().list(part="statistics", id=",".join(video_ids))
                        stats_dict = {i["id"]: i["statistics"] for i in stats_req.execute().get("items", [])}
                        for item in response.get("items", []):
                            vid = item["snippet"]["resourceId"]["videoId"]
                            title = item["snippet"]["title"]
                            stats = stats_dict.get(vid, {})
                            views, comments = int(stats.get("viewCount", 0)), int(stats.get("commentCount", 0))
                            if req.min_v > 0 and views < req.min_v: continue
                            if req.max_v > 0 and views > req.max_v: continue
                            if req.min_c > 0 and comments < req.min_c: continue
                            if req.max_c > 0 and comments > req.max_c: continue
                            videos.append({"title": title, "description": item["snippet"].get("description", ""), "url": f"https://www.youtube.com/watch?v={vid}"})
                        next_page_token = response.get("nextPageToken")
                        if not next_page_token: break
                elif single_match:
                    vid = single_match.group(1)
                    request = youtube.videos().list(part="snippet,statistics", id=vid)
                    response = request.execute()
                    for item in response.get("items", []):
                        title = item["snippet"]["title"]
                        stats = item.get("statistics", {})
                        views, comments = int(stats.get("viewCount", 0)), int(stats.get("commentCount", 0))
                        if req.min_v > 0 and views < req.min_v: continue
                        videos.append({"title": title, "description": item["snippet"].get("description", ""), "url": f"https://www.youtube.com/watch?v={vid}"})
            else:
                ydl_opts = {'extract_flat': True, 'quiet': True, 'ignoreerrors': True}
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(current_url, download=False)
                    for entry in info.get('entries', [info]):
                        if entry and (entry.get('url') or entry.get('id')):
                            vid_url = entry.get('url') or f"https://www.youtube.com/watch?v={entry.get('id')}"
                            videos.append({"title": entry.get('title', 'Unknown'), "description": entry.get('description', ''), "url": vid_url})

    if not videos:
        raise HTTPException(status_code=400, detail="動画情報を取得できませんでした。条件を見直してください。")

    ex_list = parse_flexible_input(req.exclude_words)
    tv_list = parse_flexible_input(req.target_vocal)
    tp_list = parse_flexible_input(req.target_producer)
    kw_list = [k.strip() for k in DEFAULT_KEYWORDS.split(',')]
    ng_list = [n.strip() for n in DEFAULT_NG_WORDS.split(',')]
    
    results = []
    model = None
    if "AI" in req.mode and req.gemini_key:
        genai.configure(api_key=req.gemini_key)
        model = genai.GenerativeModel('gemini-1.5-flash')

    for v in videos:
        raw_t = v["title"]
        desc = v["description"]
        url = v["url"]
        
        if any(ex in raw_t for ex in ex_list): continue
        if tp_list and not any(tp in raw_t or tp in desc for tp in tp_list): continue
            
        clean_t, vocals, bpm, music_key, mmd_available, theme_match = raw_t, "", 0, "", False, True
        
        if model:
            theme_instruction = f"・theme_match: テーマ「{req.theme}」に楽曲の雰囲気や文脈が合致するか(true/false)\n" if req.theme else ""
            prompt = f'''以下の動画データから情報を抽出し、JSONのみで出力してください。
            【抽出項目】
            ・title: 純粋な曲名
            ・vocals: 歌唱している合成音声名(複数なら「/」区切り)
            ・bpm: BPM数値のみ(不明なら0)
            ・key: 曲のキー(例: 1A, Am, C major等。不明なら空文字)
            ・mmd_available: 概要欄にMMDモーション配布やMMD動画である記載があるか(true/false)
            {theme_instruction}
            【データ】
            タイトル: {raw_t}
            概要欄: {desc}
            '''
            try:
                res = model.generate_content(prompt)
                match = re.search(r'\{.*\}', res.text, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    clean_t = parsed.get("title", raw_t)
                    vocals = parsed.get("vocals", "")
                    bpm = int(parsed.get("bpm", 0))
                    music_key = str(parsed.get("key", ""))
                    mmd_available = bool(parsed.get("mmd_available", False))
                    if req.theme: theme_match = bool(parsed.get("theme_match", True))
                else: raise Exception("Parse Error")
            except:
                clean_t = clean_title(raw_t) if "スッキリ" in req.title_mode else raw_t
                vocals = extract_vocals_manual(raw_t, desc, kw_list, ng_list)
                bpm_match = re.search(r'(?i)BPM\s*[:：]?\s*(\d{2,3})', desc)
                bpm = int(bpm_match.group(1)) if bpm_match else 0
                key_match = re.search(r'(?i)Key\s*[:：]\s*([A-Ga-g#♭m]+)', desc)
                music_key = key_match.group(1) if key_match else ""
        else:
            clean_t = clean_title(raw_t) if "スッキリ" in req.title_mode else raw_t
            vocals = extract_vocals_manual(raw_t, desc, kw_list, ng_list)
            bpm_match = re.search(r'(?i)BPM\s*[:：]?\s*(\d{2,3})', desc)
            bpm = int(bpm_match.group(1)) if bpm_match else 0
            key_match = re.search(r'(?i)Key\s*[:：]\s*([A-Ga-g#♭m]+)', desc)
            music_key = key_match.group(1) if key_match else ""
            mmd_available = bool(re.search(r'(?i)(mmd|モーション配布|bowlroll)', desc))

        if req.target_bpm > 0 and bpm != req.target_bpm: continue
        if req.target_key and req.target_key.lower() not in music_key.lower(): continue
        if req.theme and not theme_match: continue
        if req.require_mmd and not mmd_available: continue
        if tv_list and not any(tv in vocals for tv in tv_list): continue
        if req.multi_only and "/" not in vocals: continue
        
        safe_t = str(clean_t) if clean_t else "Unknown"
        encoded = urllib.parse.quote(safe_t)
        row = {"曲名": clean_t, "合成音声": vocals, "BPM": bpm if bpm > 0 else "不明", "Key": music_key if music_key else "不明", "MMD": "✅" if mmd_available else "-", "URL": url}
        
        if req.add_lyrics: row["歌詞検索"] = f"https://www.uta-net.com/search/?keyword={encoded}"
        if req.add_analysis: row["初音ミクwiki検索"] = f"https://w.atwiki.jp/hmiku/search?andor=and&keyword={encoded}"
        if req.add_bpm: row["BPM検索"] = f"https://tunebat.com/Search?q={encoded}"
        
        results.append(row)

    log_usage(db, req.username, req.mode, req.url, len(results))
    return {"status": "success", "count": len(results), "data": results}
