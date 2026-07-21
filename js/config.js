const DEFAULT_CONFIG = Object.freeze({ naverMapClientId:"" });

export async function loadRuntimeConfig(){
  try {
    const localConfig = await import("./config.local.js");
    return Object.freeze({ naverMapClientId:String(localConfig.NAVER_MAP_CLIENT_ID??"").trim() });
  } catch(error) {
    console.info("로컬 지도 설정이 없어 기본 지도 설정을 사용합니다.");
    return DEFAULT_CONFIG;
  }
}
