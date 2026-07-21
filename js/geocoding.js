import { loadRuntimeConfig } from "./config.js";
import { KOREAN_PROVINCES } from "./constants.js";

const runtimeConfig = await loadRuntimeConfig();
let naverSdkPromise = null;

function findProvince(address,region){ const text=`${address} ${region}`; return Object.entries(KOREAN_PROVINCES).find(([,cities])=>cities.some(city=>text.includes(city)))?.[0]??""; }
function enrichAddress(address,region){ const province=findProvince(address,region); return [province,address].filter(Boolean).join(", "); }
function loadNaverSdk(){
  if(window.naver?.maps?.Service) return Promise.resolve();
  if(naverSdkPromise) return naverSdkPromise;
  naverSdkPromise=new Promise((resolve,reject)=>{ const script=document.createElement("script"); script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(runtimeConfig.naverMapClientId)}&submodules=geocoder`; script.onload=()=>window.naver?.maps?.Service?resolve():reject(new Error("네이버 지도 SDK를 불러오지 못했습니다.")); script.onerror=()=>reject(new Error("네이버 지도 SDK 연결에 실패했습니다.")); document.head.append(script); });
  return naverSdkPromise;
}
async function requestNaverGeocode(query){
  await loadNaverSdk();
  return new Promise((resolve,reject)=>window.naver.maps.Service.geocode({query},(status,response)=>{ if(status!==window.naver.maps.Service.Status.OK){reject(new Error("네이버 주소 검색에 실패했습니다."));return;} const result=response.v2?.addresses?.[0]; resolve(result?{lat:Number(result.y),lng:Number(result.x),coordinateSource:"naver",roadAddress:result.roadAddress||query}:null); }));
}
async function requestOsmGeocode(query){
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),8000);
  try { const params=new URLSearchParams({format:"jsonv2",limit:"1",countrycodes:"kr",q:query}); const response=await fetch(`https://nominatim.openstreetmap.org/search?${params}`,{signal:controller.signal,headers:{"Accept-Language":"ko"}}); if(!response.ok) throw new Error(`HTTP ${response.status}`); const results=await response.json(); const result=Array.isArray(results)?results[0]??null:null; return result?{lat:Number(result.lat),lng:Number(result.lon),coordinateSource:"osm",roadAddress:query}:null; }
  finally { clearTimeout(timeout); }
}
async function searchWithFallback(request,address,region){ let result=await request(address); if(result) return result; const enriched=enrichAddress(address,region); if(enriched===address) return null; return request(enriched); }

export async function geocodeAddress(address,region){
  try {
    if(runtimeConfig.naverMapClientId) {
      try { const result=await searchWithFallback(requestNaverGeocode,address,region); if(result) return result; }
      catch(error){ console.error("네이버 주소 검색을 사용할 수 없어 대체 검색을 시도합니다.",error); }
    }
    const result=await searchWithFallback(requestOsmGeocode,address,region); if(!result) throw new Error("검색 결과 없음"); return result;
  } catch(error){ console.error("주소 좌표를 찾지 못했습니다.",error); throw new Error("주소를 찾지 못했어요. 도·광역시를 포함한 도로명 주소로 다시 입력해 주세요."); }
}
