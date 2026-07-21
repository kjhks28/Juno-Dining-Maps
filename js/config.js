const DEFAULT_CONFIG = Object.freeze({ naverMapClientId:"" });

export async function loadRuntimeConfig(){
  try {
    const localConfig = await import("./config.local.js");
    const clientId=String(localConfig.NAVER_MAP_CLIENT_ID??"").trim();
    return Object.freeze({ naverMapClientId:clientId==="YOUR_NAVER_MAP_CLIENT_ID"?"":clientId });
  } catch(error) {
    console.info("로컬 지도 설정이 없어 기본 지도 설정을 사용합니다.");
    return DEFAULT_CONFIG;
  }
}
