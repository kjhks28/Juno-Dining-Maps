import { COLLECTION_LIMIT, COLLECTION_NAME_MAX_LENGTH, LATITUDE_RANGE, LONGITUDE_RANGE, RESTAURANT_BACKUP_LIMIT, STORAGE_KEY, TAG_OPTIONS } from "./constants.js";
import { seedRestaurants } from "./seed-data.js";
import { fetchSharedCollection, hasSupabaseConfig, updateSharedCollection } from "./supabase.js";

export function normalizeCoordinate(value,{min,max}){
  if(value===null||value===undefined||typeof value==="boolean") return null;
  if(typeof value==="string"&&value.trim()==="") return null;
  if(typeof value!=="string"&&typeof value!=="number") return null;
  const number=Number(value);
  return Number.isFinite(number)&&number>=min&&number<=max?number:null;
}
export function normalizeRestaurant(item){
  const tags=Array.isArray(item.tags)?item.tags.filter(tag=>TAG_OPTIONS.includes(tag)):[];
  const collections=Array.isArray(item.collections)?item.collections.filter(name=>typeof name==="string"&&name.trim()).map(name=>name.trim()).slice(0,10):[];
  const lat=normalizeCoordinate(item.lat,LATITUDE_RANGE);const lng=normalizeCoordinate(item.lng,LONGITUDE_RANGE);
  return {...item,status:item.status==="wishlist"?"wishlist":"visited",visitDate:item.visitDate??"",visitCount:Number(item.visitCount??1),revisit:item.revisit??"unknown",menuReviews:item.menuReviews??"",tags:[...new Set(tags)],collections:[...new Set(collections)],lat,lng,photos:Array.isArray(item.photos)?item.photos.filter(photo=>typeof photo==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(photo)):[]};
}
function normalizeCollectionNames(names,restaurants=[]){
  const explicit=Array.isArray(names)?names:[];
  const assigned=restaurants.flatMap(item=>item.collections??[]);
  return [...new Set([...explicit,...assigned].filter(name=>typeof name==="string").map(name=>name.trim()).filter(name=>name&&name.length<=COLLECTION_NAME_MAX_LENGTH))].slice(0,COLLECTION_LIMIT);
}
export function normalizeFoodMapData(value){
  const sourceRestaurants=Array.isArray(value)?value:Array.isArray(value?.restaurants)?value.restaurants:[];
  const restaurants=sourceRestaurants.map(normalizeRestaurant);
  return {restaurants,collections:normalizeCollectionNames(value?.collections,restaurants)};
}
export function loadLocalFoodMapData(){
  try { const saved=localStorage.getItem(STORAGE_KEY);return normalizeFoodMapData(saved?JSON.parse(saved):seedRestaurants); }
  catch(error){ console.error("로컬 저장 데이터를 불러오지 못했습니다.",error);return normalizeFoodMapData(seedRestaurants); }
}
export async function loadFoodMapData(){
  if(!hasSupabaseConfig()) return {...loadLocalFoodMapData(),source:"local"};
  try { return {...normalizeFoodMapData(await fetchSharedCollection()),source:"remote"}; }
  catch(error){ console.error("공용 맛집 데이터를 불러오지 못해 로컬 데이터를 표시합니다.",error);return {...loadLocalFoodMapData(),source:"local-fallback"}; }
}
export async function saveFoodMapData(data){
  try {
    const normalized=normalizeFoodMapData(data);
    const serialized=JSON.stringify(normalized);
    if(hasSupabaseConfig()) await updateSharedCollection(normalized);
    try { localStorage.setItem(STORAGE_KEY,serialized); }
    catch(error){ console.warn("로컬 캐시를 저장하지 못했지만 서버 저장은 완료됐습니다.",error); }
    return true;
  } catch(error){ console.error("맛집을 서버에 저장하지 못했습니다.",error); return false; }
}
export function validateImportedItem(item){
  if(!item||typeof item!=="object"||Array.isArray(item)) return false;
  if(typeof item.id!=="string"||!item.id.trim()||item.id.length>100) return false;
  if(typeof item.name!=="string"||!item.name.trim()||item.name.length>40) return false;
  if(typeof item.address!=="string"||!item.address.trim()||item.address.length>100) return false;
  if(normalizeCoordinate(item.lat,LATITUDE_RANGE)===null||normalizeCoordinate(item.lng,LONGITUDE_RANGE)===null) return false;
  if(item.status!==undefined&&!["visited","wishlist"].includes(item.status)) return false;
  if(item.rating!==undefined&&item.rating!==null&&item.rating!==""&&(!Number.isFinite(Number(item.rating))||Number(item.rating)<0||Number(item.rating)>10)) return false;
  if(item.tags!==undefined&&!Array.isArray(item.tags)) return false;
  if(item.collections!==undefined&&!Array.isArray(item.collections)) return false;
  if(item.photos!==undefined&&!Array.isArray(item.photos)) return false;
  return true;
}
export function validateImportedData(records,collections=[]){
  if(!Array.isArray(records)||records.length>RESTAURANT_BACKUP_LIMIT||!records.every(validateImportedItem)) return false;
  if(!Array.isArray(collections)||collections.length>COLLECTION_LIMIT||collections.some(name=>typeof name!=="string"||!name.trim()||name.length>COLLECTION_NAME_MAX_LENGTH)) return false;
  const ids=records.map(item=>item.id);
  return new Set(ids).size===ids.length;
}
