import { CATEGORY_ICONS, REVISIT_LABELS, TAG_OPTIONS } from "./js/constants.js";
import { searchNaverAddresses } from "./js/geocoding.js";
import { preparePhotos } from "./js/images.js";
import { createMapController } from "./js/map.js";
import { getDistrict, getProvince } from "./js/regions.js";
import { loadRestaurants, normalizeRestaurant, saveRestaurants, validateImportedItem } from "./js/storage.js";

let restaurants = loadRestaurants();
let activeRegion = "전체";
let activeProvince = "전체";
let activeCategory = "전체";
let activeTag = "전체";
let activeStatus = "all";
let activeId = null;
let editingId = null;
let selectedAddressResult = null;
const mapController = await createMapController();

const elements = {
  list:document.querySelector("#restaurantList"), empty:document.querySelector("#emptyState"),
  provinces:document.querySelector("#provinceFilters"), regions:document.querySelector("#regionFilters"), categories:document.querySelector("#categoryFilters"), tags:document.querySelector("#tagFilters"), statusFilters:document.querySelector("#statusFilters"),
  search:document.querySelector("#searchInput"), sort:document.querySelector("#sortSelect"),
  dialog:document.querySelector("#restaurantDialog"), form:document.querySelector("#restaurantForm"), addressResults:document.querySelector("#addressResults"), addressStatus:document.querySelector("#addressSearchStatus"),
  status:document.querySelector("#formStatus")
};

