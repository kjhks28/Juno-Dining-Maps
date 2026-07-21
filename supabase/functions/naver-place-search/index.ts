import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

function jsonResponse(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...CORS_HEADERS,"Content-Type":"application/json; charset=utf-8"}});
}

function stripMarkup(value:unknown){
  return String(value??"").replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim();
}

async function isAuthenticated(request:Request){
  const authorization=request.headers.get("Authorization")??"";
  if(!authorization.startsWith("Bearer ")) return false;
  const supabaseUrl=Deno.env.get("SUPABASE_URL")??"";
  const supabaseAnonKey=Deno.env.get("SUPABASE_ANON_KEY")??"";
  if(!supabaseUrl||!supabaseAnonKey) return false;
  const client=createClient(supabaseUrl,supabaseAnonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const {data,error}=await client.auth.getUser();
  return !error&&Boolean(data.user);
}

Deno.serve(async request=>{
  if(request.method==="OPTIONS") return new Response("ok",{headers:CORS_HEADERS});
  if(request.method!=="POST") return jsonResponse({error:"POST 요청만 지원합니다."},405);
  try {
    if(!await isAuthenticated(request)) return jsonResponse({error:"관리자 로그인이 필요합니다."},401);
    const body=await request.json().catch(()=>null);
    const query=String(body?.query??"").trim();
    if(query.length<2||query.length>80) return jsonResponse({error:"검색어를 2~80자로 입력해 주세요."},400);
    const clientId=Deno.env.get("NAVER_SEARCH_CLIENT_ID")??"";
    const clientSecret=Deno.env.get("NAVER_SEARCH_CLIENT_SECRET")??"";
    if(!clientId||!clientSecret) return jsonResponse({error:"네이버 지역검색 설정을 확인해 주세요."},500);
    const url=new URL("https://openapi.naver.com/v1/search/local.json");
    url.searchParams.set("query",query);
    url.searchParams.set("display","5");
    url.searchParams.set("sort","random");
    const response=await fetch(url,{headers:{"X-Naver-Client-Id":clientId,"X-Naver-Client-Secret":clientSecret},signal:AbortSignal.timeout(8000)});
    if(!response.ok){console.error("Naver local search failed",response.status);return jsonResponse({error:"네이버 상호명 검색에 실패했습니다."},502);}
    const data=await response.json();
    const places=(Array.isArray(data.items)?data.items:[]).map((item:Record<string,unknown>)=>({
      name:stripMarkup(item.title),
      category:stripMarkup(item.category),
      roadAddress:stripMarkup(item.roadAddress)||stripMarkup(item.address),
      jibunAddress:stripMarkup(item.address)
    })).filter((item:{name:string;roadAddress:string})=>item.name&&item.roadAddress);
    return jsonResponse({places});
  } catch(error){
    console.error("Place search error",error instanceof Error?error.message:"unknown");
    return jsonResponse({error:"상호명을 검색하지 못했습니다. 잠시 후 다시 시도해 주세요."},500);
  }
});
