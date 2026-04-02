import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL?.trim();

// Only initialize Redis if we have a valid-looking URL
// This prevents "connect EISDIR /" errors when the URL is empty or just "/"
export const redis = (redisUrl && redisUrl.startsWith("redis")) 
  ? new Redis(redisUrl) 
  : null;

if (redis) {
  redis.on("error", (err) => {
    // Log the error but don't crash the process
    console.error("[ioredis] Connection error:", err.message);
  });
}

export async function setRoom(hash: string, data: any) {
  if (!redis) return;
  // Expire rooms after 48 hours as requested
  await redis.set(`room:${hash}`, JSON.stringify(data), "EX", 48 * 3600);
}

export async function getRoom(hash: string) {
  if (!redis) return null;
  const data = await redis.get(`room:${hash}`);
  return data ? JSON.parse(data) : null;
}

export async function getAllRooms() {
  if (!redis) return new Map();
  const keys = await redis.keys("room:*");
  const rooms = new Map();
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const hash = key.replace("room:", "");
      rooms.set(hash, JSON.parse(data));
    }
  }
  return rooms;
}
