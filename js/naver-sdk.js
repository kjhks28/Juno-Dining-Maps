import { loadRuntimeConfig } from "./config.js";

const runtimeConfig = await loadRuntimeConfig();
let sdkPromise = null;
const SDK_TIMEOUT_MS = 15000;

export function hasNaverClientId(){ return Boolean(runtimeConfig.naverMapClientId); }

export function loadNaverSdk(){
  if(window.naver?.maps?.Map && window.naver?.maps?.Service) return Promise.resolve(window.naver.maps);
  if(!runtimeConfig.naverMapClientId) return Promise.reject(new Error("네이버 지도 Client ID가 설정되지 않았습니다."));
  if(sdkPromise) return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(callback,value)=>{ if(settled) return;settled=true;clearInterval(readinessTimer);clearTimeout(timeoutTimer);callback(value); };
    const checkReadiness=()=>{ if(window.naver?.maps?.Map&&window.naver?.maps?.Service) finish(resolve,window.naver.maps); };
    const script=document.createElement("script");
    script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(runtimeConfig.naverMapClientId)}&submodules=geocoder`;
    script.onload=checkReadiness;
    script.onerror=()=>finish(reject,new Error("네이버 지도 SDK 연결에 실패했습니다."));
    window.navermap_authFailure=()=>finish(reject,new Error("네이버 지도 인증에 실패했습니다. Web 서비스 URL과 Client ID를 확인해 주세요."));
    const readinessTimer=setInterval(checkReadiness,100);
    const timeoutTimer=setTimeout(()=>finish(reject,new Error("네이버 지도 SDK 준비 시간이 초과됐습니다.")),SDK_TIMEOUT_MS);
    document.head.append(script);
  });
  return sdkPromise;
}
