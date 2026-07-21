const DEFAULT_CONFIG = Object.freeze({ naverMapClientId:"",supabaseUrl:"",supabasePublishableKey:"" });

export async function loadRuntimeConfig(){
  try {
    const localConfig = await import("./config.local.js");
    const clientId=String(localConfig.NAVER_MAP_CLIENT_ID??"").trim();
    const supabaseUrl=String(localConfig.SUPABASE_URL??"").trim();
    const supabasePublishableKey=String(localConfig.SUPABASE_PUBLISHABLE_KEY??"").trim();
    return Object.freeze({ naverMapClientId:clientId==="YOUR_NAVER_MAP_CLIENT_ID"?"":clientId,supabaseUrl,supabasePublishableKey });
  } catch(error) {
    console.info("로컬 지도 설정이 없어 기본 지도 설정을 사용합니다.");
    return DEFAULT_CONFIG;
  }
}
