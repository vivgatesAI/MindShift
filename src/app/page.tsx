'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, BarChart3, Calendar,
  ChevronRight, Sparkles, Brain, ArrowLeft,
  Volume2, VolumeX, Lightbulb, BookOpen, Waves,
  X, Check, AlertCircle
} from 'lucide-react';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isPlaying?: boolean;
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

// ============= MAIN APP =============
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

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Welcome to MindShift. ✨\n\nI'm here to help you work through your thoughts using CBT — cognitive behavioral therapy. Think of me as a wise friend who listens and reflects.\n\nTap the mic and tell me what's been on your mind, or type below.", 
        timestamp: new Date(),
      }]);
    }
  }, []);

  // Send message
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
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to get response');
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || "I'm having trouble right now. Please try again.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // TTS playback
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
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            audio.play().catch(() => {});
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

  // Voice recording
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
          setError('Voice transcription failed. Please try typing instead.');
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch {
      setError('Microphone access denied. Please allow mic access.');
    }
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // Save thought record
  const saveRecord = useCallback(async () => {
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
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
      setError('Failed to save record. Please try again.');
    }
  }, [messages]);

  // Load records
  useEffect(() => {
    if (view === 'dashboard') {
      fetch('/api/records')
        .then(res => res.json())
        .then(data => setRecords(data.records || []))
        .catch(() => {});
    }
  }, [view]);

  // ============= RENDER =============
  return (
    <div className="min-h-screen bg-[#050816] flex flex-col relative overflow-hidden">
      {/* Animated background grid */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#050816]/80 border-b border-indigo-500/10">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view === 'dashboard' && (
              <button onClick={() => setView('chat')} className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white">
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Brain size={18} className="text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg text-white leading-tight">MindShift</h1>
                <p className="text-[10px] text-indigo-300/60 uppercase tracking-widest">CBT Thought Records</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className="p-2.5 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white/80"
              title={ttsEnabled ? 'Mute AI voice' : 'Enable AI voice'}
            >
              {ttsEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button
              onClick={() => setView(view === 'chat' ? 'dashboard' : 'chat')}
              className="p-2.5 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white/80"
            >
              {view === 'chat' ? <BarChart3 size={17} /> : <Waves size={17} />}
            </button>
          </div>
        </div>
      </header>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-300 text-sm"
          >
            <AlertCircle size={16} />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'chat' ? (
          <ChatView
            messages={messages}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            isRecording={isRecording}
            micSupported={micSupported}
            recordingDuration={recordingDuration}
            chatEndRef={chatEndRef}
            inputRef={inputRef}
            sendMessage={sendMessage}
            startRecording={startRecording}
            stopRecording={stopRecording}
            saveRecord={saveRecord}
          />
        ) : (
          <DashboardView records={records} onBack={() => setView('chat')} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============= CHAT VIEW =============
function ChatView({
  messages, input, setInput, isLoading, isRecording, micSupported,
  recordingDuration, chatEndRef, inputRef, sendMessage, startRecording,
  stopRecording, saveRecord
}: {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  isRecording: boolean;
  micSupported: boolean;
  recordingDuration: number;
  chatEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  sendMessage: (text: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  saveRecord: () => void;
}) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Check if we should show save prompt (after enough messages)
  const messageCount = messages.filter(m => m.role === 'user').length;
  const showSave = messageCount >= 4;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col max-w-3xl mx-auto w-full relative z-10"
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
          >
            {msg.role === 'system' ? (
              <div className="px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs text-center">
                {msg.content}
              </div>
            ) : (
              <div className={`max-w-[85%] ${msg.role === 'user'
                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl rounded-tr-sm shadow-lg shadow-indigo-500/10'
                : 'bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm backdrop-blur-lg'
              } px-4 py-3.5`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-cyan-400/70 font-medium">MindShift</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {msg.content}
                </div>
                <div className="text-[10px] mt-2 opacity-30">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </motion.div>
        ))}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-5 py-4 backdrop-blur-lg">
              <div className="flex gap-2 items-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="ml-2 text-xs text-white/30">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Save prompt */}
      {showSave && !isLoading && (
        <div className="px-4 py-2">
          <button
            onClick={saveRecord}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-medium text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
          >
            <BookOpen size={16} />
            Save as Thought Record
          </button>
        </div>
      )}

      {/* Voice-first input area */}
      <div className="sticky bottom-0 bg-[#050816]/90 backdrop-blur-xl border-t border-indigo-500/10 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {/* Voice button - prominent */}
          <div className="flex flex-col items-center gap-3">
            {micSupported && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`relative w-16 h-16 rounded-full transition-all duration-300 ${
                  isRecording
                    ? 'bg-red-500 shadow-lg shadow-red-500/40 scale-110'
                    : 'bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105'
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
                    <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping" />
                    <div className="absolute -inset-2 rounded-full border border-red-400/30 animate-pulse" />
                  </>
                )}
              </button>
            )}
            
            {/* Text input - secondary */}
            <div className="w-full flex items-center gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={isRecording ? '🎤 Listening...' : 'Or type your thoughts...'}
                  disabled={isLoading || isRecording}
                  rows={1}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 resize-none disabled:opacity-40 transition-all"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-indigo-500 text-white disabled:opacity-20 hover:bg-indigo-400 transition-all"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
            {isRecording && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-red-400/80 flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Recording — tap to stop
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============= DASHBOARD VIEW =============
function DashboardView({ records, onBack }: { records: ThoughtRecord[]; onBack: () => void }) {
  const [selectedRecord, setSelectedRecord] = useState<ThoughtRecord | null>(null);

  // Group records by date
  const grouped = records.reduce<Record<string, ThoughtRecord[]>>((acc, r) => {
    const date = new Date(r.date).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    acc[date] = acc[date] || [];
    acc[date].push(r);
    return acc;
  }, {});

  const totalRecords = records.length;
  const thisWeek = records.filter(r => {
    const d = new Date(r.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 overflow-y-auto relative z-10"
    >
      <div className="max-w-3xl mx-auto px-5 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center backdrop-blur-lg">
            <div className="text-3xl font-display bg-gradient-to-br from-indigo-400 to-cyan-300 bg-clip-text text-transparent">{totalRecords}</div>
            <div className="text-[11px] text-white/40 mt-1 uppercase tracking-wider">Records</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center backdrop-blur-lg">
            <div className="text-3xl font-display text-cyan-400">{thisWeek}</div>
            <div className="text-[11px] text-white/40 mt-1 uppercase tracking-wider">This Week</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center backdrop-blur-lg">
            <div className="text-3xl">
              {totalRecords > 0 ? '✨' : '🌱'}
            </div>
            <div className="text-[11px] text-white/40 mt-1 uppercase tracking-wider">
              {totalRecords > 0 ? 'Progress' : 'Start'}
            </div>
          </div>
        </div>

        {/* Journal */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">Your Journal</h2>
          <BookOpen size={18} className="text-indigo-400/30" />
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-10 text-center backdrop-blur-lg">
            <div className="text-5xl mb-4">🧠</div>
            <p className="text-white/40 text-sm mb-2">No records yet.</p>
            <p className="text-white/25 text-xs">Start a conversation to begin tracking your thoughts.</p>
            <button
              onClick={onBack}
              className="mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
            >
              Start Talking
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, recs]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={13} className="text-indigo-400/40" />
                  <span className="text-[11px] font-medium text-indigo-400/50 uppercase tracking-[0.15em]">{date}</span>
                </div>
                <div className="space-y-2">
                  {recs.map(record => (
                    <motion.button
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 text-left hover:border-indigo-500/20 transition-all group backdrop-blur-lg"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate">{record.summary || record.situation || 'Thought Record'}</p>
                          {record.emotions && (
                            <p className="text-xs text-white/30 mt-1 truncate">{record.emotions}{record.emotionIntensity ? ` · ${record.emotionIntensity}%` : ''}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-white/20 group-hover:text-indigo-400 transition-colors shrink-0">
                          <span className="text-[11px]">
                            {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                      {record.cognitiveDistortions && record.cognitiveDistortions.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {record.cognitiveDistortions.slice(0, 3).map((d, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-cyan-400/10 text-cyan-300/70 border border-cyan-400/15">
                              {d}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Detail Modal */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#050816]/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0f24] border border-indigo-500/15 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg bg-gradient-to-br from-indigo-400 to-cyan-300 bg-clip-text text-transparent">Thought Record</h3>
                <span className="text-[11px] text-white/30">{new Date(selectedRecord.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="space-y-5">
                {[
                  { icon: '📍', label: 'Situation', value: selectedRecord.situation },
                  { icon: '💜', label: 'Emotions', value: selectedRecord.emotions, extra: selectedRecord.emotionIntensity ? `${selectedRecord.emotionIntensity}%` : undefined },
                  { icon: '🫀', label: 'Physical Sensations', value: selectedRecord.physicalSensations },
                  { icon: '💭', label: 'Thoughts & Beliefs', value: selectedRecord.thoughts },
                  { icon: '🏃', label: 'Behaviors', value: selectedRecord.behaviors },
                ].map(({ icon, label, value, extra }) => value && (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span>{icon}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-400/60">{label}</span>
                      {extra && <span className="text-[10px] text-cyan-400">{extra}</span>}
                    </div>
                    <p className="text-sm text-white/75 pl-6 leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>

              {selectedRecord.cognitiveDistortions && selectedRecord.cognitiveDistortions.length > 0 && (
                <div className="mt-5 pt-5 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <span>🔍</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-indigo-400/60">Distortions Detected</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedRecord.cognitiveDistortions.map((d, i) => (
                      <span key={i} className="px-3 py-1 text-xs rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/15">{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.reframedThoughts && selectedRecord.reframedThoughts.length > 0 && (
                <div className="mt-5 pt-5 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <span>💡</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400/60">Reframed Thoughts</span>
                  </div>
                  {selectedRecord.reframedThoughts.map((r, i) => (
                    <p key={i} className="text-sm text-emerald-300/80 pl-6 mb-1.5">→ {r}</p>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSelectedRecord(null)}
                className="mt-6 w-full py-2.5 text-sm rounded-xl border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/15 transition-all"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}