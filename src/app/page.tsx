'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, BarChart3, ArrowLeft,
  Volume2, VolumeX, BookOpen,
  X, AlertCircle, ChevronDown, Trash2, Pencil,
  Calendar, Feather, MapPin, Heart, Hand, Lightbulb, Footprints
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ThoughtRecord {
  id: string;
  date: string;
  situation?: string;
  emotions?: string;
  emotionIntensity?: number;
  physicalSensations?: string;
  thoughts?: string;
  behaviors?: string;
  cognitiveDistortions?: string[];
  reframedThoughts?: string[];
  summary?: string;
}

// Safely parse JSON string fields from the API
function parseArray(val: string[] | string | null | undefined): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
  return [];
}

function normalizeRecord(r: any): ThoughtRecord {
  return {
    ...r,
    cognitiveDistortions: parseArray(r.cognitiveDistortions),
    reframedThoughts: parseArray(r.reframedThoughts),
  };
}

type View = 'start' | 'chat' | 'dashboard';

const PILLARS = [
  { key: 'situation' as const, label: 'Situation', icon: MapPin, desc: 'What happened?' },
  { key: 'emotions' as const, label: 'Emotions', icon: Heart, desc: 'What did you feel?' },
  { key: 'physicalSensations' as const, label: 'Physical', icon: Hand, desc: 'Body sensations?' },
  { key: 'thoughts' as const, label: 'Thoughts', icon: Lightbulb, desc: 'What were you thinking?' },
  { key: 'behaviors' as const, label: 'Behaviors', icon: Footprints, desc: 'What did you do?' },
];

