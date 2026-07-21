import { hasNaverClientId, loadNaverSdk } from "./naver-sdk.js";
import { getProvince } from "./regions.js";

function enrichAddress(address,region){ const province=getProvince({address,region}); return [province==="기타 지역"?"":province,address].filter(Boolean).join(", "); }
async function requestNaverGeocode(query){
  const results=await searchNaverAddresses(query);
  return results[0]??null;
}

function getAddressElement(result,type){
  const elements=Array.isArray(result?.addressElements)?result.addressElements:[];
  const element=elements.find(item=>Array.isArray(item.types)&&item.types.includes(type));
  return String(element?.longName??element?.shortName??"").trim();
}

export function getRegionFromNaverAddress(result){
  const province=getAddressElement(result,"SIDO");
  const district=getAddressElement(result,"SIGUGUN");
  return [province,district].filter(Boolean).join(" ");
}

export async function searchNaverAddresses(query){
  const normalizedQuery=String(query??"").trim();
  if(normalizedQuery.length<2) throw new Error("검색할 주소를 두 글자 이상 입력해 주세요.");
  await loadNaverSdk();
  return new Promise((resolve,reject)=>window.naver.maps.Service.geocode({query:normalizedQuery},(status,response)=>{
    if(status!==window.naver.maps.Service.Status.OK){reject(new Error("네이버 주소 검색에 실패했습니다."));return;}
    const addresses=Array.isArray(response.v2?.addresses)?response.v2.addresses:[];
    const results=addresses.slice(0,5).map(result=>({lat:Number(result.y),lng:Number(result.x),coordinateSource:"naver",roadAddress:result.roadAddress||result.jibunAddress||normalizedQuery,jibunAddress:result.jibunAddress||"",region:getRegionFromNaverAddress(result)})).filter(result=>Number.isFinite(result.lat)&&Number.isFinite(result.lng));
    resolve(results);
  }));
}
async function requestOsmGeocode(query){
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),8000);
  try { const params=new URLSearchParams({format:"jsonv2",limit:"1",countrycodes:"kr",q:query}); const response=await fetch(`https://nominatim.openstreetmap.org/search?${params}`,{signal:controller.signal,headers:{"Accept-Language":"ko"}}); if(!response.ok) throw new Error(`HTTP ${response.status}`); const results=await response.json(); const result=Array.isArray(results)?results[0]??null:null; return result?{lat:Number(result.lat),lng:Number(result.lon),coordinateSource:"osm",roadAddress:query}:null; }
  finally { clearTimeout(timeout); }
}
async function searchWithFallback(request,address,region){ let result=await request(address); if(result) return result; const enriched=enrichAddress(address,region); if(enriched===address) return null; return request(enriched); }

export async function geocodeAddress(address,region){
  try {
    if(hasNaverClientId()) {
      try { const result=await searchWithFallback(requestNaverGeocode,address,region); if(result) return result; }
      catch(error){ console.error("네이버 주소 검색을 사용할 수 없어 대체 검색을 시도합니다.",error); }
    }
    const result=await searchWithFallback(requestOsmGeocode,address,region); if(!result) throw new Error("검색 결과 없음"); return result;
  } catch(error){ console.error("주소 좌표를 찾지 못했습니다.",error); throw new Error("주소를 찾지 못했어요. 도·광역시를 포함한 도로명 주소로 다시 입력해 주세요."); }
}
