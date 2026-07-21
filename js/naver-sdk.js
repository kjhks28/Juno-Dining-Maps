import { loadRuntimeConfig } from "./config.js";

const runtimeConfig = await loadRuntimeConfig();
let sdkPromise = null;

export function hasNaverClientId(){ return Boolean(runtimeConfig.naverMapClientId); }

export function loadNaverSdk(){
  if(window.naver?.maps?.Map && window.naver?.maps?.Service) return Promise.resolve(window.naver.maps);
  if(!runtimeConfig.naverMapClientId) return Promise.reject(new Error("네이버 지도 Client ID가 설정되지 않았습니다."));
  if(sdkPromise) return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(runtimeConfig.naverMapClientId)}&submodules=geocoder`;
    script.onload=()=>window.naver?.maps?.Map&&window.naver?.maps?.Service?resolve(window.naver.maps):reject(new Error("네이버 지도 SDK 초기화에 실패했습니다."));
    script.onerror=()=>reject(new Error("네이버 지도 SDK 연결에 실패했습니다."));
    document.head.append(script);
  });
  return sdkPromise;
}