export default function MindShiftApp() {
  const [view, setView] = useState<View>('start');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [records, setRecords] = useState<ThoughtRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [capturedPillars, setCapturedPillars] = useState<Record<string, string>>({});
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [inputHeight, setInputHeight] = useState('auto');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize textarea
  const autoResizeTextarea = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px';
    }
  }, []);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setMicSupported(!!(navigator.mediaDevices?.getUserMedia)); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  // Parse [FIELD: pillar|summary] markers from messages
  useEffect(() => {
    const allText = messages.map(m => m.content).join('\n');
    const fieldRegex = /\[FIELD:\s*(situation|emotions|physical|thoughts|behaviors)\s*\|\s*([^\]]+)\]/gi;
    const newCaptured: Record<string, string> = {};
    let match;
    while ((match = fieldRegex.exec(allText)) !== null) {
      const pillar = match[1].toLowerCase() === 'physical' ? 'physicalSensations' : match[1].toLowerCase();
      newCaptured[pillar] = match[2].trim();
    }
    if (Object.keys(newCaptured).length > 0) {
      setCapturedPillars(prev => ({ ...prev, ...newCaptured }));
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      const chatHistory = [...messages, userMsg].map(m => ({ role: m.role === 'system' ? 'assistant' as const : m.role, content: m.content }));
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: chatHistory }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to get response');
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: data.content || "I'm having trouble. Try again?", timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
      if (ttsEnabled && assistantMsg.content) {
        try {
          const ttsRes = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: assistantMsg.content }) });
          if (ttsRes.ok) { const audioBlob = await ttsRes.arrayBuffer(); const audioUrl = URL.createObjectURL(new Blob([audioBlob], { type: 'audio/mp3' })); if (currentAudioRef.current) currentAudioRef.current.pause(); currentAudioRef.current = new Audio(audioUrl); setIsSpeaking(true); currentAudioRef.current.onended = () => setIsSpeaking(false); currentAudioRef.current.onerror = () => setIsSpeaking(false); currentAudioRef.current.play().catch(() => setIsSpeaking(false)); }
        } catch { /* TTS failed silently */ }
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Something went wrong'); }
    finally { setIsLoading(false); }
  }, [messages, isLoading, ttsEnabled]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      setRecordingDuration(0);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsLoading(true);
        try { const formData = new FormData(); formData.append('audio', blob, 'recording.webm'); const res = await fetch('/api/transcribe', { method: 'POST', body: formData }); const data = await res.json(); if (data.text) sendMessage(data.text); }
        catch { setError('Voice transcription failed. Try typing.'); }
        finally { setIsLoading(false); }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch { setError('Microphone access denied.'); }
  }, [sendMessage]);

  const stopRecording = useCallback(() => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } }, [isRecording]);

  const saveRecord = useCallback(async () => {
    try {
      const res = await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }) });
      const data = await res.json();
      if (data.record) {
        setRecords(prev => [normalizeRecord(data.record), ...prev]);
        setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: 'system', content: '✦ Saved to your journal.', timestamp: new Date() }]);
      }
    } catch { setError('Failed to save.'); }
  }, [messages]);

  const deleteRecord = useCallback(async (id: string) => {
    try {
      await fetch(`/api/records?id=${id}`, { method: 'DELETE' });
      setRecords(prev => prev.filter(r => r.id !== id));
      setExpandedRecord(null);
    } catch { setError('Failed to delete.'); }
  }, []);

  const updateRecord = useCallback(async (id: string, data: Record<string, string>) => {
    try {
      const res = await fetch('/api/records', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...data }) });
      const updated = await res.json();
      if (updated.record) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updated.record } : r));
        setEditingRecord(null);
      }
    } catch { setError('Failed to update.'); }
  }, []);

  useEffect(() => {
    if (view === 'dashboard') { fetch('/api/records').then(r => r.json()).then(d => setRecords((d.records || []).map(normalizeRecord))).catch(() => {}); }
  }, [view]);

  const filledPillars = PILLARS.filter(p => capturedPillars[p.key]).length;

  // ──── START SCREEN ────
  if (view === 'start') {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-bark flex items-center justify-center mx-auto mb-6">
            <Feather size={28} className="text-cream" />
          </div>
          <h1 className="font-display text-3xl text-bark mb-2">MindShift</h1>
          <p className="text-warm text-sm mb-10 leading-relaxed">Talk through what's on your mind. I'll guide you through 5 pillars of a thought record, one question at a time.</p>

          {/* 5 pillars preview */}
          <div className="flex justify-center gap-2.5 mb-10">
            {PILLARS.map(p => {
              const IconComp = p.icon;
              return (
                <div key={p.key} className="flex flex-col items-center gap-1.5" title={p.desc}>
                  <div className="w-10 h-10 rounded-xl bg-sand/60 flex items-center justify-center">
                    <IconComp size={18} className="text-warm" />
                  </div>
                  <span className="text-[10px] text-warm/60">{p.label}</span>
                </div>
              );
            })}
          </div>

          <button onClick={() => { setView('chat'); if (messages.length === 0) { setMessages([{ id: 'welcome', role: 'assistant', content: "Hey. I'm here to listen.\n\nTell me what's been weighing on you — or just tap the mic and say it out loud. I'll walk you through it, one step at a time. What's going on?", timestamp: new Date() }]); } }}
            className="w-full py-4 rounded-xl bg-bark text-cream font-medium text-base hover:bg-bark/85 active:scale-[0.98] transition-all">
            Start Your Session
          </button>

          <button onClick={() => setView('dashboard')} className="mt-4 text-sm text-warm/50 hover:text-warm/80 transition-colors flex items-center gap-1.5 justify-center">
            <BarChart3 size={14} /> View Journal
          </button>
        </div>
      </div>
    );
  }

  // ──── CHAT VIEW ────
  if (view === 'chat') {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <header className="sticky top-0 z-50 bg-cream/90 backdrop-blur-sm border-b border-sand/60">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setView('start')} className="p-1.5 rounded-lg hover:bg-sand/40 text-warm hover:text-bark transition-colors">
                <ArrowLeft size={16} />
              </button>
              <div className="w-7 h-7 rounded-lg bg-bark flex items-center justify-center">
                <Feather size={14} className="text-cream" />
              </div>
              <span className="font-display text-lg text-bark">MindShift</span>
              {isSpeaking && (
                <div className="flex items-center gap-0.5 ml-1">
                  <span className="w-0.5 h-2 bg-sage rounded-full" style={{ animation: 'sound-wave 0.6s ease-in-out infinite', animationDelay: '0ms' }} />
                  <span className="w-0.5 h-3 bg-sage rounded-full" style={{ animation: 'sound-wave 0.6s ease-in-out infinite', animationDelay: '150ms' }} />
                  <span className="w-0.5 h-2.5 bg-sage rounded-full" style={{ animation: 'sound-wave 0.6s ease-in-out infinite', animationDelay: '300ms' }} />
                  <span className="w-0.5 h-1.5 bg-sage rounded-full" style={{ animation: 'sound-wave 0.6s ease-in-out infinite', animationDelay: '100ms' }} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setTtsEnabled(!ttsEnabled)} className="p-2 rounded-lg hover:bg-sand/40 text-warm hover:text-bark transition-colors" title={ttsEnabled ? 'Mute AI voice' : 'Enable AI voice'}>
                {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button onClick={() => setView('dashboard')} className="p-2 rounded-lg hover:bg-sand/40 text-warm hover:text-bark transition-colors">
                <BarChart3 size={16} />
              </button>
            </div>
          </div>
          {/* Pillar progress bar */}
          {filledPillars > 0 && (
            <div className="max-w-2xl mx-auto px-4 pb-2">
              <div className="flex items-center gap-1.5">
                {PILLARS.map(p => {
                  const filled = !!capturedPillars[p.key];
                  const IconComp = p.icon;
                  return (
                    <div key={p.key} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${filled ? 'bg-sage/10 text-sage' : 'bg-sand/40 text-warm/40'}`} title={`${p.label}: ${filled ? capturedPillars[p.key]?.slice(0, 40) + '...' : 'Not yet'}`}>
                      <IconComp size={11} />
                      <span className="hidden sm:inline">{p.label}</span>
                      {filled && <span className="text-sage">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mx-4 mt-3 p-3 rounded-xl bg-terracotta/10 border border-terracotta/20 flex items-center gap-2 text-terracotta text-sm max-w-2xl lg:mx-auto">
              <AlertCircle size={16} /><span className="flex-1">{error}</span><button onClick={() => setError(null)}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                {msg.role === 'system' ? (
                  <div className="px-4 py-1.5 rounded-full bg-sage/10 text-sage text-xs font-medium">{msg.content}</div>
                ) : msg.role === 'assistant' ? (
                  <div className="max-w-[80%]">
                    <div className="text-[11px] text-warm/60 mb-1 ml-0.5 flex items-center gap-1.5">MindShift{isSpeaking && <span className="text-sage text-[10px]">· Speaking</span>}</div>
                    <div className="bg-white border border-sand/60 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-bark/85">{msg.content.replace(/\[FIELD:[^\]]+\]/gi, '')}</div>
                    </div>
                    <div className="text-[10px] text-warm/30 mt-1 ml-0.5">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ) : (
                  <div className="max-w-[80%]">
                    <div className="bg-bark text-cream/90 rounded-2xl rounded-tr-sm px-4 py-3">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                    </div>
                    <div className="text-[10px] text-warm/30 mt-1 text-right mr-0.5">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                )}
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-sand/60 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-sage/10 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sage animate-pulse">
                        <path d="M12 2a5 5 0 0 1 5 5c0 2.76-2.24 5-5 5s-5-2.24-5-5a5 5 0 0 1 5-5z"/>
                        <path d="M12 7v.01"/>
                        <path d="M9.5 12.5c-1.5 1-2.5 2.5-2.5 4.5 0 2.76 2.24 5 5 5s5-2.24 5-5c0-2-1-3.5-2.5-4.5"/>
                      </svg>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-warm/50">Thinking...</span>
                      <div className="flex gap-1">
                        <span className="w-1 h-1 rounded-full bg-sage/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 rounded-full bg-sage/50 animate-bounce" style={{ animationDelay: '140ms' }} />
                        <span className="w-1 h-1 rounded-full bg-sage/50 animate-bounce" style={{ animationDelay: '280ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Save buttons - one for quick save, one for full record */}
        {messages.length > 1 && !isLoading && (
          <div className="px-4 pb-2 max-w-2xl mx-auto w-full space-y-2">
            {/* Always show quick save after first exchange */}
            <button onClick={saveRecord} className="w-full py-3 rounded-xl bg-sand text-bark font-medium text-sm hover:bg-sand/80 transition-colors flex items-center justify-center gap-2">
              <BookOpen size={15} /> Quick Save
            </button>
            {/* Full save button when enough pillars captured */}
            {filledPillars >= 3 && (
              <button onClick={saveRecord} className="w-full py-3 rounded-xl bg-sage text-cream font-medium text-sm hover:bg-sage/90 transition-colors flex items-center justify-center gap-2">
                <BookOpen size={15} /> Save Complete Record ({filledPillars}/5 pillars)
              </button>
            )}
          </div>
        )}

        <div className="border-t border-sand/60 bg-cream px-4 py-4">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-3">
            {micSupported && (
              <button onClick={isRecording ? stopRecording : startRecording} disabled={isLoading}
                className={`relative w-16 h-16 rounded-full transition-all duration-200 flex items-center justify-center shrink-0 touch-manipulation ${isRecording ? 'bg-terracotta text-cream' : 'bg-bark text-cream hover:bg-bark/85 active:scale-95'} disabled:opacity-30`}>
                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                {isRecording && <span className="absolute -top-1 -right-1 text-[10px] font-semibold bg-terracotta text-cream px-1.5 py-0.5 rounded-full">{recordingDuration}s</span>}
                {isRecording && <div className="absolute inset-0 rounded-full border-2 border-terracotta/40" style={{ animation: 'pulse-ring 1.5s ease-out infinite' }} />}
              </button>
            )}
            <div className="w-full flex items-center gap-2">
              <textarea ref={inputRef} value={input} onChange={(e) => { setInput(e.target.value); autoResizeTextarea(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
                style={{ minHeight: '44px', touchAction: 'manipulation' }}
                placeholder={isRecording ? 'Listening...' : 'What\'s on your mind?'}
                disabled={isLoading || isRecording} rows={1}
                className="flex-1 bg-white border border-sand rounded-xl px-4 py-3 text-sm text-bark placeholder:text-warm/40 focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 resize-none disabled:opacity-30 transition-all" />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
                className="p-4 min-h-[52px] min-w-[52px] rounded-xl bg-bark text-cream disabled:opacity-15 hover:bg-bark/85 active:scale-95 transition-all shrink-0 flex items-center justify-center">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ──── DASHBOARD ────
  const grouped = records.reduce<Record<string, ThoughtRecord[]>>((acc, r) => {
    const date = new Date(r.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    acc[date] = acc[date] || []; acc[date].push(r); return acc;
  }, {});

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="sticky top-0 z-50 bg-cream/90 backdrop-blur-sm border-b border-sand/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setView('start')} className="p-2 rounded-lg hover:bg-sand/40 text-warm hover:text-bark transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div className="w-7 h-7 rounded-lg bg-bark flex items-center justify-center">
              <Feather size={14} className="text-cream" />
            </div>
            <span className="font-display text-lg text-bark">Journal</span>
          </div>
          <button onClick={() => { setMessages([]); setCapturedPillars({}); setView('chat'); }}
            className="px-4 py-1.5 rounded-lg bg-bark text-cream text-sm font-medium hover:bg-bark/85 transition-colors">
            New Session
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-white border border-sand rounded-xl p-5">
              <div className="text-3xl font-display text-bark">{records.length}</div>
              <div className="text-xs text-warm mt-1">Records</div>
            </div>
            <div className="bg-white border border-sand rounded-xl p-5">
              <div className="text-3xl font-display text-sage">
                {records.filter(r => { const d = new Date(r.date); return d > new Date(Date.now() - 7*24*60*60*1000); }).length}
              </div>
              <div className="text-xs text-warm mt-1">This week</div>
            </div>
            <div className="bg-white border border-sand rounded-xl p-5">
              <div className="text-3xl">{records.length > 0 ? '✦' : '·'}</div>
              <div className="text-xs text-warm mt-1">{records.length > 0 ? 'Progress' : 'Start'}</div>
            </div>
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-warm text-sm mb-6">No records yet. Start a conversation to capture your first thought record.</p>
              <button onClick={() => { setView('chat'); if (messages.length === 0) setMessages([{ id: 'welcome', role: 'assistant', content: "Hey. I'm here to listen.\n\nTell me what's been weighing on you — or just tap the mic and say it out loud. I'll walk you through it, one step at a time. What's going on?", timestamp: new Date() }]); }}
                className="px-6 py-3 rounded-xl bg-bark text-cream font-medium hover:bg-bark/85 transition-colors">
                Start Talking
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([date, recs]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={13} className="text-warm/40" />
                    <span className="text-xs text-warm/50 font-medium">{date}</span>
                  </div>
                  <div className="space-y-3">
                    {recs.map(record => {
                      const isExpanded = expandedRecord === record.id;
                      const isEditing = editingRecord === record.id;
                      const filledCount = PILLARS.filter(p => (record as any)[p.key]).length;
                      return (
                        <div key={record.id} className="bg-white border border-sand rounded-xl overflow-hidden">
                          <button onClick={() => { setExpandedRecord(isExpanded ? null : record.id); setEditingRecord(null); }}
                            className="w-full p-4 text-left hover:bg-sand/20 transition-colors">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-bark line-clamp-2">{record.summary || record.situation || 'Thought Record'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[11px] text-warm/50">{new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span className="text-[11px] text-warm/30">·</span>
                                  <span className={`text-[11px] ${filledCount >= 4 ? 'text-sage' : 'text-warm/40'}`}>{filledCount}/5 pillars</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {record.cognitiveDistortions && record.cognitiveDistortions.length > 0 && (
                                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-terracotta/10 text-terracotta border border-terracotta/15">
                                    {record.cognitiveDistortions.length} distortion{record.cognitiveDistortions.length > 1 ? 's' : ''}
                                  </span>
                                )}
                                <ChevronDown size={16} className={`text-warm/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-sand/40">
                              {/* 5-pillar detail */}
                              {PILLARS.map(pillar => {
                                const value = isEditing ? (editData[pillar.key] ?? (record as any)[pillar.key] ?? '') : ((record as any)[pillar.key] as string | undefined);
                                const IconComp = pillar.icon;
                                return (
                                  <div key={pillar.key} className="flex gap-3 px-4 py-3 border-b border-sand/20 last:border-b-0">
                                    <div className={`shrink-0 w-7 h-7 rounded-lg ${value ? 'bg-sage/10 text-sage' : 'bg-sand/50 text-warm/30'} flex items-center justify-center`}>
                                      <IconComp size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] font-medium text-warm/60 uppercase tracking-wider">{pillar.label}</div>
                                      {isEditing ? (
                                        <textarea value={editData[pillar.key] ?? (record as any)[pillar.key] ?? ''}
                                          onChange={(e) => setEditData(prev => ({ ...prev, [pillar.key]: e.target.value }))}
                                          className="w-full mt-1 text-sm text-bark bg-sand/20 rounded-lg px-2 py-1.5 border border-sand/40 focus:border-sage focus:outline-none resize-none"
                                          rows={2} />
                                      ) : (
                                        <div className="text-sm text-bark mt-0.5">
                                          {value || <span className="text-warm/30 italic">Not captured</span>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Distortions */}
                              {record.cognitiveDistortions && record.cognitiveDistortions.length > 0 && (
                                <div className="px-4 py-3 border-t border-sand/20">
                                  <div className="text-[11px] font-medium text-warm/60 uppercase tracking-wider mb-2">Distortions Detected</div>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {record.cognitiveDistortions.map((d, i) => (
                                      <span key={i} className="px-2.5 py-1 text-[11px] rounded-lg bg-terracotta/8 text-terracotta border border-terracotta/15">{d}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Reframes */}
                              {record.reframedThoughts && record.reframedThoughts.length > 0 && (
                                <div className="px-4 py-3 border-t border-sand/20">
                                  <div className="text-[11px] font-medium text-warm/60 uppercase tracking-wider mb-2">Reframes</div>
                                  <ul className="space-y-1">
                                    {record.reframedThoughts.map((r, i) => (
                                      <li key={i} className="text-sm text-sage flex items-start gap-2">
                                        <span className="text-sage/50 mt-1 shrink-0">✦</span><span>{r}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Intensity bar */}
                              {record.emotionIntensity != null && (
                                <div className="px-4 py-3 border-t border-sand/20">
                                  <div className="text-[11px] font-medium text-warm/60 uppercase tracking-wider mb-1.5">Emotion Intensity</div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-sand/40 rounded-full overflow-hidden">
                                      <div className="h-full bg-terracotta rounded-full" style={{ width: `${record.emotionIntensity}%` }} />
                                    </div>
                                    <span className="text-sm font-medium text-bark">{record.emotionIntensity}%</span>
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="px-4 py-3 flex items-center gap-2 border-t border-sand/20">
                                {isEditing ? (
                                  <>
                                    <button onClick={() => updateRecord(record.id, editData)}
                                      className="px-4 py-1.5 rounded-lg bg-sage text-cream text-sm font-medium hover:bg-sage/90 transition-colors">
                                      Save Changes
                                    </button>
                                    <button onClick={() => setEditingRecord(null)}
                                      className="px-4 py-1.5 rounded-lg bg-sand/40 text-warm text-sm hover:bg-sand/60 transition-colors">
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingRecord(record.id); setEditData({ situation: record.situation || '', emotions: record.emotions || '', physicalSensations: record.physicalSensations || '', thoughts: record.thoughts || '', behaviors: record.behaviors || '' }); }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-warm hover:text-bark hover:bg-sand/40 transition-colors text-sm">
                                      <Pencil size={13} /> Edit
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this record? This cannot be undone.')) deleteRecord(record.id); }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-terracotta/70 hover:text-terracotta hover:bg-terracotta/5 transition-colors text-sm">
                                      <Trash2 size={13} /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}