"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Play, Loader2, Music2, Settings2, ChevronDown, User, Key, Mail, X, FileText, Link as LinkIcon, Upload, Download, Copy, Image as ImageIcon, Plus, Settings, MessageSquare, AlertCircle, RefreshCw, Share2, ListMusic, FileSpreadsheet, FileImage, Paperclip } from "lucide-react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type PresetData = {
  id: number;
  name: string;
  useUrl: boolean;
  usePaste: boolean;
  useFile: boolean;
  url: string;
  pastedText: string;
  fileData: string;
  fileName: string;
  mode: string;
  ytKey: string;
  geminiKey: string;
  minV: number | ""; maxV: number | "";
  minC: number | ""; maxC: number | "";
  excludeWords: string;
  targetVocal: string;
  targetProducer: string;
  targetBpm: number | "";
  targetKey: string;
  theme: string;
  requireMmd: boolean;
  multiOnly: boolean;
  addLyrics: boolean;
  addAnalysis: boolean;
  addBpm: boolean;
  filename: string;
};

const createDefaultPreset = (id: number): PresetData => ({
  id,
  name: `プリセット ${id}`,
  useUrl: false, usePaste: false, useFile: false,
  url: "", pastedText: "", fileData: "", fileName: "",
  mode: "⚡ 高速モード", ytKey: "", geminiKey: "",
  minV: "", maxV: "", minC: "", maxC: "",
  excludeWords: "", targetVocal: "", targetProducer: "", targetBpm: "", targetKey: "",
  theme: "", requireMmd: false, multiOnly: false,
  addLyrics: true, addAnalysis: false, addBpm: true,
  filename: `playlist_${id}`
});

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<string | null>(null);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState("auth"); 
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [maxPresetModalOpen, setMaxPresetModalOpen] = useState(false);
  
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [contactSubject, setContactSubject] = useState("");
  const [contactBody, setContactBody] = useState("");
  const [contactFiles, setContactFiles] = useState<File[]>([]);
  const [contactBtnText, setContactBtnText] = useState("管理者に送信");

  const changeAuthMode = (mode: string) => { setAuthMode(mode); setAuthMessage(""); };

  const [presets, setPresets] = useState<PresetData[]>([
    createDefaultPreset(1), createDefaultPreset(2), createDefaultPreset(3), createDefaultPreset(4), createDefaultPreset(5)
  ]);
  const [activeTabId, setActiveTabId] = useState<number | "playlist">(1);
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [editingTabId, setEditingTabId] = useState<number | null>(null);

  const groupRef = useRef<HTMLDivElement>(null);

  const activePreset = presets.find(p => p.id === activeTabId) || presets[0];

  const updatePreset = (updates: Partial<PresetData>) => {
    if (activeTabId === "playlist") return;
    setPresets(presets.map(p => p.id === activeTabId ? { ...p, ...updates } : p));
  };

  const toHalfWidthNumber = (str: string) => {
    const converted = str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
    return converted.replace(/[^0-9]/g, '');
  };

  const handleNumberInput = (val: string, key: keyof PresetData) => {
    const numStr = toHalfWidthNumber(val);
    const num = numStr === "" ? "" : parseInt(numStr, 10);
    updatePreset({ [key]: num });
  };

  const [hideDeleteWarning, setHideDeleteWarning] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem("hideDeleteWarning") === "true"; } catch { return false; }
  });
  const [hideInitWarning, setHideInitWarning] = useState<boolean>(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem("hideInitWarning") === "true"; } catch { return false; }
  });
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  const handlePrefChange = (type: "delete" | "init", checked: boolean) => {
    if (type === "delete") { setHideDeleteWarning(checked); localStorage.setItem("hideDeleteWarning", String(checked)); }
    if (type === "init") { setHideInitWarning(checked); localStorage.setItem("hideInitWarning", String(checked)); }
  };

  const handleAddPreset = () => {
    if (presets.length >= 10) { setMaxPresetModalOpen(true); return; }
    const newId = presets.length > 0 ? Math.max(...presets.map(p => p.id)) + 1 : 1;
    setPresets([...presets, createDefaultPreset(newId)]);
    setActiveTabId(newId);
  };

  const requestRemovePreset = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (presets.length <= 1) { alert("プリセットは最低1つ必要です。"); return; }
    if (hideDeleteWarning) { executeRemove(id); } else { setDeleteTargetId(id); setDontShowAgain(false); setDeleteModalOpen(true); }
  };

  const executeRemove = (id: number) => {
    const newPresets = presets.filter(p => p.id !== id);
    setPresets(newPresets);
    if (activeTabId === id) setActiveTabId(newPresets[0].id);
  };

  const confirmRemove = () => {
    if (deleteTargetId !== null) { executeRemove(deleteTargetId); if (dontShowAgain) handlePrefChange("delete", true); }
    setDeleteModalOpen(false); setDeleteTargetId(null);
  };

  const requestInitPreset = () => {
    if (hideInitWarning) { executeInit(); } else { setDontShowAgain(false); setInitModalOpen(true); }
  };

  const executeInit = () => {
    const defaultData = createDefaultPreset(activePreset.id);
    updatePreset({ ...defaultData });
  };

  const confirmInit = () => {
    executeInit();
    if (dontShowAgain) handlePrefChange("init", true);
    setInitModalOpen(false);
  };

  const [shareText, setShareText] = useState("共有");
  const [saveText, setSaveText] = useState("保存");
  const [copyText, setCopyText] = useState("コピー"); 

  const handleShare = () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify(activePreset)));
    const shareUrl = `${window.location.origin}?preset=${encoded}`;
    navigator.clipboard.writeText(shareUrl);
    setShareText("クリップボードにコピーしました");
    setTimeout(() => setShareText("共有"), 2000);
  };

  const handleSaveAll = () => {
    setSaveText("保存しました");
    setTimeout(() => setSaveText("保存"), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const resultStr = event.target?.result as string;
      const base64 = resultStr ? resultStr.split(',')[1] : "";
      if (base64) updatePreset({ fileData: base64, fileName: file.name });
    };
    reader.readAsDataURL(file);
  };

  const getFilename = (ext: string) => `${activePreset.filename || 'playlist'}.${ext}`;

  const downloadCSV = () => {
    let csvContent = "曲名,合成音声,BPM,Key,MMD,リンク\n";
    results.forEach(r => { csvContent += `"${r.曲名}","${r.合成音声 || '-'}","${r.BPM || '-'}","${r.Key || '-'}","${r.MMD || '-'}","${r.URL}"\n`; });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = getFilename("csv"); a.click();
  };

  const downloadXLSX = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Playlist");
    XLSX.writeFile(workbook, getFilename("xlsx"));
  };

  const downloadPNG = async () => {
    const table = document.getElementById("results-table");
    if (!table) return;
    try {
      const canvas = await html2canvas(table, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a"); a.href = url; a.download = getFilename("png"); a.click();
    } catch { alert("画像の生成に失敗しました。"); }
  };

  const downloadPDF = async () => {
    const table = document.getElementById("results-table");
    if (!table) return;
    try {
      const canvas = await html2canvas(table, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("l", "mm", "a4"); 
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(getFilename("pdf"));
    } catch { alert("PDFの生成に失敗しました。"); }
  };

  const handleCopy = () => {
    let txtContent = "曲名\t合成音声\tBPM\tKey\tMMD\tリンク\n";
    results.forEach(r => { txtContent += `${r.曲名}\t${r.合成音声 || '-'}\t${r.BPM || '-'}\t${r.Key || '-'}\t${r.MMD || '-'}\t${r.URL}\n`; });
    navigator.clipboard.writeText(txtContent);
    setCopyText("コピーできました");
    setTimeout(() => setCopyText("コピー"), 2000);
  };

  const downloadM3U8 = () => {
    let content = "#EXTM3U\n";
    results.forEach(r => { content += `#EXTINF:-1,${r.曲名}\n${r.URL}\n`; });
    const blob = new Blob([content], { type: 'application/vnd.apple.mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = getFilename("m3u8"); a.click();
  };

  const downloadXML = () => {
    let content = `<?xml version="1.0" encoding="UTF-8"?><DJ_PLAYLISTS Version="1.0.0"><COLLECTION>\n`;
    results.forEach((r, i) => {
      const escapeXml = (unsafe?: string) => String(unsafe || '').replace(/[<>&'"]/g, c => {
        switch (c) { case '<': return '&lt;'; case '>': return '&gt;'; case '&': return '&amp;'; case '\'': return '&apos;'; case '"': return '&quot;'; default: return c; }
      });
      content += `<TRACK TrackID="${i+1}" Name="${escapeXml(r.曲名)}" Artist="${escapeXml(r.合成音声)}" BPM="${r.BPM==='不明'?0:r.BPM}" Tonality="${escapeXml(r.Key)}" Location="${escapeXml(r.URL)}" />\n`;
    });
    content += `</COLLECTION></DJ_PLAYLISTS>`;
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = getFilename("xml"); a.click();
  };

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleAuthSubmit = async () => {
    setAuthMessage("通信中...");
    try {
      const endpoint = authMode === "login" ? "login" : authMode === "register" ? "register" : "forgot";
      const payload = authMode === "forgot" ? { email: authEmail } : { username: authName, password: authPass, email: authEmail };
      const res = await fetch(`http://127.0.0.1:8000/api/auth/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        if (authMode === "login") { setUser(data.username); setAuthMessage(""); }
        else if (authMode === "register") { setAuthMessage("登録完了！ログインしてください。"); setAuthMode("login"); }
        else { setAuthMessage(data.message || "再設定リンクを送信しました。"); }
      } else { setAuthMessage(data.detail || "エラーが発生しました。"); }
    } catch { setAuthMessage("サーバーに接続できません。FastAPIを起動してください。"); }
  };

  const handleContactSubmit = async () => {
    if (!contactBody.trim()) {
      setContactBtnText("内容を入力してください");
      setTimeout(() => setContactBtnText("管理者に送信"), 3000);
      return;
    }

    const badWords = ["カス", "ボケ", "死ね", "くたばれ"];
    const hasBadWord = badWords.some(word => contactSubject.includes(word) || contactBody.includes(word));
    
    if (hasBadWord) {
      setContactBtnText("不適切な言葉が含まれています");
      setTimeout(() => setContactBtnText("管理者に送信"), 3000);
      return;
    }

    setContactBtnText("送信中...");
    try {
      const formData = new FormData();
      formData.append("件名", contactSubject);
      formData.append("メッセージ", contactBody);
      contactFiles.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const res = await fetch("https://formsubmit.co/ajax/yukimitsuyamamura0315@gmail.com", {
        method: "POST",
        body: formData 
      });

      if (res.ok) { 
        setContactBtnText("送信が完了しました！"); 
        setContactSubject(""); setContactBody(""); setContactFiles([]);
      } else { 
        setContactBtnText("送信に失敗しました"); 
      }
    } catch { 
      setContactBtnText("通信エラーが発生しました"); 
    }
    setTimeout(() => setContactBtnText("管理者に送信"), 3000);
  };

  const handleExtract = async () => {
    if (!activePreset.useUrl && !activePreset.usePaste && !activePreset.useFile) {
      setError("入力元を1つ以上選択してください。"); return;
    }
    setLoading(true); setError(""); setResults([]);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/extract/url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          username: user || "", 
          url: activePreset.useUrl ? (activePreset.url || "") : "", 
          pasted_text: activePreset.usePaste ? (activePreset.pastedText || "") : "",
          file_data: activePreset.useFile ? (activePreset.fileData || "") : "", 
          file_name: activePreset.useFile ? (activePreset.fileName || "") : "",
          mode: activePreset.mode || "", 
          yt_key: activePreset.ytKey || "", 
          gemini_key: activePreset.geminiKey || "", 
          exclude_words: activePreset.excludeWords || "", 
          target_vocal: activePreset.targetVocal || "",
          target_producer: activePreset.targetProducer || "", 
          target_bpm: activePreset.targetBpm || 0,
          target_key: activePreset.targetKey || "", 
          theme: activePreset.theme || "", 
          require_mmd: activePreset.requireMmd || false,
          multi_only: activePreset.multiOnly || false, 
          min_v: activePreset.minV || 0, 
          max_v: activePreset.maxV || 0,
          min_c: activePreset.minC || 0, 
          max_c: activePreset.maxC || 0,
          add_lyrics: activePreset.addLyrics || false, 
          add_analysis: activePreset.addAnalysis || false, 
          add_bpm: activePreset.addBpm || false
        })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") { setResults(data.data); }
      else { setError(data.detail || "抽出に失敗しました。"); }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') setError("抽出をキャンセルしました。");
      else setError("サーバー通信エラー: 裏側のFastAPIが起動しているか確認してください。");
    } finally {
      setLoading(false); setAbortController(null);
    }
  };

  const fontStyle = { fontFamily: '"UD Digi Kyokasho N-R", "UD デジタル 教科書体 N-R", "UD Digi Kyokasho N-B", "BIZ UDPGothic", sans-serif' };

  return (
    <main style={fontStyle} className="w-full min-h-screen overflow-x-hidden bg-slate-100 text-slate-800 relative selection:bg-indigo-300 selection:text-indigo-900 pb-32">
      
      <AnimatePresence>
        {showSplash && (
          <motion.div exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }} transition={{ duration: 0.6 }} className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-100 overflow-hidden">
            <Music2 className="w-28 h-28 text-indigo-600 mb-6 animate-pulse" />
            <h1 className="text-4xl md:text-7xl font-bold tracking-widest drop-shadow-sm text-center px-4">楽曲抽出システム</h1>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSplash && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full relative z-10">
          
          <div className="max-w-[95%] mx-auto px-4 md:px-8 pt-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b-[3px] border-slate-300 pb-6 px-2 md:px-0">
              <div className="flex items-center gap-4 text-indigo-600">
                <div className="p-3 md:p-4 bg-indigo-100 rounded-2xl shadow-inner"><Music2 className="w-8 h-8 md:w-10 md:h-10" /></div>
                <h1 className="text-2xl md:text-5xl font-bold tracking-wide">楽曲抽出システム</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-base md:text-xl">
                {user && <span className="font-bold text-slate-700 bg-white px-4 py-2 md:px-6 md:py-3 rounded-full shadow-sm border border-slate-200">👤 {user}</span>}
                <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50 font-bold py-2 px-4 md:px-6 rounded-full shadow-sm transition-colors h-full">
                  <Settings className="w-5 h-5 md:w-6 md:h-6" /> ⚙️ 設定・アカウント
                </button>
              </div>
            </header>
          </div>

          <div className="w-full sticky top-0 z-40 bg-slate-100/90 backdrop-blur-md pt-2 border-b border-slate-300">
            <div className="max-w-[95%] mx-auto px-4 md:px-8">
              <div className="flex overflow-x-auto gap-1 pb-0 scrollbar-hide items-end min-w-0">
                
                <Reorder.Group as="div" ref={groupRef} axis="x" values={presets} onReorder={setPresets} className="flex gap-1 pr-2 relative">
                  {presets.map((p) => (
                    <Reorder.Item 
                      key={p.id} 
                      value={p}
                      dragConstraints={groupRef}
                      dragElastic={0}
                      dragListener={editingTabId !== p.id}
                      className={`relative cursor-pointer px-4 md:px-6 py-3 md:py-4 rounded-t-xl font-bold text-base md:text-xl transition-colors border-t-2 border-x-2 border-b-0 flex items-center justify-between gap-2 md:gap-4 group ${activeTabId === p.id ? 'bg-white text-indigo-700 border-indigo-200 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]' : 'bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300 z-10'}`}
                    >
                      <div onClick={() => setActiveTabId(p.id)} className="flex-1 min-w-[100px] md:min-w-[140px] overflow-hidden" onDoubleClick={()=>setEditingTabId(p.id)}>
                        {editingTabId === p.id ? (
                          <input autoFocus type="text" value={p.name} onChange={(e)=>updatePreset({name: e.target.value})} onBlur={()=>setEditingTabId(null)} onKeyDown={(e)=>e.key==='Enter'&&setEditingTabId(null)} onPointerDown={(e) => e.stopPropagation()} className="w-full bg-transparent border-b border-indigo-400 focus:outline-none text-indigo-700" />
                        ) : (
                          <span className="block truncate select-none">{p.name}</span>
                        )}
                      </div>
                      {presets.length > 1 && (
                        <button onPointerDown={(e)=>e.stopPropagation()} onClick={(e) => requestRemovePreset(p.id, e)} className="p-1 rounded-full hover:bg-slate-300 transition-colors flex-shrink-0">
                          <X className="w-4 h-4 md:w-5 md:h-5 text-slate-500 hover:text-rose-500" />
                        </button>
                      )}
                    </Reorder.Item>
                  ))}
                </Reorder.Group>

                {presets.length < 10 && (
                  <button onClick={handleAddPreset} className="px-4 py-3 md:px-5 md:py-4 rounded-t-xl font-bold text-slate-500 bg-slate-200 hover:bg-slate-300 transition-colors border-t-2 border-x-2 border-slate-300 flex-shrink-0 ml-1 z-10">
                    <Plus className="w-5 h-5 md:w-7 md:h-7" />
                  </button>
                )}
                <div className="w-2 flex-shrink-0 md:w-6"></div>
                <button onClick={() => setActiveTabId('playlist')} className={`whitespace-nowrap px-4 py-3 md:px-8 md:py-4 rounded-t-xl font-bold text-base md:text-xl transition-colors border-t-2 border-x-2 flex-shrink-0 ${activeTabId === 'playlist' ? 'bg-white text-indigo-700 border-indigo-200 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]' : 'bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300 z-10'}`}>📁 プレイリスト作成</button>
              </div>
            </div>
          </div>

          <div className="max-w-[95%] mx-auto px-4 md:px-8 relative z-30">
            <div className="bg-white rounded-b-3xl rounded-tr-3xl p-4 md:p-10 shadow-xl border border-indigo-100 min-w-0 relative z-30 -mt-[1px]">
              {activeTabId !== 'playlist' ? (
                <div className="w-full">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg md:text-xl text-indigo-800 border-l-4 border-indigo-500 pl-3">現在のプリセット: {activePreset.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                      <button onClick={handleShare} className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold text-sm md:text-lg bg-indigo-100 px-4 py-2 rounded-lg transition-colors"><Share2 className="w-4 h-4 md:w-5 md:h-5" />{shareText}</button>
                      <button onClick={handleSaveAll} className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-emerald-600 hover:text-emerald-800 font-bold text-sm md:text-lg bg-emerald-100 px-4 py-2 rounded-lg transition-colors"><Download className="w-4 h-4 md:w-5 md:h-5" />{saveText}</button>
                      <button onClick={requestInitPreset} className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-rose-600 hover:text-rose-800 font-bold text-sm md:text-lg bg-rose-100 px-4 py-2 rounded-lg transition-colors"><RefreshCw className="w-4 h-4 md:w-5 md:h-5" />初期化</button>
                    </div>
                  </div>

                  <div className="space-y-8 md:space-y-10 text-base md:text-xl">
                    <div className="space-y-4">
                      <h3 className="font-bold text-xl md:text-2xl text-slate-700 border-l-4 border-indigo-500 pl-3 md:pl-4">1. 解析元データの入力 (複数選択可)</h3>
                      
                      <div className="flex flex-col gap-4 bg-slate-50 p-6 md:p-8 rounded-2xl border-2 border-slate-200">
                        <label className="flex items-center gap-4 cursor-pointer"><input type="checkbox" checked={activePreset.useUrl} onChange={(e) => updatePreset({useUrl: e.target.checked})} className="w-6 h-6 text-indigo-600 rounded" /><span className="font-bold">🔗 YouTube/SoundCloudのURLから抽出</span></label>
                        <label className="flex items-center gap-4 cursor-pointer"><input type="checkbox" checked={activePreset.usePaste} onChange={(e) => updatePreset({usePaste: e.target.checked})} className="w-6 h-6 text-indigo-600 rounded" /><span className="font-bold">📝 ランキングテキスト等をコピペ</span></label>
                        <label className="flex items-center gap-4 cursor-pointer"><input type="checkbox" checked={activePreset.useFile} onChange={(e) => updatePreset({useFile: e.target.checked})} className="w-6 h-6 text-indigo-600 rounded" /><span className="font-bold">📂 CSV/Excel/PDF/画像ファイル解析</span></label>
                      </div>
                      
                      {activePreset.useUrl && (
                        <div className="relative">
                          <div className="flex items-center gap-3 mb-2 ml-1 text-indigo-600 font-bold"><LinkIcon className="w-5 h-5"/>🔗 YouTube/SoundCloudのURL</div>
                          <textarea value={activePreset.url} onChange={(e) => updatePreset({url: e.target.value})} placeholder={"https://www.youtube.com/...\n※改行して複数入力することで、一括処理が可能です"} className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-4 py-4 md:px-6 md:py-5 text-slate-800 font-bold focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all placeholder:text-slate-400 min-h-[120px]" />
                        </div>
                      )}

                      {activePreset.usePaste && (
                        <div className="relative pt-2">
                          <div className="flex items-center gap-3 mb-2 ml-1 text-emerald-600 font-bold"><FileText className="w-5 h-5"/>📝 ランキングテキスト等をコピペ</div>
                          <textarea value={activePreset.pastedText} onChange={(e) => updatePreset({pastedText: e.target.value})} placeholder="テキストを直接貼り付け" className="w-full bg-slate-50 border-2 border-slate-300 rounded-2xl px-4 py-4 md:px-6 md:py-5 text-slate-800 font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-slate-400 min-h-[140px]" />
                        </div>
                      )}

                      {activePreset.useFile && (
                        <div className="relative pt-2">
                          <div className="flex items-center gap-3 mb-2 ml-1 text-sky-600 font-bold"><Upload className="w-5 h-5"/>📂 CSV/Excel/PDF/画像ファイル解析</div>
                          <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-center">
                            <input type="file" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg" />
                            <Upload className="w-10 h-10 md:w-14 md:h-14 mb-3 text-sky-400" />
                            <span className="font-bold text-base md:text-xl">{activePreset.fileName ? `選択中: ${activePreset.fileName}` : "クリックまたはドラッグ＆ドロップでファイルをアップロード"}</span>
                            <span className="text-sm md:text-base mt-2">対応形式: CSV, Excel, PDF, PNG, JPEG (Gemini API必須)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-bold text-xl md:text-2xl text-slate-700 border-l-4 border-indigo-500 pl-3 md:pl-4">2. モード選択</h3>
                      <div className="flex flex-col md:flex-row flex-wrap gap-4 md:gap-8 bg-slate-50 p-4 md:p-8 rounded-2xl border-2 border-slate-200">
                        <label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={activePreset.mode === "⚡ 高速モード"} onChange={() => updatePreset({mode: "⚡ 高速モード"})} className="w-6 h-6 md:w-7 md:h-7 text-indigo-600 bg-white border-slate-400" /><span className="font-bold text-lg md:text-2xl">⚡ 高速モード</span></label>
                        <label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={activePreset.mode === "✨ AI完璧抽出モード (Gemini必須)"} onChange={() => updatePreset({mode: "✨ AI完璧抽出モード (Gemini必須)"})} className="w-6 h-6 md:w-7 md:h-7 text-indigo-600 bg-white border-slate-400" /><span className="font-bold text-lg md:text-2xl">✨ AI完璧抽出</span></label>
                        <label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={activePreset.mode === "📊 統計フィルターモード (API必須)"} onChange={() => updatePreset({mode: "📊 統計フィルターモード (API必須)"})} className="w-6 h-6 md:w-7 md:h-7 text-indigo-600 bg-white border-slate-400" /><span className="font-bold text-lg md:text-2xl">📊 統計モード</span></label>
                      </div>
                    </div>

                    <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3 md:gap-4 font-bold text-slate-700 text-lg md:text-2xl"><Settings2 className="w-6 h-6 md:w-8 md:h-8" />3. 抽出条件・詳細フィルター</div>
                        <ChevronDown className={`w-6 h-6 md:w-8 md:h-8 text-slate-500 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {isFilterOpen && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="p-4 md:p-8 pt-0 space-y-6 md:space-y-8 border-t-2 border-slate-100 mt-2 bg-slate-50 select-text cursor-auto">
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">YouTube API Key</label><input type="password" value={activePreset.ytKey} onChange={(e)=>updatePreset({ytKey: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">Gemini API Key</label><input type="password" value={activePreset.geminiKey} onChange={(e)=>updatePreset({geminiKey: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">最小再生数</label><input type="text" inputMode="numeric" value={activePreset.minV} onChange={(e)=>handleNumberInput(e.target.value, "minV")} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">最大再生数 (0で無制限)</label><input type="text" inputMode="numeric" value={activePreset.maxV} onChange={(e)=>handleNumberInput(e.target.value, "maxV")} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">最小コメント数</label><input type="text" inputMode="numeric" value={activePreset.minC} onChange={(e)=>handleNumberInput(e.target.value, "minC")} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">最大コメント数 (0で無制限)</label><input type="text" inputMode="numeric" value={activePreset.maxC} onChange={(e)=>handleNumberInput(e.target.value, "maxC")} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                              </div>

                              <div>
                                <label className="block font-bold text-slate-600 mb-2 md:mb-3">❌ 除外ワード (カンマ区切り)</label>
                                <input type="text" value={activePreset.excludeWords} onChange={(e)=>updatePreset({excludeWords: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">🎯 抽出対象ボカロ (例: 初音ミク)</label><input type="text" value={activePreset.targetVocal} onChange={(e)=>updatePreset({targetVocal: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">👤 抽出対象ボカロP</label><input type="text" value={activePreset.targetProducer} onChange={(e)=>updatePreset({targetProducer: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" /></div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">🎛️ 特定のBPM</label><input type="text" inputMode="numeric" value={activePreset.targetBpm} onChange={(e)=>handleNumberInput(e.target.value, "targetBpm")} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" placeholder="例: 120" /></div>
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">🎹 特定のKey (調)</label><input type="text" value={activePreset.targetKey} onChange={(e)=>updatePreset({targetKey: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" placeholder="例: 1A, Am" /></div>
                                <div><label className="block font-bold text-slate-600 mb-2 md:mb-3">🌟 テーマ・雰囲気 (AI)</label><input type="text" value={activePreset.theme} onChange={(e)=>updatePreset({theme: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" placeholder="例: 宇宙、泣ける" /></div>
                              </div>

                              <div className="flex flex-col gap-3 md:gap-4 mt-4">
                                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={activePreset.multiOnly} onChange={(e)=>updatePreset({multiOnly: e.target.checked})} className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 bg-white border-slate-400 rounded" /><span className="font-bold text-slate-600 text-sm md:text-base">👥 複数人が歌唱している曲のみ抽出する</span></label>
                                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={activePreset.requireMmd} onChange={(e)=>updatePreset({requireMmd: e.target.checked})} className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 bg-white border-slate-400 rounded" /><span className="font-bold text-slate-600 text-sm md:text-base">💃 MMDモーション配布・動画が存在する曲のみ</span></label>
                              </div>

                              <hr className="border-slate-200" />
                              <div className="space-y-4 md:space-y-6">
                                <h4 className="font-bold text-slate-600 text-lg md:text-xl">追加情報リンク</h4>
                                <div className="flex flex-col md:flex-row flex-wrap gap-4 md:gap-8 pt-2 md:pt-4">
                                  <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={activePreset.addLyrics} onChange={(e)=>updatePreset({addLyrics: e.target.checked})} className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 bg-white border-slate-400 rounded" /><span className="font-bold text-slate-600 text-sm md:text-base">📝 歌詞サイトリンク</span></label>
                                  <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={activePreset.addAnalysis} onChange={(e)=>updatePreset({addAnalysis: e.target.checked})} className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 bg-white border-slate-400 rounded" /><span className="font-bold text-slate-600 text-sm md:text-base">🤔 考察/Wikiリンク</span></label>
                                  <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={activePreset.addBpm} onChange={(e)=>updatePreset({addBpm: e.target.checked})} className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 bg-white border-slate-400 rounded" /><span className="font-bold text-slate-600 text-sm md:text-base">🎛️ Tunebat BPM/Keyリンク</span></label>
                                </div>
                              </div>

                              <div>
                                <label className="block font-bold text-slate-600 mb-2 md:mb-3">📄 出力ファイル名 (任意)</label>
                                <input type="text" value={activePreset.filename} onChange={(e)=>updatePreset({filename: e.target.value})} className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 md:px-5 md:py-4 font-bold focus:border-indigo-500 focus:outline-none" />
                              </div>

                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {error && <div className="bg-rose-100 border-2 border-rose-300 text-rose-700 px-4 md:px-8 py-4 md:py-5 rounded-2xl font-bold text-base md:text-xl">{error}</div>}

                    {loading ? (
                      <button onClick={() => abortController?.abort()} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-5 md:py-8 rounded-2xl flex items-center justify-center gap-3 md:gap-4 transition-all shadow-xl active:scale-95 text-xl md:text-3xl tracking-widest">
                        <Loader2 className="w-6 h-6 md:w-10 md:h-10 animate-spin" />
                        <span>抽出を中止する</span>
                      </button>
                    ) : (
                      <button onClick={handleExtract} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 md:py-8 rounded-2xl flex items-center justify-center gap-3 md:gap-4 transition-all shadow-xl active:scale-95 text-xl md:text-3xl tracking-widest">
                        <Play className="w-6 h-6 md:w-10 md:h-10 fill-current" />
                        <span>抽出スタート</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-6 md:space-y-8 text-base md:text-xl">
                   <h3 className="text-xl md:text-3xl font-bold mb-6 flex items-center gap-3 md:gap-4 text-slate-700">📁 プレイリスト作成 ＆ URL結合</h3>
                   <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 md:p-20 flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer mb-6 md:mb-8 text-center">
                      <Upload className="w-10 h-10 md:w-16 md:h-16 mb-4 md:mb-5 text-indigo-400" /><span className="font-bold text-base md:text-2xl">URLが含まれた楽曲リスト (Excel/CSV) をアップロード</span>
                   </div>
                   <button className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-5 md:py-8 rounded-2xl flex items-center justify-center gap-3 md:gap-4 transition-all shadow-xl active:scale-95 text-lg md:text-3xl">
                      <Play className="w-6 h-6 md:w-10 md:h-10 fill-current" /><span>プレイリストURLを生成する</span>
                   </button>
                </div>
              )}

              {/* 🌟 抽出結果 */}
              {results.length > 0 && activeTabId !== 'playlist' && (
                <div id="results-table" className="mt-10 md:mt-16 bg-white border-2 border-slate-200 rounded-3xl p-4 md:p-10 shadow-xl overflow-hidden mb-8">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 md:mb-10 border-b-[3px] border-indigo-100 pb-4 md:pb-6 gap-4 md:gap-6">
                    <h3 className="text-2xl md:text-4xl font-bold text-indigo-800 shrink-0">抽出結果 ({results.length}曲)</h3>
                    
                    <div className="flex flex-wrap gap-2 md:gap-3 w-full justify-start lg:justify-end">
                      <button onClick={downloadXLSX} className="flex justify-center items-center gap-1 md:gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-colors text-xs md:text-sm"><FileSpreadsheet className="w-3 h-3 md:w-4 md:h-4" /> XLSX</button>
                      <button onClick={downloadCSV} className="flex justify-center items-center gap-1 md:gap-2 bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-colors text-xs md:text-sm"><FileText className="w-3 h-3 md:w-4 md:h-4" /> CSV</button>
                      <button onClick={downloadPDF} className="flex justify-center items-center gap-1 md:gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-colors text-xs md:text-sm"><FileText className="w-3 h-3 md:w-4 md:h-4" /> PDF</button>
                      <button onClick={downloadPNG} className="flex justify-center items-center gap-1 md:gap-2 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-colors text-xs md:text-sm"><FileImage className="w-3 h-3 md:w-4 md:h-4" /> 画像</button>
                      <button onClick={downloadM3U8} className="flex justify-center items-center gap-1 md:gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-colors text-xs md:text-sm"><ListMusic className="w-3 h-3 md:w-4 md:h-4" /> M3U8</button>
                      <button onClick={downloadXML} className="flex justify-center items-center gap-1 md:gap-2 bg-indigo-800 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-colors text-xs md:text-sm"><ListMusic className="w-3 h-3 md:w-4 md:h-4" /> XML</button>
                      <button onClick={handleCopy} className="flex justify-center items-center gap-1 md:gap-2 bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-colors text-xs md:text-sm"><Copy className="w-3 h-3 md:w-4 md:h-4" /> {copyText}</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap text-base md:text-xl">
                      <thead>
                        <tr className="border-b-4 border-slate-200 text-slate-500 font-bold text-base md:text-2xl bg-slate-50">
                          <th className="py-3 md:py-5 px-4 md:px-8 rounded-tl-xl">曲名</th>
                          <th className="py-3 md:py-5 px-4 md:px-8">合成音声</th>
                          <th className="py-3 md:py-5 px-4 md:px-8">BPM</th>
                          <th className="py-3 md:py-5 px-4 md:px-8">Key</th>
                          <th className="py-3 md:py-5 px-4 md:px-8">MMD</th>
                          <th className="py-3 md:py-5 px-4 md:px-8 rounded-tr-xl" data-html2canvas-ignore={true}>リンク</th>
                        </tr>
                      </thead>
                      <tbody className="font-bold text-slate-700 select-text">
                        {results.map((item, idx) => (
                          <tr key={idx} className="border-b-2 border-slate-100 hover:bg-indigo-50 transition-colors">
                            <td className="py-4 md:py-6 px-4 md:px-8">{item.曲名}</td>
                            <td className="py-4 md:py-6 px-4 md:px-8 text-slate-500">{item.合成音声 || "-"}</td>
                            <td className="py-4 md:py-6 px-4 md:px-8 text-slate-500">{item.BPM || "-"}</td>
                            <td className="py-4 md:py-6 px-4 md:px-8 text-slate-500">{item.Key || "-"}</td>
                            <td className="py-4 md:py-6 px-4 md:px-8 text-slate-500">{item.MMD}</td>
                            <td className="py-4 md:py-6 px-4 md:px-8 flex flex-wrap gap-2 md:gap-4" data-html2canvas-ignore={true}>
                              <a href={item.URL} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-400 bg-indigo-100 px-3 py-1 md:px-4 md:py-2 rounded-lg transition-colors text-sm md:text-lg">YouTube</a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* 🌟 設定・アカウント モーダル */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl relative flex flex-col h-[80vh] md:h-auto">
              <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-400 hover:text-slate-600 transition-colors z-20"><X className="w-6 h-6 md:w-10 md:h-10" /></button>
              
              <div className="flex border-b-[3px] border-slate-100 bg-slate-50 rounded-t-3xl pt-4 md:pt-6 px-4 md:px-6 gap-1 md:gap-2 overflow-x-auto scrollbar-hide">
                <button onClick={() => setSettingsTab("auth")} className={`px-4 py-3 md:px-6 md:py-4 font-bold text-base md:text-xl transition-colors border-b-4 shrink-0 ${settingsTab === "auth" ? "text-indigo-700 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"}`}>👤 アカウント</button>
                <button onClick={() => setSettingsTab("pref")} className={`px-4 py-3 md:px-6 md:py-4 font-bold text-base md:text-xl transition-colors border-b-4 shrink-0 ${settingsTab === "pref" ? "text-indigo-700 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"}`}>⚙️ 一般設定</button>
                <button onClick={() => setSettingsTab("contact")} className={`px-4 py-3 md:px-6 md:py-4 font-bold text-base md:text-xl transition-colors border-b-4 shrink-0 ${settingsTab === "contact" ? "text-indigo-700 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"}`}>✉️ お問い合わせ</button>
              </div>

              <div className="p-6 md:p-12 overflow-y-auto flex-1">
                {settingsTab === "auth" && (
                  <div className="space-y-6 md:space-y-8">
                    {!user ? (
                      <>
                        <div className="flex justify-center gap-4 md:gap-8 mb-6 md:mb-8 text-lg md:text-xl font-bold">
                          <button onClick={() => changeAuthMode("login")} className={`pb-2 border-b-4 ${authMode === "login" ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"}`}>ログイン</button>
                          <button onClick={() => changeAuthMode("register")} className={`pb-2 border-b-4 ${authMode === "register" ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"}`}>新規登録</button>
                          <button onClick={() => changeAuthMode("forgot")} className={`pb-2 border-b-4 ${authMode === "forgot" ? "text-indigo-600 border-indigo-600" : "text-slate-400 border-transparent hover:text-slate-600"}`}>パスワード</button>
                        </div>
                        <div className="space-y-4 md:space-y-6 text-base md:text-xl">
                          {authMode === "forgot" ? (
                            <div><label className="block text-slate-600 font-bold mb-2 md:mb-3">登録したメール</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-slate-400" /><input type="text" value={authEmail} onChange={(e)=>setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-12 py-3 md:py-4 focus:outline-none focus:border-indigo-500 font-bold" /></div></div>
                          ) : (
                            <>
                              <div><label className="block text-slate-600 font-bold mb-2 md:mb-3">ユーザー名</label><div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-slate-400" /><input type="text" value={authName} onChange={(e)=>setAuthName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-12 py-3 md:py-4 focus:outline-none focus:border-indigo-500 font-bold" /></div></div>
                              {authMode === "register" && <div><label className="block text-slate-600 font-bold mb-2 md:mb-3">メールアドレス</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-slate-400" /><input type="text" value={authEmail} onChange={(e)=>setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-12 py-3 md:py-4 focus:outline-none focus:border-indigo-500 font-bold" /></div></div>}
                              <div><label className="block text-slate-600 font-bold mb-2 md:mb-3">パスワード</label><div className="relative"><Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 text-slate-400" /><input type="password" value={authPass} onChange={(e)=>setAuthPass(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-12 py-3 md:py-4 focus:outline-none focus:border-indigo-500 font-bold" /></div></div>
                            </>
                          )}
                          {authMessage && <div className="text-center font-bold text-indigo-600 bg-indigo-50 p-3 md:p-4 rounded-xl border border-indigo-200">{authMessage}</div>}
                          <button onClick={handleAuthSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 md:py-5 rounded-xl text-lg md:text-xl shadow-lg mt-2 md:mt-4">{authMode === "login" ? "ログイン" : authMode === "register" ? "登録する" : "送信"}</button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center space-y-4 md:space-y-6">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-4"><User className="w-10 h-10 md:w-12 md:h-12 text-indigo-600" /></div>
                        <h3 className="text-2xl md:text-3xl font-bold text-slate-800">{user}</h3>
                        <p className="text-slate-500 font-bold text-base md:text-lg">現在ログイン中です</p>
                        <button onClick={()=>{setUser(null);setShowSettingsModal(false);}} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-4 md:py-5 rounded-xl text-lg md:text-xl transition-colors mt-6 md:mt-8">ログアウトする</button>
                      </div>
                    )}
                  </div>
                )}

                {settingsTab === "pref" && (
                  <div className="space-y-4 md:space-y-6 text-base md:text-xl">
                    <label className="flex items-center justify-between p-4 md:p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 md:gap-4"><AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-slate-400" /><span className="font-bold text-slate-700">プリセット削除時の警告を隠す</span></div>
                      <input type="checkbox" checked={hideDeleteWarning} onChange={(e) => handlePrefChange("delete", e.target.checked)} className="w-6 h-6 md:w-7 md:h-7 text-indigo-600 rounded" />
                    </label>
                    <label className="flex items-center justify-between p-4 md:p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3 md:gap-4"><RefreshCw className="w-5 h-5 md:w-6 md:h-6 text-slate-400" /><span className="font-bold text-slate-700">プリセット初期化時の警告を隠す</span></div>
                      <input type="checkbox" checked={hideInitWarning} onChange={(e) => handlePrefChange("init", e.target.checked)} className="w-6 h-6 md:w-7 md:h-7 text-indigo-600 rounded" />
                    </label>
                  </div>
                )}

                {settingsTab === "contact" && (
                  <div className="space-y-4 md:space-y-6 text-base md:text-xl">
                    <div>
                      <label className="block text-slate-600 font-bold mb-2 md:mb-3">件名</label>
                      <input type="text" value={contactSubject} onChange={(e)=>setContactSubject(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 md:px-6 md:py-4 focus:outline-none focus:border-indigo-500 font-bold" />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-2 md:mb-3">内容</label>
                      <textarea value={contactBody} onChange={(e)=>setContactBody(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 md:px-6 md:py-4 h-32 md:h-40 resize-none focus:outline-none focus:border-indigo-500 font-bold" />
                    </div>
                    
                    <div className="mt-2 md:mt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-indigo-600 font-bold hover:text-indigo-800 transition-colors">
                        <Paperclip className="w-5 h-5 md:w-6 md:h-6" /> 画像・動画を添付する
                        <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => {
                          if (e.target.files) setContactFiles(Array.from(e.target.files));
                        }} />
                      </label>
                      {contactFiles.length > 0 && (
                        <div className="mt-3 md:mt-4 p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs md:text-sm text-slate-500">
                          {contactFiles.map((f, i) => <div key={i} className="flex items-center gap-2 mb-2 last:mb-0"><FileImage className="w-3 h-3 md:w-4 md:h-4 shrink-0" /> <span className="truncate">{f.name}</span></div>)}
                        </div>
                      )}
                    </div>

                    <button onClick={handleContactSubmit} className={`w-full text-white font-bold py-4 md:py-5 rounded-xl text-lg md:text-xl shadow-lg transition-colors mt-2 md:mt-4 ${contactBtnText === "不適切な言葉が含まれています" || contactBtnText === "内容を入力してください" ? "bg-rose-500" : contactBtnText === "送信が完了しました！" ? "bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                      {contactBtnText}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🌟 削除確認モーダル */}
      <AnimatePresence>
        {deleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-6 md:p-10 shadow-2xl w-full max-w-md text-center">
              <h3 className="text-xl md:text-3xl font-bold text-rose-600 mb-3 md:mb-4">本当に削除しますか？</h3>
              <p className="text-slate-500 text-base md:text-lg mb-6 md:mb-8 font-bold">この操作は元に戻せません。</p>
              <label className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-8 cursor-pointer">
                <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} className="w-4 h-4 md:w-5 md:h-5 text-rose-600 rounded" />
                <span className="text-slate-600 font-bold text-base md:text-lg">次回から表示しない</span>
              </label>
              <div className="flex gap-3 md:gap-4">
                <button onClick={() => setDeleteModalOpen(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 md:py-4 rounded-xl text-lg md:text-xl transition-colors">キャンセル</button>
                <button onClick={confirmRemove} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 md:py-4 rounded-xl text-lg md:text-xl shadow-lg transition-colors">削除する</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🌟 初期化確認モーダル */}
      <AnimatePresence>
        {initModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-6 md:p-10 shadow-2xl w-full max-w-md text-center">
              <h3 className="text-xl md:text-3xl font-bold text-indigo-600 mb-3 md:mb-4">本当に初期化しますか？</h3>
              <p className="text-slate-500 text-base md:text-lg mb-6 md:mb-8 font-bold">現在のタブの入力内容は消去されます。</p>
              <label className="flex items-center justify-center gap-2 md:gap-3 mb-6 md:mb-8 cursor-pointer">
                <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} className="w-4 h-4 md:w-5 md:h-5 text-indigo-600 rounded" />
                <span className="text-slate-600 font-bold text-base md:text-lg">次回から表示しない</span>
              </label>
              <div className="flex gap-3 md:gap-4">
                <button onClick={() => setInitModalOpen(false)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 md:py-4 rounded-xl text-lg md:text-xl transition-colors">キャンセル</button>
                <button onClick={confirmInit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 md:py-4 rounded-xl text-lg md:text-xl shadow-lg transition-colors">初期化する</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🌟 上限警告モーダル */}
      <AnimatePresence>
        {maxPresetModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl w-full max-w-md text-center">
              <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
              <h3 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">プリセット上限です！</h3>
              <p className="text-slate-500 text-lg mb-8 font-bold leading-relaxed">プリセットの追加は<br/>最大10個までとなっています。</p>
              <button onClick={() => setMaxPresetModalOpen(false)} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl text-xl shadow-lg transition-colors">閉じる</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  );
}