import { loadNaverSdk } from "./naver-sdk.js";

const INITIAL_CENTER = { lat:37.557,lng:126.99 };
const TILE_TIMEOUT_MS = 12000;

function showMapError(message){ const container=document.querySelector("#map"); container.innerHTML=`<div class="map-error"><strong>지도를 불러오지 못했어요</strong><span>${message}</span><small>네이버 클라우드의 Web 서비스 URL과 Client ID를 확인해 주세요.</small></div>`; }
function createUnavailableController(){ return {renderMarkers(){},focus(){},locate(){return Promise.reject(new Error("지도를 사용할 수 없습니다."));}}; }
function waitForTiles(maps,map){ return new Promise((resolve,reject)=>{ let settled=false; const timeout=setTimeout(()=>{if(!settled){settled=true;reject(new Error("네이버 지도 타일을 불러오지 못했습니다. Dynamic Map 설정과 Web 서비스 URL을 확인해 주세요."));}},TILE_TIMEOUT_MS); maps.Event.once(map,"tilesloaded",()=>{if(!settled){settled=true;clearTimeout(timeout);resolve();}}); }); }

export async function createMapController(){
  try {
    const maps=await loadNaverSdk();
    const map=new maps.Map("map",{center:new maps.LatLng(INITIAL_CENTER.lat,INITIAL_CENTER.lng),zoom:12,zoomControl:true,zoomControlOptions:{position:maps.Position.LEFT_BOTTOM},mapDataControl:true,scaleControl:false});
    await waitForTiles(maps,map);
    const records=new Map();
    let openedInfoWindow=null;

    function clearMarkers(){ records.forEach(({marker,infoWindow})=>{marker.setMap(null);infoWindow.close();}); records.clear();openedInfoWindow=null; }
    function openInfoWindow(record){ openedInfoWindow?.close(); record.infoWindow.open(map,record.marker);openedInfoWindow=record.infoWindow; }
    function renderMarkers(items,{getIconContent,getPopupContent,onSelect}){
      clearMarkers();
      items.forEach(item=>{
        const marker=new maps.Marker({map,position:new maps.LatLng(item.lat,item.lng),title:item.name,icon:{content:getIconContent(item),size:new maps.Size(36,42),anchor:new maps.Point(18,40)}});
        const infoWindow=new maps.InfoWindow({content:getPopupContent(item),borderWidth:0,backgroundColor:"transparent",disableAnchor:true,pixelOffset:new maps.Point(0,-35)});
        const record={marker,infoWindow}; records.set(item.id,record);
        maps.Event.addListener(marker,"click",()=>{openInfoWindow(record);onSelect(item.id);});
      });
    }
    function focus(id,item){ const position=new maps.LatLng(item.lat,item.lng);map.setCenter(position);map.setZoom(16);const record=records.get(id);if(record) openInfoWindow(record); }
    function locate(){ return new Promise((resolve,reject)=>{ if(!navigator.geolocation){reject(new Error("현재 위치 기능을 지원하지 않는 브라우저입니다."));return;} navigator.geolocation.getCurrentPosition(position=>{map.setCenter(new maps.LatLng(position.coords.latitude,position.coords.longitude));map.setZoom(15);resolve();},()=>reject(new Error("현재 위치 권한을 확인해 주세요.")),{enableHighAccuracy:true,timeout:8000}); }); }
    return {renderMarkers,focus,locate};
  } catch(error){ console.error("네이버 지도를 초기화하지 못했습니다.",error);showMapError(error instanceof Error?error.message:"지도 초기화 오류");return createUnavailableController(); }
}