function escapeText(value){ const node=document.createElement("span"); node.textContent=String(value); return node.innerHTML; }
function hasRating(item){ return item.rating!==null&&item.rating!==""&&Number.isFinite(Number(item.rating)); }
function getFilteredRestaurants(){
  const query=elements.search.value.trim().toLowerCase();
  const filtered=restaurants.filter(item=>(activeStatus==="all"||item.status===activeStatus)&&(activeProvince==="전체"||getProvince(item)===activeProvince)&&(activeRegion==="전체"||getDistrict(item)===activeRegion)&&(activeCategory==="전체"||item.category===activeCategory)&&(activeTag==="전체"||item.tags.includes(activeTag))&&(!query||[item.name,item.category,item.subcategory,item.region,item.address,item.comment,item.description,item.menuReviews,...item.tags].some(value=>String(value).toLowerCase().includes(query))));
  return filtered.sort((a,b)=>elements.sort.value==="newest"?new Date(b.createdAt)-new Date(a.createdAt):elements.sort.value==="name"?a.name.localeCompare(b.name,"ko"):(hasRating(b)?Number(b.rating):-1)-(hasRating(a)?Number(a.rating):-1));
}
function createChip(label,type,value=label){
  const selected=type==="province"?activeProvince:type==="region"?activeRegion:type==="category"?activeCategory:type==="tag"?activeTag:activeStatus; const button=document.createElement("button"); button.className=`chip ${selected===value?"active":""}`; button.textContent=label;
  button.addEventListener("click",()=>{ let moveMap=false; if(type==="province"){activeProvince=value;activeRegion="전체";moveMap=true;} else if(type==="region"){activeRegion=value;moveMap=true;} else if(type==="category") activeCategory=value; else if(type==="tag") activeTag=value; else activeStatus=value; render(); if(moveMap) mapController.focusArea(getFilteredRestaurants()); }); return button;
}
function renderFilters(){
  const provinces=["전체",...new Set(restaurants.map(getProvince))];
  const regions=["전체",...new Set(restaurants.filter(item=>getProvince(item)===activeProvince).map(getDistrict))]; const categories=["전체",...new Set(restaurants.map(item=>item.category))];
  elements.provinces.replaceChildren(...provinces.map(value=>createChip(value,"province")));
  elements.regions.replaceChildren(...regions.map(value=>createChip(value,"region")));
  elements.regions.hidden=activeProvince==="전체";
  elements.categories.replaceChildren(...categories.map(value=>createChip(value,"category")));
  const tags=["전체",...TAG_OPTIONS.filter(tag=>restaurants.some(item=>item.tags.includes(tag)))];
  elements.tags.replaceChildren(...tags.map(value=>createChip(value,"tag")));
  elements.statusFilters.replaceChildren(createChip("전체","status","all"),createChip("다녀온 곳","status","visited"),createChip("가고 싶은 곳","status","wishlist"));
}
function renderMarkers(items){
  mapController.renderMarkers(items,{getIconContent:item=>`<div class="custom-marker"><span>${escapeText(CATEGORY_ICONS[item.category]||"맛")}</span></div>`,getPopupContent:item=>`<div class="naver-popup"><div class="popup-name">${escapeText(item.name)}</div><div class="popup-meta">${escapeText(item.subcategory)} · ${hasRating(item)?`${item.rating}/10`:"평점 미등록"}</div></div>`,onSelect:id=>selectRestaurant(id,false)});
}
function renderCards(items){
  elements.list.innerHTML=items.map(item=>{ const score=hasRating(item)?`${item.rating}<small>/10</small>`:"<small>평점 없음</small>"; const photo=item.photos[0]?`<img class="card-photo" src="${item.photos[0]}" alt="">`:""; const menus=item.menuReviews?`<div class="menu-reviews">${escapeText(item.menuReviews).replace(/\n/g,"<br>")}</div>`:""; const tags=item.tags.length?`<div class="card-tags">${item.tags.map(tag=>`<span>#${escapeText(tag)}</span>`).join("")}</div>`:""; const visit=item.status==="wishlist"?"가고 싶은 곳":`${item.visitDate||"날짜 미등록"} · ${item.visitCount}회 방문`; const revisit=item.status==="visited"?`<br>${escapeText(REVISIT_LABELS[item.revisit]||REVISIT_LABELS.unknown)}`:""; const visitLabel=item.status==="wishlist"?"✓ 방문 완료":"＋ 오늘 방문"; return `<article class="restaurant-card ${activeId===item.id?"active":""}" data-id="${escapeText(item.id)}">${photo}<div class="card-body"><div class="card-top"><span class="category-dot"></span><span class="card-category">${escapeText(item.category)} · ${escapeText(item.subcategory)}</span><span class="card-region">${escapeText(item.region)}</span><span class="status-label ${item.status}">${visit}</span></div><h3>${escapeText(item.name)}</h3><p>“${escapeText(item.comment)}”</p>${tags}<span class="rating">${score}</span><div class="card-detail">${escapeText(item.description)}<br>${escapeText(item.address)}${revisit}${menus}<div class="card-actions"><button class="visit-button" data-visit="${escapeText(item.id)}">${visitLabel}</button><button class="edit-button" data-edit="${escapeText(item.id)}">수정</button><button class="delete-button" data-delete="${escapeText(item.id)}">기록 삭제</button></div></div></div></article>`; }).join("");
  elements.empty.hidden=items.length>0; elements.list.hidden=items.length===0;
  elements.list.querySelectorAll(".restaurant-card").forEach(card=>card.addEventListener("click",event=>{ if(event.target.matches("[data-visit]")){recordVisit(event.target.dataset.visit);return;} if(event.target.matches("[data-edit]")){openEditForm(event.target.dataset.edit);return;} if(event.target.matches("[data-delete]")){deleteRestaurant(event.target.dataset.delete);return;} selectRestaurant(card.dataset.id,true); }));
}
function render(){
  renderFilters(); const items=getFilteredRestaurants(); renderCards(items); renderMarkers(items);
  const query=elements.search.value.trim();
  const regionLabel=activeRegion!=="전체"?activeRegion:activeProvince!=="전체"?activeProvince:"전체 지역";
  document.querySelector("#mapCount").textContent=items.length; document.querySelector("#totalBadge").textContent=`${restaurants.length}곳`; document.querySelector("#resultText").textContent=query?`‘${query}’ 검색 결과 · ${items.length}곳`:`${regionLabel} · ${items.length}곳`; document.querySelector("#clearSearch").hidden=!query;
}
function selectRestaurant(id,moveMap){ activeId=activeId===id?null:id; renderCards(getFilteredRestaurants()); const item=restaurants.find(place=>place.id===id); if(item&&moveMap) mapController.focus(id,item); }
function deleteRestaurant(id){ if(!window.confirm("이 맛집 기록을 삭제할까요?")) return; restaurants=restaurants.filter(item=>item.id!==id); activeId=null; saveRestaurants(restaurants); render(); }
function getLocalDate(){ const now=new Date(); const offset=now.getTimezoneOffset()*60000; return new Date(now.getTime()-offset).toISOString().slice(0,10); }
function recordVisit(id){
  const item=restaurants.find(place=>place.id===id); if(!item) return; const savedCount=Number.isFinite(Number(item.visitCount))?Number(item.visitCount):0; const count=item.status==="wishlist"?0:savedCount;
  restaurants=restaurants.map(place=>place.id===id?{...place,status:"visited",visitDate:getLocalDate(),visitCount:count+1,updatedAt:new Date().toISOString()}:place); saveRestaurants(restaurants); render();
}
function setFormValue(name,value){ const field=elements.form.elements.namedItem(name); if(field) field.value=String(value); }
function setTagValues(tags=[]){ elements.form.querySelectorAll('input[name="tags"]').forEach(input=>{input.checked=tags.includes(input.value);}); }
function resetAddressSearch(){ selectedAddressResult=null;elements.addressStatus.textContent="";elements.addressResults.replaceChildren();elements.addressResults.hidden=true; }
function openCreateForm(){ editingId=null; elements.form.reset(); resetAddressSearch(); setFormValue("visitCount",1); elements.status.textContent=""; document.querySelector("#dialogEyebrow").textContent="NEW PLACE"; document.querySelector("#dialogTitle").textContent="맛집 기록하기"; document.querySelector("#submitFormButton").textContent="지도에 기록하기"; elements.dialog.showModal(); }
function openEditForm(id){
  const item=restaurants.find(place=>place.id===id); if(!item) return;
  editingId=id; resetAddressSearch(); elements.status.textContent=""; ["status","visitDate","name","address","region","category","subcategory","rating","visitCount","revisit","menuReviews","comment","description"].forEach(name=>setFormValue(name,item[name]??"")); setTagValues(item.tags);
  document.querySelector("#dialogEyebrow").textContent="EDIT PLACE"; document.querySelector("#dialogTitle").textContent="맛집 수정하기"; document.querySelector("#submitFormButton").textContent="수정 내용 저장"; elements.dialog.showModal();
}
function closeForm(){ editingId=null; elements.form.reset(); elements.status.textContent=""; elements.dialog.close(); }
function renderAddressResults(results){
  elements.addressResults.replaceChildren(...results.map(result=>{const button=document.createElement("button");button.type="button";button.className="address-result";const road=document.createElement("strong");road.textContent=result.roadAddress;const jibun=document.createElement("span");jibun.textContent=result.jibunAddress?`지번 ${result.jibunAddress}`:"지번 주소 없음";button.append(road,jibun);button.addEventListener("click",()=>{selectedAddressResult={...result,selectedAddress:result.roadAddress};setFormValue("address",result.roadAddress);elements.addressStatus.textContent="네이버 지도 위치를 선택했습니다.";elements.addressResults.hidden=true;mapController.moveTo(result.lat,result.lng);});return button;}));
  elements.addressResults.hidden=results.length===0;
}
async function searchAddress(){
  const button=document.querySelector("#searchAddressButton"); const address=String(elements.form.elements.namedItem("address").value).trim(); button.disabled=true;elements.addressStatus.textContent="네이버 지도에서 검색하는 중…";elements.addressResults.hidden=true;
  try { const results=await searchNaverAddresses(address); if(results.length===0) throw new Error("검색 결과가 없습니다."); renderAddressResults(results);elements.addressStatus.textContent=`검색 결과 ${results.length}개 · 사용할 주소를 선택해 주세요.`; }
  catch(error){ console.error("네이버 주소 검색에 실패했습니다.",error);resetAddressSearch();elements.addressStatus.textContent=error instanceof Error?error.message:"주소를 검색하지 못했어요."; }
  finally { button.disabled=false; }
}
async function handleSubmit(event){
  event.preventDefault(); const submit=elements.form.querySelector("[type=submit]"); const originalText=submit.textContent; submit.disabled=true; submit.textContent="저장하는 중…"; elements.status.textContent="";
  try { const data=new FormData(elements.form); const status=String(data.get("status")); const rawRating=String(data.get("rating")).trim(); const rating=rawRating===""?null:Number(rawRating); if(status==="visited"&&!Number.isFinite(rating)) throw new Error("다녀온 맛집은 평점을 입력해 주세요."); if(rating!==null&&(!Number.isFinite(rating)||rating<0||rating>10)) throw new Error("평점은 0점부터 10점 사이로 입력해 주세요."); const previous=editingId?restaurants.find(item=>item.id===editingId):null; const address=String(data.get("address")).trim(); const region=String(data.get("region")).trim(); const tags=data.getAll("tags").map(String).filter(tag=>TAG_OPTIONS.includes(tag)); const selectedCoords=selectedAddressResult?.selectedAddress===address?{lat:selectedAddressResult.lat,lng:selectedAddressResult.lng,coordinateSource:"naver",roadAddress:selectedAddressResult.roadAddress}:null; const previousCoords=previous&&previous.address===address?{lat:previous.lat,lng:previous.lng,coordinateSource:previous.coordinateSource,roadAddress:previous.roadAddress}:null; const coords=selectedCoords??previousCoords; if(!coords) throw new Error("네이버 주소 검색 후 사용할 위치를 선택해 주세요."); const photos=await preparePhotos(elements.form.elements.namedItem("photos").files,previous); const item={id:previous?.id??crypto.randomUUID(),status,visitDate:String(data.get("visitDate")),name:String(data.get("name")).trim(),address,region,category:String(data.get("category")),subcategory:String(data.get("subcategory")).trim(),rating,visitCount:Number(data.get("visitCount")||0),revisit:String(data.get("revisit")),menuReviews:String(data.get("menuReviews")).trim(),tags,photos,comment:String(data.get("comment")).trim(),description:String(data.get("description")).trim(),...coords,createdAt:previous?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()}; if(previous) restaurants=restaurants.map(place=>place.id===item.id?item:place); else restaurants.unshift(item); if(!saveRestaurants(restaurants)) throw new Error("브라우저 저장 공간을 확인해 주세요."); closeForm(); activeStatus="all"; activeProvince="전체"; activeRegion="전체"; activeCategory="전체"; activeTag="전체"; render(); selectRestaurant(item.id,true); }
  catch(error){ elements.status.textContent=error instanceof Error?error.message:"맛집을 저장하지 못했어요."; }
  finally { submit.disabled=false; submit.textContent=originalText; }
}
function exportBackup(){ const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),restaurants},null,2)],{type:"application/json"}); const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`juno-food-list-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); }
async function importBackup(event){
  const file=event.target.files[0]; event.target.value=""; if(!file) return; if(file.size>20*1024*1024){window.alert("백업 파일은 20MB 이하만 불러올 수 있어요.");return;}
  try { const parsed=JSON.parse(await file.text()); const records=Array.isArray(parsed)?parsed:parsed.restaurants; if(!Array.isArray(records)||!records.every(validateImportedItem)) throw new Error("형식 오류"); if(!window.confirm(`현재 기록을 백업의 ${records.length}개 기록으로 교체할까요?`)) return; restaurants=records.map(normalizeRestaurant); activeStatus="all";activeProvince="전체";activeRegion="전체";activeCategory="전체";activeTag="전체";activeId=null;saveRestaurants(restaurants);render();window.alert("백업을 성공적으로 불러왔어요."); }
  catch(error){ console.error("백업을 불러오지 못했습니다.",error); window.alert("올바른 Juno 맛집 리스트 백업 파일이 아니에요."); }
}

document.querySelector("#openFormButton").addEventListener("click",openCreateForm);
["#closeFormButton","#cancelFormButton"].forEach(selector=>document.querySelector(selector).addEventListener("click",closeForm));
document.querySelector("#resetFilters").addEventListener("click",()=>{activeStatus="all";activeProvince="전체";activeRegion="전체";activeCategory="전체";activeTag="전체";elements.search.value="";render();mapController.focusArea(restaurants);});
document.querySelector("#locateButton").addEventListener("click",async()=>{try{await mapController.locate();}catch(error){window.alert(error instanceof Error?error.message:"현재 위치를 찾지 못했어요.");}});
elements.form.addEventListener("submit",handleSubmit); elements.search.addEventListener("input",render); elements.sort.addEventListener("change",render);
document.querySelector("#clearSearch").addEventListener("click",()=>{elements.search.value="";elements.search.focus();render();});
document.querySelector("#searchAddressButton").addEventListener("click",searchAddress); elements.form.elements.namedItem("address").addEventListener("input",resetAddressSearch); elements.form.elements.namedItem("address").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();searchAddress();}});
document.querySelector("#exportButton").addEventListener("click",exportBackup); document.querySelector("#importButton").addEventListener("click",()=>document.querySelector("#importInput").click()); document.querySelector("#importInput").addEventListener("change",importBackup);
document.querySelector("#tagOptions").replaceChildren(...TAG_OPTIONS.map(tag=>{const label=document.createElement("label");label.className="tag-option";const input=document.createElement("input");input.type="checkbox";input.name="tags";input.value=tag;label.append(input,document.createTextNode(tag));return label;}));
render();
