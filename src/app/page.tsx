'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Mic, MicOff, Send, BarChart3, Calendar,
  ChevronRight, Sparkles, Brain, Heart, Clock, ArrowLeft,
  Volume2, VolumeX, Lightbulb, BookOpen
} from 'lucide-react';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
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
  const [currentRecord, setCurrentRecord] = useState<ThoughtRecord | null>(null);
  const [records, setRecords] = useState<ThoughtRecord[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Check mic support
  useEffect(() => {
    setMicSupported(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (showWelcome && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Welcome to MindShift. ✨\n\nI'm here to help you work through your thoughts using CBT — cognitive behavioral therapy. It's like keeping a journal, but I guide you through it.\n\nTell me — what's been on your mind? What situation would you like to explore?",
        timestamp: new Date(),
      }]);
      setShowWelcome(false);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

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
      
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content || "I'm having trouble right now. Please try again.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Check if AI detected fields and update record
      if (data.fields) {
        setCurrentRecord(prev => ({ ...prev, ...data.fields }));
      }

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
            if (currentAudioRef.current) {
              currentAudioRef.current.pause();
            }
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            audio.play();
          }
        } catch (e) {
          console.error('TTS error:', e);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again.",
        timestamp: new Date(),
      }]);
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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);

        // Transcribe
        setIsLoading(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.text) {
            sendMessage(data.text);
          }
        } catch (e) {
          console.error('Transcription error:', e);
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Mic error:', e);
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
          messages: messages.map(m => ({ role: m.content, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.record) {
        setRecords(prev => [data.record, ...prev]);
        setCurrentRecord(null);
        setMessages(prev => [...prev, {
          id: `saved-${Date.now()}`,
          role: 'assistant',
          content: "✨ Your thought record has been saved. Take a moment to acknowledge this work — exploring your thoughts takes courage.\n\nWould you like to start a new record, or review your dashboard?",
          timestamp: new Date(),
        }]);
      }
    } catch (e) {
      console.error('Save error:', e);
    }
  }, [messages]);

  // Load records
  useEffect(() => {
    if (view === 'dashboard') {
      fetch('/api/records')
        .then(res => res.json())
        .then(data => setRecords(data.records || []))
        .catch(console.error);
    }
  }, [view]);

  // ============= RENDER =============
  return (
    <div className="min-h-screen bg-navy flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-gold/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view === 'dashboard' && (
              <button onClick={() => setView('chat')} className="text-text-secondary hover:text-gold transition-colors">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center">
                <Brain size={18} className="text-navy" />
              </div>
              <h1 className="font-display text-xl text-text-primary">
                Mind<span className="gold-text">Shift</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className="p-2 rounded-lg hover:bg-surface-light transition-colors text-text-secondary hover:text-gold"
              title={ttsEnabled ? 'Mute AI voice' : 'Enable AI voice'}
            >
              {ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={() => setView(view === 'chat' ? 'dashboard' : 'chat')}
              className="p-2 rounded-lg hover:bg-surface-light transition-colors text-text-secondary hover:text-gold"
            >
              {view === 'chat' ? <BarChart3 size={20} /> : <MessageCircle size={20} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {view === 'chat' ? (
          <ChatView
            messages={messages}
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            isRecording={isRecording}
            micSupported={micSupported}
            ttsEnabled={ttsEnabled}
            chatEndRef={chatEndRef}
            inputRef={inputRef}
            sendMessage={sendMessage}
            startRecording={startRecording}
            stopRecording={stopRecording}
            saveRecord={saveRecord}
            currentRecord={currentRecord}
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
  ttsEnabled, chatEndRef, inputRef, sendMessage, startRecording,
  stopRecording, saveRecord, currentRecord
}: {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  isRecording: boolean;
  micSupported: boolean;
  ttsEnabled: boolean;
  chatEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  sendMessage: (text: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  saveRecord: () => void;
  currentRecord: ThoughtRecord | null;
}) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col max-w-3xl mx-auto w-full"
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] ${msg.role === 'user'
              ? 'bg-surface-light rounded-2xl rounded-tr-sm'
              : 'glass-card rounded-2xl rounded-tl-sm'
            } px-4 py-3`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={12} className="text-gold" />
                  <span className="text-[10px] uppercase tracking-wider text-gold/70 font-medium">MindShift</span>
                </div>
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary/90">
                {msg.content}
              </div>
              <div className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-text-muted' : 'text-text-muted'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="glass-card rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Current Record Preview */}
      {currentRecord && (
        <div className="px-4 py-2">
          <div className="glass-card rounded-xl p-3 flex items-center gap-3">
            <Lightbulb size={16} className="text-gold shrink-0" />
            <div className="text-xs text-text-secondary flex-1">
              Recording your thoughts... <span className="text-emerald">Auto-saving</span>
            </div>
            <button
              onClick={saveRecord}
              className="px-3 py-1 text-xs gold-gradient text-navy font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Save Record
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 bg-navy/90 backdrop-blur-lg border-t border-gold/10 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          {micSupported && (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={`relative p-3 rounded-xl transition-all shrink-0 ${
                isRecording
                  ? 'bg-red-500/20 text-red-400 voice-pulse'
                  : 'bg-surface-light text-text-secondary hover:text-gold hover:bg-surface'
              }`}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={isRecording ? '🎤 Listening...' : 'Share what\'s on your mind...'}
              disabled={isLoading || isRecording}
              rows={1}
              className="w-full bg-surface-light border border-gold/10 rounded-xl px-4 py-3 pr-12 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold/30 focus:ring-1 focus:ring-gold/20 resize-none disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 p-2 rounded-lg gold-gradient text-navy disabled:opacity-30 hover:opacity-90 transition-opacity"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-2 text-xs text-red-400 flex items-center justify-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Recording... tap to stop
          </motion.div>
        )}
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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    acc[date] = acc[date] || [];
    acc[date].push(r);
    return acc;
  }, {});

  // Stats
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
      className="flex-1 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-display gold-text">{totalRecords}</div>
            <div className="text-xs text-text-secondary mt-1">Total Records</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-display text-emerald">{thisWeek}</div>
            <div className="text-xs text-text-secondary mt-1">This Week</div>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="text-2xl font-display text-text-primary">
              {totalRecords > 0 ? '🔥' : '🌱'}
            </div>
            <div className="text-xs text-text-secondary mt-1">
              {totalRecords > 0 ? 'Keep going!' : 'Start today'}
            </div>
          </div>
        </div>

        {/* Journal */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl gold-text">Your Journal</h2>
          <BookOpen size={20} className="text-gold/50" />
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <div className="text-4xl mb-3">✨</div>
            <p className="text-text-secondary text-sm">No records yet. Start a conversation to begin your journey.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, recs]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-gold/60" />
                  <span className="text-xs font-medium text-gold/70 uppercase tracking-wider">{date}</span>
                </div>
                <div className="space-y-2">
                  {recs.map(record => (
                    <motion.button
                      key={record.id}
                      onClick={() => setSelectedRecord(record)}
                      className="w-full glass-card rounded-xl p-4 text-left hover:border-gold/30 transition-all group"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">
                            {record.summary || record.situation || 'Thought Record'}
                          </p>
                          {record.emotions && (
                            <p className="text-xs text-text-muted mt-1 truncate">
                              {record.emotions}
                              {record.emotionIntensity && ` · ${record.emotionIntensity}%`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-text-muted group-hover:text-gold transition-colors shrink-0">
                          <span className="text-xs">
                            {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                      {record.cognitiveDistortions && record.cognitiveDistortions.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {record.cognitiveDistortions.map((d, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-gold/10 text-gold/80 border border-gold/20">
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
            className="fixed inset-0 bg-navy/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg gold-text">Thought Record</h3>
                <span className="text-xs text-text-muted">
                  {new Date(selectedRecord.date).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>

              <div className="space-y-4">
                {[
                  { icon: '📍', label: 'Situation', value: selectedRecord.situation },
                  { icon: '💜', label: 'Emotions', value: selectedRecord.emotions, extra: selectedRecord.emotionIntensity ? `${selectedRecord.emotionIntensity}%` : undefined },
                  { icon: '🫀', label: 'Physical Sensations', value: selectedRecord.physicalSensations },
                  { icon: '💭', label: 'Thoughts & Beliefs', value: selectedRecord.thoughts },
                  { icon: '🏃', label: 'Behaviors', value: selectedRecord.behaviors },
                ].map(({ icon, label, value, extra }) => value && (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{icon}</span>
                      <span className="text-xs font-medium text-gold/80 uppercase tracking-wider">{label}</span>
                      {extra && <span className="text-xs text-emerald">{extra}</span>}
                    </div>
                    <p className="text-sm text-text-primary/90 pl-6">{value}</p>
                  </div>
                ))}
              </div>

              {selectedRecord.cognitiveDistortions && selectedRecord.cognitiveDistortions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gold/10">
                  <div className="flex items-center gap-2 mb-2">
                    <span>🔍</span>
                    <span className="text-xs font-medium text-gold/80 uppercase tracking-wider">Distortions Detected</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedRecord.cognitiveDistortions.map((d, i) => (
                      <span key={i} className="px-3 py-1 text-xs rounded-full bg-gold/10 text-gold border border-gold/20">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.reframedThoughts && selectedRecord.reframedThoughts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gold/10">
                  <div className="flex items-center gap-2 mb-2">
                    <span>💡</span>
                    <span className="text-xs font-medium text-emerald uppercase tracking-wider">Reframed Thoughts</span>
                  </div>
                  {selectedRecord.reframedThoughts.map((r, i) => (
                    <p key={i} className="text-sm text-text-primary/90 pl-6 mb-1">→ {r}</p>
                  ))}
                </div>
              )}

              <button
                onClick={() => setSelectedRecord(null)}
                className="mt-6 w-full py-2 text-sm rounded-xl border border-gold/20 text-gold hover:bg-gold/5 transition-colors"
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