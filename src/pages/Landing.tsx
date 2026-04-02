import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Heart, Lock, Sparkles, ArrowRight } from "lucide-react";

export default function Landing() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("sanctuary_token", data.token);
        navigate(`/room/${data.roomHash}`);
      } else {
        setError(data.error || "Room not found");
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/rooms/create", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        // Automatically join the newly created room
        const joinRes = await fetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: data.code }),
        });
        const joinData = await joinRes.json();
        localStorage.setItem("sanctuary_token", joinData.token);
        navigate(`/room/${joinData.roomHash}`, { state: { newCode: data.code } });
      }
    } catch (err) {
      setError("Failed to create room.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="noise-overlay" />
      
      {/* Background Gradient Pulse */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.15, 0.1] 
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[800px] h-[800px] bg-rose-gold/20 rounded-full blur-[120px] -z-10"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="max-w-md w-full text-center space-y-12"
      >
        <div className="space-y-4">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="inline-block"
          >
            <Heart className="w-12 h-12 text-rose-gold fill-rose-gold/20" />
          </motion.div>
          <h1 className="text-5xl font-serif italic text-gray-100 tracking-tight">
            Sanctuary
          </h1>
          <p className="text-rose-gold/60 font-light italic">
            A private corner for exactly two.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="relative group">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter your secret code..."
              className="w-full bg-navy/50 border border-rose-gold/20 rounded-2xl px-6 py-4 text-center text-xl tracking-[0.2em] focus:outline-none focus:border-amber/50 transition-all placeholder:text-gray-600 placeholder:tracking-normal glow-border"
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-gold/30 group-focus-within:text-amber/50 transition-colors" />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-rose-gold text-sm font-light italic"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading || !code}
            className="w-full bg-rose-gold/10 hover:bg-rose-gold/20 text-rose-gold border border-rose-gold/30 rounded-2xl py-4 font-medium transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            Enter Room
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-rose-gold/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest">
            <span className="bg-navy px-4 text-rose-gold/40">Or</span>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={isLoading}
          className="text-amber/70 hover:text-amber transition-colors flex items-center gap-2 mx-auto text-sm tracking-widest uppercase font-medium group"
        >
          <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
          Create New Sanctuary
        </button>
      </motion.div>

      {/* Floating Particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -100, 0],
            x: [0, Math.random() * 40 - 20, 0],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 10 + Math.random() * 10,
            repeat: Infinity,
            delay: Math.random() * 10,
          }}
          className="absolute w-1 h-1 bg-amber/30 rounded-full blur-[1px]"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
