import { loadRuntimeConfig } from "./config.js";

const config=await loadRuntimeConfig();
let clientPromise=null;

export function hasSupabaseConfig(){ return Boolean(config.supabaseUrl&&config.supabasePublishableKey); }
async function getClient(){
  if(!hasSupabaseConfig()) return null;
  if(!clientPromise) clientPromise=import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm").then(({createClient})=>createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
  return clientPromise;
}
export async function getAdminSession(){ const client=await getClient();if(!client) return null;const {data,error}=await client.auth.getSession();if(error) throw error;return data.session; }
export async function signInAdmin(email,password){ const client=await getClient();if(!client) throw new Error("Supabase 설정이 없습니다.");const {data,error}=await client.auth.signInWithPassword({email,password});if(error) throw error;return data.session; }
export async function signOutAdmin(){ const client=await getClient();if(!client) return;const {error}=await client.auth.signOut();if(error) throw error; }
export async function fetchSharedCollection(){ const client=await getClient();if(!client) return null;const {data,error}=await client.from("food_map_collections").select("restaurants").eq("id","juno").single();if(error) throw error;return data.restaurants; }
export async function updateSharedCollection(restaurants){ const client=await getClient();if(!client) return false;const {error}=await client.from("food_map_collections").update({restaurants,updated_at:new Date().toISOString()}).eq("id","juno");if(error) throw error;return true; }
