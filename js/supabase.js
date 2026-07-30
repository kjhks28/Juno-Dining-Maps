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
export async function requestAdminMagicLink(email){ const client=await getClient();if(!client) throw new Error("Supabase 설정이 없습니다.");const emailRedirectTo=`${window.location.origin}${window.location.pathname}`;const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo}});if(error) throw error; }
export async function signOutAdmin(){ const client=await getClient();if(!client) return;const {error}=await client.auth.signOut();if(error) throw error; }
export async function fetchSharedCollection(){ const client=await getClient();if(!client) return null;const {data,error}=await client.from("food_map_collections").select("restaurants").eq("id","juno").single();if(error) throw error;return data.restaurants; }
export async function updateSharedCollection(payload){ const client=await getClient();if(!client) return false;const {error}=await client.from("food_map_collections").update({restaurants:payload,updated_at:new Date().toISOString()}).eq("id","juno");if(error) throw error;return true; }
export async function searchNaverPlaces(query){ const client=await getClient();if(!client) throw new Error("Supabase 설정이 없습니다.");const normalized=String(query??"").trim();if(normalized.length<2) throw new Error("검색어를 두 글자 이상 입력해 주세요.");const {data,error}=await client.functions.invoke("naver-place-search",{body:{query:normalized}});if(error){console.error("네이버 상호명 검색 함수를 호출하지 못했습니다.",error);throw new Error("상호명 검색 서버에 연결하지 못했습니다.");}if(data?.error) throw new Error(String(data.error));return Array.isArray(data?.places)?data.places:[]; }
