import { STORAGE_KEY, TAG_OPTIONS } from "./constants.js";
import { seedRestaurants } from "./seed-data.js";
import { fetchSharedCollection, hasSupabaseConfig, updateSharedCollection } from "./supabase.js";

export function normalizeRestaurant(item){
  const tags=Array.isArray(item.tags)?item.tags.filter(tag=>TAG_OPTIONS.includes(tag)):[];
  return {...item,status:item.status==="wishlist"?"wishlist":"visited",visitDate:item.visitDate??"",visitCount:Number(item.visitCount??1),revisit:item.revisit??"unknown",menuReviews:item.menuReviews??"",tags:[...new Set(tags)],photos:Array.isArray(item.photos)?item.photos.filter(photo=>typeof photo==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(photo)):[]};
}
export function loadLocalRestaurants(){
  try { const saved=localStorage.getItem(STORAGE_KEY); const parsed=saved?JSON.parse(saved):seedRestaurants; return Array.isArray(parsed)?parsed.map(normalizeRestaurant):seedRestaurants.map(normalizeRestaurant); }
  catch(error){ console.error("로컬 저장 데이터를 불러오지 못했습니다.",error); return seedRestaurants.map(normalizeRestaurant); }
}
export async function loadRestaurants(){
  if(!hasSupabaseConfig()) return loadLocalRestaurants();
  try { const shared=await fetchSharedCollection();return Array.isArray(shared)?shared.map(normalizeRestaurant):[]; }
  catch(error){ console.error("공용 맛집 데이터를 불러오지 못해 로컬 데이터를 표시합니다.",error);return loadLocalRestaurants(); }
}
export function saveRestaurants(restaurants){
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(restaurants));if(hasSupabaseConfig()) updateSharedCollection(restaurants).catch(error=>console.error("공용 맛집 데이터를 동기화하지 못했습니다.",error));return true; }
  catch(error){ console.error("맛집을 저장하지 못했습니다.",error); return false; }
}
export function validateImportedItem(item){ return item&&typeof item==="object"&&typeof item.name==="string"&&item.name.length<=40&&typeof item.address==="string"&&item.address.length<=100&&Number.isFinite(Number(item.lat))&&Number.isFinite(Number(item.lng)); }
