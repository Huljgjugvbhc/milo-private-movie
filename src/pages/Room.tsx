import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Video, 
  Upload, 
  Users, 
  MessageSquare, 
  Play, 
  Pause, 
  Volume2, 
  Copy,
  Check,
  LogOut
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  text: string;
  time: string;
  isMe: boolean;
}

export default function Room() {
  const { roomHash } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLinkInput, setVideoLinkInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const newCode = location.state?.newCode;

  useEffect(() => {
    const token = localStorage.getItem("sanctuary_token");
    if (!token) {
      navigate("/");
      return;
    }

    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.emit("room:join", { token });

    // Fetch history
    fetch(`/api/rooms/${roomHash}/history`)
      .then(res => res.json())
      .then(data => {
        const history = data.map((m: any) => ({
          id: m.id,
          text: m.text,
          time: new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: false // We don't strictly know who is who from history without more logic, but this is fine for now
        }));
        setMessages(history);
      });

    newSocket.on("room:presence", ({ partnerOnline }) => {
      setPartnerOnline(partnerOnline);
    });

    newSocket.on("chat:message", (data) => {
      setMessages(prev => [...prev, { ...data, isMe: false, id: Date.now().toString() }]);
    });

    newSocket.on("chat:typing", (typing) => {
      setPartnerTyping(typing);
    });

    newSocket.on("upload:ready", ({ streamUrl }) => {
      setVideoUrl(streamUrl);
      setIsUploading(false);
      setUploadProgress(0);
    });

    newSocket.on("video:url", ({ url }) => {
      setVideoUrl(url);
    });

    newSocket.on("video:play", ({ time }) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
        videoRef.current.play();
      }
    });

    newSocket.on("video:pause", () => {
      if (videoRef.current) videoRef.current.pause();
    });

    newSocket.on("video:seek", ({ time }) => {
      if (videoRef.current) videoRef.current.currentTime = time;
    });

    newSocket.on("error", (msg) => {
      alert(msg);
      navigate("/");
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomHash, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomHash) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("movie", file);
    formData.append("roomHash", roomHash);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload", true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status !== 200) {
          alert("Upload failed");
          setIsUploading(false);
        }
      };

      xhr.send(formData);
    } catch (err) {
      alert("Upload failed");
      setIsUploading(false);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;

    const msg = {
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    socket.emit("chat:message", msg);
    setMessages(prev => [...prev, { ...msg, isMe: true, id: Date.now().toString() }]);
    setInputText("");
    socket.emit("chat:typing", false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!isTyping && socket) {
      setIsTyping(true);
      socket.emit("chat:typing", true);
      setTimeout(() => {
        setIsTyping(false);
        socket.emit("chat:typing", false);
      }, 3000);
    }
  };

  const handleVideoSync = (type: string) => {
    if (!videoRef.current || !socket) return;
    const time = videoRef.current.currentTime;
    socket.emit(`video:${type}`, { time });
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoLinkInput.trim() || !socket) return;
    setVideoUrl(videoLinkInput);
    socket.emit("video:url", { url: videoLinkInput });
    setVideoLinkInput("");
  };

  const copyCode = () => {
    if (newCode) {
      navigator.clipboard.writeText(newCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-navy overflow-hidden">
      <div className="noise-overlay" />

      {/* Video Section */}
      <div className="flex-1 flex flex-col bg-black/40 relative">
        <header className="p-4 flex items-center justify-between border-b border-rose-gold/10 bg-navy/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <h2 className="font-serif italic text-xl text-gray-100">Sanctuary</h2>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-gold/5 border border-rose-gold/10">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                partnerOnline ? "bg-amber shadow-[0_0_8px_rgba(255,191,0,0.6)]" : "bg-gray-600"
              )} />
              <span className="text-[10px] uppercase tracking-widest text-rose-gold/60 font-medium">
                {partnerOnline ? "Partner Online" : "Waiting for partner"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {newCode && (
              <button 
                onClick={copyCode}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber/10 text-amber border border-amber/20 text-xs font-medium hover:bg-amber/20 transition-all"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {newCode}
              </button>
            )}
            <button 
              onClick={() => navigate("/")}
              className="p-2 text-rose-gold/40 hover:text-rose-gold transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 relative group">
          {isUploading ? (
            <div className="text-center space-y-6">
              <div className="relative w-32 h-32 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-rose-gold/10"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="377"
                    animate={{ strokeDashoffset: 377 - (377 * uploadProgress) / 100 }}
                    className="text-amber"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xl font-serif italic text-amber">
                  {uploadProgress}%
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-gray-300 font-medium">Carrying your movie home...</h3>
                <p className="text-rose-gold/40 text-sm italic font-light">
                  This might take a moment.
                </p>
              </div>
            </div>
          ) : videoUrl ? (
            <video 
              ref={videoRef}
              src={videoUrl}
              className="max-w-full max-h-full rounded-xl shadow-2xl glow-border"
              onPlay={() => handleVideoSync("play")}
              onPause={() => handleVideoSync("pause")}
              onSeeked={() => handleVideoSync("seek")}
              controls
            />
          ) : (
            <div className="text-center space-y-6 max-w-sm">
              <div className="w-20 h-20 bg-rose-gold/5 rounded-full flex items-center justify-center mx-auto border border-rose-gold/10">
                <Video className="w-8 h-8 text-rose-gold/40" />
              </div>
              <div className="space-y-2">
                <h3 className="text-gray-300 font-medium">No movie playing</h3>
                <p className="text-rose-gold/40 text-sm italic font-light">
                  Upload a movie or paste a link to watch together.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <form onSubmit={handleLinkSubmit} className="flex gap-2">
                  <input 
                    type="text" 
                    value={videoLinkInput}
                    onChange={(e) => setVideoLinkInput(e.target.value)}
                    placeholder="Paste video URL..."
                    className="flex-1 bg-navy/50 border border-rose-gold/20 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-rose-gold/50 transition-all placeholder:text-rose-gold/20"
                  />
                  <button 
                    type="submit"
                    className="bg-rose-gold/20 hover:bg-rose-gold/30 text-rose-gold px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  >
                    Load
                  </button>
                </form>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-rose-gold/10"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                    <span className="bg-navy px-4 text-rose-gold/20">Or</span>
                  </div>
                </div>
                <label className="cursor-pointer bg-rose-gold/10 hover:bg-rose-gold/20 border border-rose-gold/20 rounded-xl py-3 px-6 transition-all flex items-center justify-center gap-2 text-rose-gold text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  Upload Movie
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="video/*"
                    onChange={handleUpload}
                  />
                </label>
                <p className="text-[10px] text-rose-gold/30 uppercase tracking-widest">
                  Supports MP4, MKV, AVI
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Chat Section */}
      <div className="w-full md:w-80 border-l border-rose-gold/10 flex flex-col bg-navy/30 backdrop-blur-xl relative">
        <header className="p-4 border-b border-rose-gold/10 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-rose-gold/60" />
          <h3 className="text-xs uppercase tracking-[0.2em] text-rose-gold/60 font-semibold">Whispers</h3>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.isMe ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex flex-col max-w-[85%]",
                msg.isMe ? "ml-auto items-end" : "items-start"
              )}
            >
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm leading-relaxed",
                msg.isMe 
                  ? "bg-rose-gold/20 text-gray-100 rounded-tr-none border border-rose-gold/30" 
                  : "bg-navy/80 text-gray-300 rounded-tl-none border border-rose-gold/10"
              )}>
                {msg.text}
              </div>
              <span className="text-[10px] text-rose-gold/30 mt-1 px-1">{msg.time}</span>
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 space-y-2">
          <AnimatePresence>
            {partnerTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="text-[10px] text-amber/60 italic font-light ml-2"
              >
                Partner is typing...
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={sendMessage} className="relative">
            <input
              type="text"
              value={inputText}
              onChange={handleTyping}
              placeholder="Type a message..."
              className="w-full bg-navy/50 border border-rose-gold/20 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-rose-gold/50 transition-all placeholder:text-rose-gold/20"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-rose-gold hover:text-amber transition-colors disabled:opacity-30"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
