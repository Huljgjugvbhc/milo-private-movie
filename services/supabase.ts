import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function saveMessage(roomHash: string, text: string, senderHash: string) {
  if (!supabase) return;
  
  const { error } = await supabase
    .from("messages")
    .insert([{ room_id: roomHash, text, sender_hash: senderHash }]);
    
  if (error) console.error("Error saving message:", error);
}

export async function getChatHistory(roomHash: string) {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomHash)
    .order("sent_at", { ascending: true });
    
  if (error) {
    console.error("Error fetching history:", error);
    return [];
  }
  return data;
}
