import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import os from "os";
import { uploadToStorage, getSignedStreamUrl } from "./services/storage.ts";
import { convertToMp4 } from "./services/ffmpeg.ts";
import { redis, setRoom, getRoom, getAllRooms } from "./services/redis.ts";
import { saveMessage, getChatHistory, supabase } from "./services/supabase.ts";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "sanctuary-secret-key";
const uploadDir = os.tmpdir();
const upload = multer({ dest: uploadDir });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      redis: !!redis, 
      supabase: !!supabase,
      b2: !!process.env.B2_APPLICATION_KEY_ID
    });
  });

  // Room state (In-memory fallback if no Redis)
  const localRooms = new Map<string, { codeHash: string; users: Set<string> }>();

  // API Routes
  app.post("/api/rooms/create", async (req, res) => {
    const code = nanoid(10);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(code, salt);
    
    const roomData = { codeHash: hash };
    if (redis) {
      await setRoom(hash, roomData);
    } else {
      localRooms.set(hash, { ...roomData, users: new Set() });
    }
    res.json({ code });
  });

  app.post("/api/rooms/join", async (req, res) => {
    const { code } = req.body;
    let foundHash = null;

    if (redis) {
      const keys = await redis.keys("room:*");
      for (const key of keys) {
        const hash = key.replace("room:", "");
        const data = await getRoom(hash);
        if (data && await bcrypt.compare(code, data.codeHash)) {
          foundHash = hash;
          break;
        }
      }
    } else {
      for (const [hash, data] of localRooms.entries()) {
        if (await bcrypt.compare(code, data.codeHash)) {
          foundHash = hash;
          break;
        }
      }
    }

    if (!foundHash) return res.status(404).json({ error: "Room not found" });

    const token = jwt.sign({ roomHash: foundHash }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, roomHash: foundHash });
  });

  app.get("/api/rooms/:roomHash/history", async (req, res) => {
    const history = await getChatHistory(req.params.roomHash);
    res.json(history);
  });

  app.post("/api/upload", upload.single("movie"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { roomHash } = req.body;
    const inputPath = req.file.path;
    const outputFileName = `${nanoid()}.mp4`;
    const outputPath = path.join(uploadDir, outputFileName);

    try {
      // Convert if not mp4
      let finalPath = inputPath;
      if (req.file.mimetype !== "video/mp4") {
        await convertToMp4(inputPath, outputPath);
        finalPath = outputPath;
      }

      const fileBuffer = fs.readFileSync(finalPath);
      await uploadToStorage(fileBuffer, outputFileName, "video/mp4");
      const streamUrl = await getSignedStreamUrl(outputFileName);

      // Cleanup
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

      io.to(roomHash).emit("upload:ready", { streamUrl });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Socket.IO Logic
  const activeUsers = new Map<string, Set<string>>(); // roomHash -> Set of socketIds

  io.on("connection", (socket) => {
    socket.on("room:join", async ({ token }) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { roomHash: string };
        const roomHash = decoded.roomHash;
        
        const roomData = redis ? await getRoom(roomHash) : localRooms.get(roomHash);
        if (!roomData) return socket.emit("error", "Room no longer exists");

        if (!activeUsers.has(roomHash)) activeUsers.set(roomHash, new Set());
        const users = activeUsers.get(roomHash)!;

        if (users.size >= 2) return socket.emit("error", "Room is full");

        socket.join(roomHash);
        users.add(socket.id);
        
        socket.to(roomHash).emit("room:presence", { partnerOnline: true });
        socket.emit("room:presence", { partnerOnline: users.size === 2 });

        socket.on("chat:message", async (data) => {
          await saveMessage(roomHash, data.text, socket.id);
          socket.to(roomHash).emit("chat:message", data);
        });
        socket.on("chat:typing", (typing) => socket.to(decoded.roomHash).emit("chat:typing", typing));
        socket.on("video:url", (data) => socket.to(decoded.roomHash).emit("video:url", data));
        socket.on("video:play", (data) => socket.to(decoded.roomHash).emit("video:play", data));
        socket.on("video:pause", (data) => socket.to(decoded.roomHash).emit("video:pause", data));
        socket.on("video:seek", (data) => socket.to(decoded.roomHash).emit("video:seek", data));

        socket.on("disconnect", () => {
          users.delete(socket.id);
          if (users.size === 0) activeUsers.delete(roomHash);
          socket.to(roomHash).emit("room:presence", { partnerOnline: false });
        });
      } catch (err) {
        socket.emit("error", "Invalid session");
      }
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Sanctuary server running at http://localhost:${PORT}`);
  });
}

startServer();
