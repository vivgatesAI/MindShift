'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, BarChart3, ArrowLeft,
  Volume2, VolumeX, Lightbulb, BookOpen, Waves,
  X, AlertCircle, Brain, Sparkles, ChevronRight,
  Calendar, Heart
} from 'lucide-react';

// Types
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
  aiAnalysis?: string;
  summary?: string;
}

type View = 'chat' | 'dashboard';

// ─────────────── ANIMATED ORB BACKGROUND ───────────────
function OrbBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 bg-[#030014]" />
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/[0.07] blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/[0.05] blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] rounded-full bg-purple-600/[0.04] blur-[80px] animate-pulse" style={{ animationDelay: '4s' }} />
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.05) 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />
    </div>
  );
}

// ─────────────── FLOATING PARTICLES ───────────────
function Particles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: `${Math.random() * 5}s`,
    duration: `${3 + Math.random() * 4}s`,
    size: `${2 + Math.random() * 3}px`,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-indigo-400/20"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            animation: `float ${p.duration} ease-in-out ${p.delay} infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────── MAIN APP ───────────────
export default function MindShiftApp() {
  const [view, setView] = useState<View>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
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

  useEffect(() => {
    setMicSupported(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = [...messages, userMsg].map(m => ({
        role: m.role === 'system' ? 'assistant' as const : m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'Failed to get response');

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || "I'm having trouble right now. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (ttsEnabled && assistantMsg.content) {
        try {
          const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: assistantMsg.content }),
          });
          if (ttsRes.ok) {
            const audioBlob = await ttsRes.arrayBuffer();
            const audioUrl = URL.createObjectURL(new Blob([audioBlob], { type: 'audio/mp3' }));
            if (currentAudioRef.current) currentAudioRef.current.pause();
            currentAudioRef.current = new Audio(audioUrl);
            currentAudioRef.current.play().catch(() => {});
          }
        } catch {}
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, ttsEnabled]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      setRecordingDuration(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsLoading(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.text) sendMessage(data.text);
        } catch {
          setError('Voice transcription failed. Try typing instead.');
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch {
      setError('Microphone access denied.');
    }
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const saveRecord = useCallback(async () => {
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (data.record) {
        setRecords(prev => [data.record, ...prev]);
        setMessages(prev => [...prev, {
          id: `saved-${Date.now()}`,
          role: 'system',
          content: '✨ Thought record saved to your journal.',
          timestamp: new Date(),
        }]);
      }
    } catch {
      setError('Failed to save. Try again.');
    }
  }, [messages]);

  useEffect(() => {
    if (view === 'dashboard') {
      fetch('/api/records').then(r => r.json()).then(d => setRecords(d.records || [])).catch(() => {});
    }
  }, [view]);

  // ─────────────── MAIN RENDER ───────────────
  const messageCount = messages.filter(m => m.role === 'user').length;
  const showSave = messageCount >= 3;

  return (
    <div className="min-h-screen bg-[#030014] flex flex-col relative overflow-hidden">
      <OrbBackground />
      <Particles />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#030014]/70 border-b border-white/[0.04]">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'chat' && (
              <button onClick={() => setView('chat')} className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white">
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Brain size={16} className="text-white" />
              </div>
              <span className="font-display font-semibold bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">MindShift</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setTtsEnabled(!ttsEnabled)} className="p-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white/70 transition-colors">
              {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button onClick={() => setView(view === 'chat' ? 'dashboard' : 'chat')} className="p-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white/70 transition-colors">
              {view === 'chat' ? <BarChart3 size={16} /> : <Waves size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-300 text-sm relative z-10">
            <AlertCircle size={16} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'chat' ? (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col max-w-3xl mx-auto w-full relative z-10">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                  {msg.role === 'system' ? (
                    <div className="px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/15 text-indigo-300 text-xs flex items-center gap-1.5">
                      <Sparkles size={12} />{msg.content}
                    </div>
                  ) : msg.role === 'assistant' ? (
                    <div className="max-w-[85%] bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3.5 backdrop-blur-xl shadow-lg shadow-black/20">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400" />
                        <span className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-medium">MindShift</span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{msg.content}</div>
                      <div className="text-[10px] mt-2 opacity-20">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ) : (
                    <div className="max-w-[85%] bg-gradient-to-br from-indigo-600/80 to-indigo-700/80 rounded-2xl rounded-tr-sm px-4 py-3.5 shadow-lg shadow-indigo-500/10">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{msg.content}</div>
                      <div className="text-[10px] mt-2 opacity-25">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  )}
                </motion.div>
              ))}
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-4 backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-white/20">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Save button */}
            {showSave && !isLoading && (
              <div className="px-4 py-2 relative z-10">
                <button onClick={saveRecord}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2">
                  <BookOpen size={16} /> Save as Thought Record
                </button>
              </div>
            )}

            {/* Voice-first input */}
            <div className="sticky bottom-0 backdrop-blur-2xl bg-[#030014]/80 border-t border-white/[0.04] px-4 py-4 relative z-10">
              <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
                {/* Big mic button */}
                {micSupported && (
                  <div className="flex flex-col items-center">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isLoading}
                      className={`relative w-16 h-16 rounded-full transition-all duration-300 flex items-center justify-center ${
                        isRecording
                          ? 'bg-red-500 shadow-lg shadow-red-500/40 scale-110'
                          : 'bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95'
                      } disabled:opacity-40`}
                    >
                      {isRecording ? (
                        <div className="flex flex-col items-center">
                          <MicOff size={22} className="text-white" />
                          <span className="text-[10px] text-white/80 mt-0.5">{recordingDuration}s</span>
                        </div>
                      ) : (
                        <Mic size={24} className="text-white" />
                      )}
                      {isRecording && (
                        <>
                          <div className="absolute inset-0 rounded-full border-2 border-red-400/60 animate-ping" />
                          <div className="absolute -inset-3 rounded-full border border-red-400/20 animate-pulse" />
                          <div className="absolute -inset-6 rounded-full border border-red-400/10" style={{ animation: 'voice-pulse 1.5s ease-out infinite' }} />
                        </>
                      )}
                    </button>
                    {isRecording && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400/80 mt-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" /> Listening...
                      </motion.p>
                    )}
                  </div>
                )}

                {/* Text input */}
                <div className="w-full flex items-center gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }}}
                      placeholder={isRecording ? '🎤 Listening...' : 'Or type your thoughts...'}
                      disabled={isLoading || isRecording}
                      rows={1}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/15 resize-none disabled:opacity-30 transition-all"
                    />
                    <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading}
                      className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white disabled:opacity-20 hover:opacity-90 transition-opacity">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          // ─────────────── DASHBOARD ───────────────
          <motion.div key="dashboard" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="flex-1 overflow-y-auto relative z-10">
            <div className="max-w-3xl mx-auto px-5 py-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 text-center backdrop-blur-xl">
                  <div className="text-3xl font-display font-bold bg-gradient-to-br from-indigo-300 to-cyan-300 bg-clip-text text-transparent">{records.length}</div>
                  <div className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">Records</div>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 text-center backdrop-blur-xl">
                  <div className="text-3xl font-display font-bold text-cyan-400">
                    {records.filter(r => { const d = new Date(r.date); const now = new Date(); return d > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); }).length}
                  </div>
                  <div className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">This Week</div>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 text-center backdrop-blur-xl">
                  <Heart size={24} className="mx-auto text-indigo-400" />
                  <div className="text-[10px] text-white/30 mt-1 uppercase tracking-widest">{records.length > 0 ? 'Progress' : 'Start'}</div>
                </div>
              </div>

              {/* Journal */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">Your Journal</h2>
                <BookOpen size={18} className="text-indigo-400/20" />
              </div>

              {records.length === 0 ? (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-12 text-center backdrop-blur-xl">
                  <div className="text-5xl mb-4">🧠</div>
                  <p className="text-white/30 text-sm mb-1">No records yet.</p>
                  <p className="text-white/15 text-xs">Start a conversation to begin.</p>
                  <button onClick={() => setView('chat')}
                    className="mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/20">
                    Start Talking
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(records.reduce<Record<string, ThoughtRecord[]>>((acc, r) => {
                    const date = new Date(r.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                    acc[date] = acc[date] || []; acc[date].push(r); return acc;
                  }, {})).map(([date, recs]) => (
                    <div key={date}>
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar size={13} className="text-indigo-400/30" />
                        <span className="text-[11px] text-indigo-400/40 uppercase tracking-[0.15em]">{date}</span>
                      </div>
                      <div className="space-y-2">
                        {recs.map(record => (
                          <button key={record.id}
                            className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-left hover:border-indigo-500/20 transition-all group backdrop-blur-xl">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white/70 group-hover:text-white/90 truncate">{record.summary || record.situation || 'Thought Record'}</p>
                                {record.emotions && <p className="text-xs text-white/25 mt-1 truncate">{record.emotions}</p>}
                              </div>
                              <div className="flex items-center gap-1 text-white/15 group-hover:text-indigo-400/40">
                                <span className="text-[11px]">{new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <ChevronRight size={14} />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}