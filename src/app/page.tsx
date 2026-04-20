'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, BarChart3, ArrowLeft,
  Volume2, VolumeX, BookOpen,
  X, AlertCircle, Brain, ChevronRight,
  Calendar, Feather
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

type View = 'chat' | 'dashboard';

export default function MindShiftApp() {
  const [view, setView] = useState<View>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [records, setRecords] = useState<ThoughtRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  useEffect(() => { setMicSupported(!!(navigator.mediaDevices?.getUserMedia)); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey. I'm here to listen.\n\nTell me what's been weighing on you — or just tap the mic and say it out loud. I'll walk you through it, one step at a time.",
        timestamp: new Date(),
      }]);
    }
  }, []);

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
          if (ttsRes.ok) { const audioBlob = await ttsRes.arrayBuffer(); const audioUrl = URL.createObjectURL(new Blob([audioBlob], { type: 'audio/mp3' })); if (currentAudioRef.current) currentAudioRef.current.pause(); currentAudioRef.current = new Audio(audioUrl); currentAudioRef.current.play().catch(() => {}); }
        } catch {}
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
      if (data.record) { setRecords(prev => [data.record, ...prev]); setMessages(prev => [...prev, { id: `s-${Date.now()}`, role: 'system', content: '✦ Saved to your journal.', timestamp: new Date() }]); }
    } catch { setError('Failed to save.'); }
  }, [messages]);

  useEffect(() => { if (view === 'dashboard') { fetch('/api/records').then(r => r.json()).then(d => setRecords(d.records || [])).catch(() => {}); } }, [view]);

  const messageCount = messages.filter(m => m.role === 'user').length;
  const showSave = messageCount >= 3;

  // ──── CHAT VIEW ────
  if (view === 'chat') {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        {/* Header — minimal, warm */}
        <header className="sticky top-0 z-50 bg-cream/90 backdrop-blur-sm border-b border-sand/60">
          <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-bark flex items-center justify-center">
                <Feather size={14} className="text-cream" />
              </div>
              <span className="font-display text-lg text-bark">MindShift</span>
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
        </header>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mx-4 mt-3 p-3 rounded-xl bg-terracotta/10 border border-terracotta/20 flex items-center gap-2 text-terracotta text-sm max-w-2xl lg:mx-auto">
              <AlertCircle size={16} /><span className="flex-1">{error}</span><button onClick={() => setError(null)}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-5">
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                {msg.role === 'system' ? (
                  <div className="px-4 py-1.5 rounded-full bg-sage/10 text-sage text-xs font-medium">{msg.content}</div>
                ) : msg.role === 'assistant' ? (
                  <div className="max-w-[80%]">
                    <div className="text-[11px] text-warm/60 mb-1 ml-0.5">MindShift</div>
                    <div className="bg-white border border-sand/60 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-bark/85">{msg.content}</div>
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
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-warm/50 animate-bounce" style={{ animationDelay: '0ms' }} /><span className="w-1.5 h-1.5 rounded-full bg-warm/50 animate-bounce" style={{ animationDelay: '140ms' }} /><span className="w-1.5 h-1.5 rounded-full bg-warm/50 animate-bounce" style={{ animationDelay: '280ms' }} /></div>
                    <span className="text-xs text-warm/40">Listening...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Save */}
        {showSave && !isLoading && (
          <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
            <button onClick={saveRecord} className="w-full py-3 rounded-xl bg-sage text-cream font-medium text-sm hover:bg-sage/90 transition-colors flex items-center justify-center gap-2">
              <BookOpen size={15} /> Save to Journal
            </button>
          </div>
        )}

        {/* Input — voice prominent */}
        <div className="border-t border-sand/60 bg-cream px-4 py-4">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-3">
            {micSupported && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`relative w-14 h-14 rounded-full transition-all duration-200 flex items-center justify-center shrink-0 ${
                  isRecording ? 'bg-terracotta text-cream' : 'bg-bark text-cream hover:bg-bark/85 active:scale-95'
                } disabled:opacity-30`}
              >
                {isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                {isRecording && <span className="absolute -top-1 -right-1 text-[10px] font-semibold bg-terracotta text-cream px-1.5 py-0.5 rounded-full">{recordingDuration}s</span>}
                {isRecording && <div className="absolute inset-0 rounded-full border-2 border-terracotta/40" style={{ animation: 'pulse-ring 1.5s ease-out infinite' }} />}
              </button>
            )}
            <div className="w-full flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
                placeholder={isRecording ? 'Listening...' : 'What\'s on your mind?'}
                disabled={isLoading || isRecording}
                rows={1}
                className="flex-1 bg-white border border-sand rounded-xl px-4 py-3 text-sm text-bark placeholder:text-warm/40 focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 resize-none disabled:opacity-30 transition-all"
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
                className="p-3 rounded-xl bg-bark text-cream disabled:opacity-15 hover:bg-bark/85 active:scale-95 transition-all shrink-0">
                <Send size={16} />
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
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setView('chat')} className="p-2 rounded-lg hover:bg-sand/40 text-warm hover:text-bark transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div className="w-7 h-7 rounded-lg bg-bark flex items-center justify-center">
              <Feather size={14} className="text-cream" />
            </div>
            <span className="font-display text-lg text-bark">Journal</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Stats — clean, no gradient text */}
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

          {/* Records by date */}
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-warm text-sm">No records yet. Start a conversation.</p>
              <button onClick={() => setView('chat')} className="mt-4 px-5 py-2 rounded-xl bg-bark text-cream text-sm font-medium hover:bg-bark/85 transition-colors">
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
                  <div className="space-y-2">
                    {recs.map(record => (
                      <button key={record.id}
                        className="w-full bg-white border border-sand rounded-xl p-4 text-left hover:border-sage/40 transition-colors group">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-bark truncate">{record.summary || record.situation || 'Thought Record'}</p>
                            {record.emotions && <p className="text-xs text-warm/50 mt-1 truncate">{record.emotions}</p>}
                          </div>
                          <div className="flex items-center gap-1 text-warm/20 group-hover:text-sage transition-colors shrink-0">
                            <span className="text-[11px]">{new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <ChevronRight size={14} />
                          </div>
                        </div>
                        {record.cognitiveDistortions && record.cognitiveDistortions.length > 0 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {record.cognitiveDistortions.slice(0, 3).map((d, i) => (
                              <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-sage/10 text-sage border border-sage/15">{d}</span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
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