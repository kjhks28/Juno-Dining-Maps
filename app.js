import { CATEGORY_ICONS, COLLECTION_LIMIT, REVISIT_LABELS, TAG_OPTIONS } from "./js/constants.js";
import { geocodeAddress, searchNaverAddresses } from "./js/geocoding.js";
import { preparePhotos } from "./js/images.js";
import { getCollectionGroups, getRecommendationChoices, getStats, recommendMenu } from "./js/insights.js";
import { createMapController } from "./js/map.js";
import { getDistrict, getProvince } from "./js/regions.js";
import { matchesRestaurantSearch } from "./js/search.js";
import { loadFoodMapData, normalizeFoodMapData, saveFoodMapData, validateImportedData } from "./js/storage.js";
import { getAdminSession, hasSupabaseConfig, requestAdminMagicLink, searchNaverPlaces, signOutAdmin } from "./js/supabase.js";

const initialFoodMapData = await loadFoodMapData();
let restaurants = initialFoodMapData.restaurants;
let collectionNames = initialFoodMapData.collections;
let dataSource = initialFoodMapData.source;
let isAdmin = Boolean(await getAdminSession().catch(error=>{console.error("관리자 세션을 확인하지 못했습니다.",error);return null;}));
let activeRegion = "전체";
let activeProvince = "전체";
let activeCategory = "전체";
let activeTag = "전체";
let activeStatus = "all";
let activeId = null;
let editingId = null;
let selectedAddressResult = null;
let recommendationStep = "category";
let recommendationSelection = {};
let selectionMode = false;
const selectedRestaurantIds = new Set();
const mapController = await createMapController();

const elements = {
  list:document.querySelector("#restaurantList"), empty:document.querySelector("#emptyState"),
  provinces:document.querySelector("#provinceFilters"), regions:document.querySelector("#regionFilters"), categories:document.querySelector("#categoryFilters"), tags:document.querySelector("#tagFilters"), statusFilters:document.querySelector("#statusFilters"),
  search:document.querySelector("#searchInput"), sort:document.querySelector("#sortSelect"),
  dialog:document.querySelector("#restaurantDialog"), form:document.querySelector("#restaurantForm"), addressResults:document.querySelector("#addressResults"), addressStatus:document.querySelector("#addressSearchStatus"),
  status:document.querySelector("#formStatus"), activeFilterBar:document.querySelector("#activeFilterBar"),activeFilterSummary:document.querySelector("#activeFilterSummary"),toast:document.querySelector("#toast"),dataStatusBanner:document.querySelector("#dataStatusBanner"),
  statGrid:document.querySelector("#statGrid"),categoryChart:document.querySelector("#categoryChart"),regionChart:document.querySelector("#regionChart"),monthlyChart:document.querySelector("#monthlyChart"),collectionGrid:document.querySelector("#collectionGrid"),collectionCreateForm:document.querySelector("#collectionCreateForm"),collectionFormStatus:document.querySelector("#collectionFormStatus"),
  bulkBar:document.querySelector("#bulkBar"),bulkCollectionSelect:document.querySelector("#bulkCollectionSelect"),selectedCount:document.querySelector("#selectedCount"),recommendationProgress:document.querySelector("#recommendationProgress"),recommendationQuestion:document.querySelector("#recommendationQuestion"),recommendationOptions:document.querySelector("#recommendationOptions"),recommendationResult:document.querySelector("#recommendationResult")
};
let toastTimer=null;

async function persistFoodMap(nextRestaurants=restaurants,nextCollections=collectionNames){
  if(!await saveFoodMapData({restaurants:nextRestaurants,collections:nextCollections})) return false;
  restaurants=nextRestaurants;collectionNames=nextCollections;dataSource=hasSupabaseConfig()?"remote":"local";renderDataStatus();return true;
}

function escapeText(value){ const node=document.createElement("span"); node.textContent=String(value); return node.innerHTML; }
function hasRating(item){ return item.rating!==null&&item.rating!==""&&Number.isFinite(Number(item.rating)); }
function showToast(message){clearTimeout(toastTimer);elements.toast.textContent=message;elements.toast.hidden=false;requestAnimationFrame(()=>elements.toast.classList.add("visible"));toastTimer=setTimeout(()=>{elements.toast.classList.remove("visible");setTimeout(()=>{elements.toast.hidden=true;},180);},2200);}
function renderDataStatus(){elements.dataStatusBanner.hidden=dataSource!=="local-fallback";}
function getFilteredRestaurants(){
  const query=elements.search.value.trim();
  const filtered=restaurants.filter(item=>(activeStatus==="all"||item.status===activeStatus)&&(activeProvince==="전체"||getProvince(item)===activeProvince)&&(activeRegion==="전체"||getDistrict(item)===activeRegion)&&(activeCategory==="전체"||item.category===activeCategory)&&(activeTag==="전체"||item.tags.includes(activeTag))&&matchesRestaurantSearch(item,query));
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
  elements.regions.hidden=activeProvince==="전체"||regions.length<=1;
  elements.categories.replaceChildren(...categories.map(value=>createChip(value,"category")));
  const tags=["전체",...TAG_OPTIONS.filter(tag=>restaurants.some(item=>item.tags.includes(tag)))];
  elements.tags.replaceChildren(...tags.map(value=>createChip(value,"tag")));
  elements.statusFilters.replaceChildren(createChip("전체","status","all"),createChip("다녀온 곳","status","visited"),createChip("가고 싶은 곳","status","wishlist"));
  const selected=[activeStatus!=="all"?(activeStatus==="visited"?"다녀온 곳":"가고 싶은 곳"):"",activeProvince!=="전체"?activeProvince:"",activeRegion!=="전체"?activeRegion:"",activeCategory!=="전체"?activeCategory:"",activeTag!=="전체"?`#${activeTag}`:"",elements.search.value.trim()?`검색: ${elements.search.value.trim()}`:""].filter(Boolean);
  elements.activeFilterSummary.replaceChildren(...selected.map(value=>{const span=document.createElement("span");span.textContent=value;return span;}));elements.activeFilterBar.hidden=selected.length===0;
}
function renderMarkers(items){
  const mappable=items.filter(item=>Number.isFinite(Number(item.lat))&&Number.isFinite(Number(item.lng)));
  mapController.renderMarkers(mappable,{getIconContent:item=>`<div class="custom-marker"><span>${escapeText(CATEGORY_ICONS[item.category]||"맛")}</span></div>`,getPopupContent:item=>`<div class="naver-popup"><div class="popup-name">${escapeText(item.name)}</div><div class="popup-meta">${escapeText(item.subcategory)} · ${hasRating(item)?`${item.rating}/10`:"평점 미등록"}</div></div>`,onSelect:id=>selectRestaurant(id,false,true)});
}
function renderCards(items){
  elements.list.innerHTML=items.map(item=>{ const score=hasRating(item)?`${item.rating}<small>/10</small>`:"<small>평점 없음</small>"; const ratingClass=hasRating(item)&&Number(item.rating)>=8.5?" high":"";const photo=item.photos[0]?`<img class="card-photo" src="${item.photos[0]}" alt="">`:""; const menus=item.menuReviews?`<div class="menu-reviews">${escapeText(item.menuReviews).replace(/\n/g,"<br>")}</div>`:""; const tags=item.tags.length?`<div class="card-tags">${item.tags.map(tag=>`<span>#${escapeText(tag)}</span>`).join("")}</div>`:""; const collectionTags=(item.collections??[]).length?`<div class="card-collections">${item.collections.map(name=>`<span>▰ ${escapeText(name)}</span>`).join("")}</div>`:"";const selector=selectionMode&&isAdmin?`<label class="card-selector"><input type="checkbox" data-select-card="${escapeText(item.id)}" ${selectedRestaurantIds.has(item.id)?"checked":""}><span>선택</span></label>`:"";const picker=isAdmin&&collectionNames.length?`<details class="collection-picker"><summary>컬렉션 선택</summary><div>${collectionNames.map(name=>`<label><input type="checkbox" data-collection-toggle="${escapeText(item.id)}" data-collection-name="${escapeText(name)}" ${(item.collections??[]).includes(name)?"checked":""}>${escapeText(name)}</label>`).join("")}</div></details>`:""; const visit=item.status==="wishlist"?"가고 싶은 곳":`<span>${escapeText(item.visitDate||"날짜 미등록")}</span><span>${item.visitCount}회 방문</span>`; const revisit=item.status==="visited"?`<div class="revisit-label">${escapeText(REVISIT_LABELS[item.revisit]||REVISIT_LABELS.unknown)}</div>`:""; const visitLabel=item.status==="wishlist"?"✓ 방문 완료":"＋ 오늘 방문"; return `<article class="restaurant-card ${activeId===item.id?"active":""} ${selectedRestaurantIds.has(item.id)?"selected":""}" data-id="${escapeText(item.id)}">${selector}${photo}<div class="card-body"><div class="card-top"><span class="category-dot"></span><span class="card-category">${escapeText(item.category)} · ${escapeText(item.subcategory)}</span><span class="card-region">${escapeText(item.region)}</span></div><div class="status-label ${item.status}">${visit}</div><h3>${escapeText(item.name)}</h3><p>“${escapeText(item.comment)}”</p>${tags}${collectionTags}<span class="rating${ratingClass}">${score}</span><div class="card-detail"><p class="card-description">${escapeText(item.description)}</p><p class="card-address">${escapeText(item.address)}</p>${revisit}${menus}${picker}<div class="card-navigation"><button data-map="${escapeText(item.id)}">지도에서 보기</button></div><div class="card-actions"><button class="visit-button" data-visit="${escapeText(item.id)}">${visitLabel}</button><button class="edit-button" data-edit="${escapeText(item.id)}">수정</button><button class="delete-button" data-delete="${escapeText(item.id)}">기록 삭제</button></div></div></div></article>`; }).join("");
  elements.empty.hidden=items.length>0; elements.list.hidden=items.length===0;
  elements.list.querySelectorAll(".restaurant-card").forEach(card=>{
    card.addEventListener("mouseenter",()=>mapController.highlight(card.dataset.id,true));
    card.addEventListener("mouseleave",()=>mapController.highlight(card.dataset.id,false));
    card.addEventListener("click",event=>{ if(event.target.matches("[data-select-card]")){toggleRestaurantSelection(event.target.dataset.selectCard,event.target.checked);return;}if(event.target.matches("[data-collection-toggle]")){updateCardCollection(event.target.dataset.collectionToggle,event.target.dataset.collectionName,event.target.checked);return;}if(event.target.closest(".collection-picker"))return;if(event.target.matches("[data-map]")){showRestaurantOnMap(event.target.dataset.map);return;}if(event.target.matches("[data-visit]")){recordVisit(event.target.dataset.visit);return;} if(event.target.matches("[data-edit]")){openEditForm(event.target.dataset.edit);return;} if(event.target.matches("[data-delete]")){deleteRestaurant(event.target.dataset.delete);return;} selectRestaurant(card.dataset.id,true); });
  });
}
function render(){
  renderFilters(); const items=getFilteredRestaurants(); renderCards(items); renderMarkers(items);
  document.body.classList.toggle("admin-mode",isAdmin);document.querySelector("#openFormButton").hidden=!isAdmin;document.querySelector("#authButton").textContent=isAdmin?"로그아웃":"관리자 로그인";
  if(!isAdmin&&selectionMode){selectionMode=false;selectedRestaurantIds.clear();}renderBulkControls();
  const query=elements.search.value.trim();
  const regionLabel=activeRegion!=="전체"?activeRegion:activeProvince!=="전체"?activeProvince:"전체 지역";
  document.querySelector("#mapCount").textContent=items.length; document.querySelector("#totalBadge").textContent=`${restaurants.length}곳`; document.querySelector("#resultText").textContent=query?`‘${query}’ 검색 결과 · ${items.length}곳`:`${regionLabel} · ${items.length}곳`; document.querySelector("#clearSearch").hidden=!query;
  renderDataStatus();
}
function renderBulkControls(){
  const button=document.querySelector("#toggleSelectionButton");button.textContent=selectionMode?"선택 취소":"일괄 선택";elements.bulkBar.hidden=!selectionMode;
  elements.selectedCount.textContent=`${selectedRestaurantIds.size}개 선택`;
  const selectedValue=elements.bulkCollectionSelect.value;elements.bulkCollectionSelect.replaceChildren(new Option("컬렉션 선택",""),...collectionNames.map(name=>new Option(name,name)));elements.bulkCollectionSelect.value=collectionNames.includes(selectedValue)?selectedValue:"";
}
function toggleRestaurantSelection(id,checked){if(checked)selectedRestaurantIds.add(id);else selectedRestaurantIds.delete(id);renderCards(getFilteredRestaurants());renderBulkControls();}
function toggleSelectionMode(){selectionMode=!selectionMode;selectedRestaurantIds.clear();renderCards(getFilteredRestaurants());renderBulkControls();}
function selectAllVisibleRestaurants(){getFilteredRestaurants().forEach(item=>selectedRestaurantIds.add(item.id));renderCards(getFilteredRestaurants());renderBulkControls();}
async function updateCardCollection(id,name,checked){
  if(!isAdmin||!collectionNames.includes(name)) return;
  const nextRestaurants=restaurants.map(item=>{if(item.id!==id)return item;const next=new Set(item.collections??[]);if(checked)next.add(name);else next.delete(name);return {...item,collections:[...next],updatedAt:new Date().toISOString()};});
  if(!await persistFoodMap(nextRestaurants)){window.alert("컬렉션을 저장하지 못했습니다.");renderCards(getFilteredRestaurants());return;}renderCards(getFilteredRestaurants());showToast(checked?`${name} 컬렉션에 추가했습니다.`:`${name} 컬렉션에서 제외했습니다.`);
}
async function applyBulkCollection(){
  if(!isAdmin) return;
  const name=elements.bulkCollectionSelect.value;if(!name){window.alert("배정할 컬렉션을 선택해 주세요.");return;}if(selectedRestaurantIds.size===0){window.alert("맛집 카드를 하나 이상 선택해 주세요.");return;}
  const nextRestaurants=restaurants.map(item=>selectedRestaurantIds.has(item.id)?{...item,collections:[...new Set([...(item.collections??[]),name])],updatedAt:new Date().toISOString()}:item);
  if(!await persistFoodMap(nextRestaurants)){window.alert("컬렉션을 일괄 저장하지 못했습니다.");return;}const count=selectedRestaurantIds.size;selectionMode=false;selectedRestaurantIds.clear();render();showToast(`${count}개 맛집을 ${name} 컬렉션에 넣었습니다.`);
}
async function createCollectionFolder(event){
  event.preventDefault();elements.collectionFormStatus.textContent="";if(!isAdmin){elements.collectionFormStatus.textContent="관리자 로그인 후 폴더를 만들 수 있습니다.";return;}
  const input=event.currentTarget.elements.namedItem("collectionName");const name=String(input.value).trim();if(!name){elements.collectionFormStatus.textContent="컬렉션 이름을 입력해 주세요.";return;}if(collectionNames.includes(name)){elements.collectionFormStatus.textContent="이미 있는 컬렉션 이름입니다.";return;}if(collectionNames.length>=COLLECTION_LIMIT){elements.collectionFormStatus.textContent=`컬렉션은 최대 ${COLLECTION_LIMIT}개까지 만들 수 있습니다.`;return;}
  if(!await persistFoodMap(restaurants,[...collectionNames,name])){elements.collectionFormStatus.textContent="컬렉션 폴더를 저장하지 못했습니다.";return;}event.currentTarget.reset();renderCollections();renderBulkControls();showToast(`${name} 컬렉션 폴더를 만들었습니다.`);
}
function exportBackup(){ if(!isAdmin) return;const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),restaurants,collections:collectionNames},null,2)],{type:"application/json"}); const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`juno-food-map-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000); }
async function importBackup(event){
  const file=event.target.files[0]; event.target.value=""; if(!file) return; if(!isAdmin){window.alert("관리자 로그인 후 불러올 수 있습니다.");return;} if(file.size>20*1024*1024){window.alert("백업 파일은 20MB 이하만 불러올 수 있어요.");return;}
  try {
    const parsed=JSON.parse(await file.text()); const records=Array.isArray(parsed)?parsed:parsed.restaurants; const nextCollections=Array.isArray(parsed?.collections)?parsed.collections:collectionNames;
    if(!validateImportedData(records,nextCollections)) throw new Error("형식 오류");
    if(!window.confirm(`현재 공용 목록을 백업의 ${records.length}개 기록으로 교체할까요? 되돌릴 수 없습니다.`)) return;
    const normalizedBackup=normalizeFoodMapData({restaurants:records,collections:nextCollections});
    if(!await persistFoodMap(normalizedBackup.restaurants,normalizedBackup.collections)) throw new Error("서버에 저장하지 못했습니다.");
    activeStatus="all";activeProvince="전체";activeRegion="전체";activeCategory="전체";activeTag="전체";activeId=null;selectedRestaurantIds.clear();render();showToast("백업을 불러와 서버에 반영했습니다.");
  } catch(error){ console.error("백업을 불러오지 못했습니다.",error); window.alert("올바른 백업 파일이 아니에요."); }
}
function renderStats(){
  const stats=getStats(restaurants);
  const cards=[["전체 맛집",stats.total],["다녀온 곳",stats.visited],["가고 싶은 곳",stats.wishlist],["평균 평점",stats.averageRating]];
  elements.statGrid.innerHTML=cards.map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  renderBarChart(elements.categoryChart,stats.categoryCounts,"카테고리 통계를 만들 카드가 아직 없어요.");
  renderBarChart(elements.regionChart,stats.regionCounts,"지역 정보가 있는 카드가 아직 없어요.");
  renderBarChart(elements.monthlyChart,stats.monthlyCounts,"방문 날짜가 있는 카드가 아직 없어요.");
}
function renderBarChart(container,entries,emptyMessage){const maximum=Math.max(...entries.map(([,count])=>count),1);container.innerHTML=entries.length?entries.map(([label,count])=>`<div class="chart-row"><span title="${escapeText(label)}">${escapeText(label)}</span><div><i style="width:${Math.round(count/maximum*100)}%"></i></div><strong>${count}</strong></div>`).join(""):`<p class="panel-empty">${emptyMessage}</p>`;}
function renderCollections(){
  const groups=getCollectionGroups(restaurants,collectionNames);
  elements.collectionGrid.innerHTML=groups.length?groups.map(([name,items])=>`<section class="collection-card"><div><h3>▰ ${escapeText(name)}</h3><span>${items.length}곳</span></div>${items.length?`<ul>${items.map(item=>`<li><button type="button" data-collection-place="${escapeText(item.id)}"><strong>${escapeText(item.name)}</strong><small>${escapeText(item.subcategory||item.category||"메뉴 미등록")}</small></button></li>`).join("")}</ul>`:`<p>아직 담긴 맛집이 없는 폴더예요.</p>`}</section>`).join(""):`<p class="panel-empty">아직 컬렉션 폴더가 없어요. 위에서 첫 폴더를 만들어보세요.</p>`;
}
function resetRecommendation(){recommendationStep="category";recommendationSelection={};renderRecommendation();}
function renderRecommendation(){
  const steps={category:{progress:"1 / 3",question:"오늘은 어떤 종류가 당기나요?"},subcategory:{progress:"2 / 3",question:`${recommendationSelection.category} 중에서 더 끌리는 종류는요?`},menu:{progress:"3 / 3",question:"마지막으로 먹고 싶은 메뉴를 골라주세요."}};
  const choices=getRecommendationChoices(restaurants,recommendationStep,recommendationSelection);
  elements.recommendationProgress.textContent=steps[recommendationStep].progress;
  elements.recommendationQuestion.textContent=steps[recommendationStep].question;
  elements.recommendationOptions.replaceChildren(...choices.map(choice=>{const button=document.createElement("button");button.type="button";button.textContent=choice;button.addEventListener("click",()=>selectRecommendation(choice));return button;}));
  elements.recommendationResult.hidden=true;
  if(choices.length===0){elements.recommendationQuestion.textContent="추천에 사용할 메뉴가 아직 부족해요.";elements.recommendationOptions.innerHTML="<p class=\"panel-empty\">카드의 세부 카테고리와 메뉴별 평가를 채우면 메추가 시작됩니다.</p>";}
}
function selectRecommendation(choice){
  if(recommendationStep==="category"){recommendationSelection.category=choice;recommendationStep="subcategory";renderRecommendation();return;}
  if(recommendationStep==="subcategory"){recommendationSelection.subcategory=choice;recommendationStep="menu";renderRecommendation();return;}
  recommendationSelection.menu=choice;const item=recommendMenu(restaurants,recommendationSelection);elements.recommendationOptions.replaceChildren();elements.recommendationQuestion.textContent="오늘의 메추가 도착했어요!";elements.recommendationResult.innerHTML=item?`<span>${escapeText(recommendationSelection.category)} · ${escapeText(recommendationSelection.subcategory)}</span><strong>${escapeText(choice)}</strong><p>${escapeText(item.name)}${hasRating(item)?` · ${item.rating}/10`:""}</p><button type="button" data-recommended-place="${escapeText(item.id)}">식당 카드 보기</button>`:`<p>조건에 맞는 식당 카드를 찾지 못했어요.</p>`;elements.recommendationResult.hidden=false;
}
function renderInsights(){renderStats();renderCollections();resetRecommendation();}
function switchAppTab(tab){
  document.querySelectorAll("[data-app-tab]").forEach(button=>button.classList.toggle("active",button.dataset.appTab===tab));
  document.querySelectorAll("[data-tab-panel]").forEach(panel=>{panel.hidden=panel.dataset.tabPanel!==tab;});
  document.body.classList.toggle("insights-mode",tab==="insights");
  if(tab==="insights") renderInsights();else setTimeout(()=>mapController.resize(),0);
}
function openPlaceFromInsights(id){switchAppTab("browse");setMobileView("list");activeId=null;selectRestaurant(id,true,true);}
function selectRestaurant(id,moveMap,scrollToCard=false){ activeId=activeId===id?null:id; renderCards(getFilteredRestaurants()); const item=restaurants.find(place=>place.id===id); if(item&&moveMap) mapController.focus(id,item);if(scrollToCard&&activeId){elements.list.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:"smooth",block:"center"});} }
function setMobileView(view){document.body.classList.toggle("mobile-list-view",view==="list");document.querySelectorAll("[data-mobile-view]").forEach(button=>button.classList.toggle("active",button.dataset.mobileView===view));if(view==="map")setTimeout(()=>mapController.resize(),0);}
function showRestaurantOnMap(id){setMobileView("map");activeId=id;const item=restaurants.find(place=>place.id===id);renderCards(getFilteredRestaurants());if(item)setTimeout(()=>mapController.focus(id,item),0);}
async function deleteRestaurant(id){ if(!isAdmin||!window.confirm("이 맛집 기록을 삭제할까요?")) return;const nextRestaurants=restaurants.filter(item=>item.id!==id);if(!await persistFoodMap(nextRestaurants)){window.alert("공용 목록에 저장하지 못했습니다.");return;}selectedRestaurantIds.delete(id);activeId=null;render();showToast("맛집 기록을 삭제하고 서버에 반영했습니다."); }
function getLocalDate(){ const now=new Date(); const offset=now.getTimezoneOffset()*60000; return new Date(now.getTime()-offset).toISOString().slice(0,10); }
async function recordVisit(id){
  if(!isAdmin) return;
  const item=restaurants.find(place=>place.id===id); if(!item) return; const savedCount=Number.isFinite(Number(item.visitCount))?Number(item.visitCount):0; const count=item.status==="wishlist"?0:savedCount;
  const nextRestaurants=restaurants.map(place=>place.id===id?{...place,status:"visited",visitDate:getLocalDate(),visitCount:count+1,updatedAt:new Date().toISOString()}:place);if(!await persistFoodMap(nextRestaurants)){window.alert("방문 기록을 저장하지 못했습니다.");return;}render();showToast("방문 기록을 서버에 저장했습니다.");
}
function setFormValue(name,value){ const field=elements.form.elements.namedItem(name); if(field) field.value=String(value); }
function updateFormRequirements(){
  const status=String(elements.form.elements.namedItem("status").value);
  const requiredFields=status==="wishlist"?["address","menuReviews"]:["name","address","region","category","subcategory","comment","description"];
  ["name","address","region","category","subcategory","menuReviews","comment","description"].forEach(name=>{elements.form.elements.namedItem(name).required=requiredFields.includes(name);});
}
function setTagValues(tags=[]){ elements.form.querySelectorAll('input[name="tags"]').forEach(input=>{input.checked=tags.includes(input.value);}); }
function resetAddressSearch(){ selectedAddressResult=null;elements.addressStatus.textContent="";elements.addressResults.replaceChildren();elements.addressResults.hidden=true; }
function openCreateForm(){ editingId=null; elements.form.reset(); resetAddressSearch(); setFormValue("visitCount",1); updateFormRequirements(); elements.status.textContent=""; document.querySelector("#dialogEyebrow").textContent="NEW PLACE"; document.querySelector("#dialogTitle").textContent="맛집 기록하기"; document.querySelector("#submitFormButton").textContent="지도에 기록하기"; elements.dialog.showModal(); }
function openEditForm(id){
  const item=restaurants.find(place=>place.id===id); if(!item) return;
  editingId=id; resetAddressSearch(); elements.status.textContent=""; ["status","visitDate","name","address","region","category","subcategory","rating","visitCount","revisit","menuReviews","comment","description"].forEach(name=>setFormValue(name,item[name]??"")); updateFormRequirements(); setTagValues(item.tags);
  document.querySelector("#dialogEyebrow").textContent="EDIT PLACE"; document.querySelector("#dialogTitle").textContent="맛집 수정하기"; document.querySelector("#submitFormButton").textContent="수정 내용 저장"; elements.dialog.showModal();
}
function closeForm(){ editingId=null; elements.form.reset(); elements.status.textContent=""; elements.dialog.close(); }
function applyAddressResult(result,placeName=""){
  selectedAddressResult={...result,selectedAddress:result.roadAddress};setFormValue("address",result.roadAddress);if(placeName)setFormValue("name",placeName);if(result.region)setFormValue("region",result.region);elements.addressStatus.textContent=result.region?`네이버 지도 위치를 선택하고 지역을 ${result.region}(으)로 입력했습니다.`:"네이버 지도 위치를 선택했습니다.";elements.addressResults.hidden=true;mapController.moveTo(result.lat,result.lng);
}
async function selectPlaceResult(result,button){
  button.disabled=true;elements.addressStatus.textContent="선택한 식당의 지도 위치를 확인하는 중…";
  try { const addresses=await searchNaverAddresses(result.roadAddress);if(addresses.length===0) throw new Error("선택한 식당의 지도 좌표를 찾지 못했습니다.");applyAddressResult(addresses[0],result.name); }
  catch(error){console.error("선택한 식당의 위치를 확인하지 못했습니다.",error);elements.addressStatus.textContent=error instanceof Error?error.message:"식당 위치를 확인하지 못했습니다.";button.disabled=false;}
}
function renderAddressResults(results){
  elements.addressResults.replaceChildren(...results.map(result=>{const button=document.createElement("button");button.type="button";button.className="address-result";const title=document.createElement("strong");title.textContent=result.type==="place"?result.name:result.roadAddress;const detail=document.createElement("span");detail.textContent=result.type==="place"?[result.category,result.roadAddress].filter(Boolean).join(" · "):(result.jibunAddress?`지번 ${result.jibunAddress}`:"지번 주소 없음");button.append(title,detail);button.addEventListener("click",()=>result.type==="place"?selectPlaceResult(result,button):applyAddressResult(result));return button;}));
  elements.addressResults.hidden=results.length===0;
}
async function searchAddress(){
  const button=document.querySelector("#searchAddressButton"); const address=String(elements.form.elements.namedItem("address").value).trim(); button.disabled=true;elements.addressStatus.textContent="네이버에서 상호명과 주소를 검색하는 중…";elements.addressResults.hidden=true;
  try { const [placesResult,addressesResult]=await Promise.allSettled([searchNaverPlaces(address),searchNaverAddresses(address)]);const places=placesResult.status==="fulfilled"?placesResult.value.map(place=>({...place,type:"place"})):[];const addresses=addressesResult.status==="fulfilled"?addressesResult.value.map(item=>({...item,type:"address"})):[];const results=[...places,...addresses];if(results.length===0){const failure=placesResult.status==="rejected"?placesResult.reason:addressesResult.status==="rejected"?addressesResult.reason:null;throw failure instanceof Error?failure:new Error("검색 결과가 없습니다.");}renderAddressResults(results);elements.addressStatus.textContent=`검색 결과 ${results.length}개 · 사용할 식당 또는 주소를 선택해 주세요.`; }
  catch(error){ console.error("네이버 주소 검색에 실패했습니다.",error);resetAddressSearch();elements.addressStatus.textContent=error instanceof Error?error.message:"주소를 검색하지 못했어요."; }
  finally { button.disabled=false; }
}
async function handleSubmit(event){
  event.preventDefault(); const submit=elements.form.querySelector("[type=submit]"); const originalText=submit.textContent; submit.disabled=true; submit.textContent="저장하는 중…"; elements.status.textContent="";
  if(!isAdmin){elements.status.textContent="관리자 로그인 후 저장할 수 있습니다.";submit.disabled=false;submit.textContent=originalText;return;}
  try { const data=new FormData(elements.form); const status=String(data.get("status")); const rawRating=String(data.get("rating")).trim(); const rating=rawRating===""?null:Number(rawRating); if(status==="visited"&&!Number.isFinite(rating)) throw new Error("다녀온 맛집은 평점을 입력해 주세요."); if(rating!==null&&(!Number.isFinite(rating)||rating<0||rating>10)) throw new Error("평점은 0점부터 10점 사이로 입력해 주세요."); const previous=editingId?restaurants.find(item=>item.id===editingId):null; const address=String(data.get("address")).trim(); let region=String(data.get("region")).trim(); const menuReviews=String(data.get("menuReviews")).trim(); const tags=data.getAll("tags").map(String).filter(tag=>TAG_OPTIONS.includes(tag)); const selectedCoords=selectedAddressResult?.selectedAddress===address?{lat:selectedAddressResult.lat,lng:selectedAddressResult.lng,coordinateSource:"naver",roadAddress:selectedAddressResult.roadAddress,region:selectedAddressResult.region}:null; const previousCoords=previous&&previous.address===address?{lat:previous.lat,lng:previous.lng,coordinateSource:previous.coordinateSource,roadAddress:previous.roadAddress}:null; const coords=selectedCoords??previousCoords??await geocodeAddress(address,region); region=region||coords.region||""; const photos=await preparePhotos(elements.form.elements.namedItem("photos").files,previous); const item={id:previous?.id??crypto.randomUUID(),status,visitDate:String(data.get("visitDate")),name:String(data.get("name")).trim()||address,address,region,category:String(data.get("category"))||"기타",subcategory:String(data.get("subcategory")).trim()||menuReviews.split(/\r?\n/,1)[0],rating,visitCount:Number(data.get("visitCount")||0),revisit:String(data.get("revisit")),menuReviews,tags,collections:previous?.collections??[],photos,comment:String(data.get("comment")).trim()||menuReviews.split(/\r?\n/,1)[0],description:String(data.get("description")).trim(),...coords,createdAt:previous?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()}; const nextRestaurants=previous?restaurants.map(place=>place.id===item.id?item:place):[item,...restaurants];if(!await persistFoodMap(nextRestaurants)) throw new Error("서버에 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");closeForm(); activeStatus="all"; activeProvince="전체"; activeRegion="전체"; activeCategory="전체"; activeTag="전체"; render(); selectRestaurant(item.id,true);showToast(previous?"수정 내용을 서버에 저장했습니다.":"새 맛집을 서버에 저장했습니다."); }
  catch(error){ elements.status.textContent=error instanceof Error?error.message:"맛집을 저장하지 못했어요."; }
  finally { submit.disabled=false; submit.textContent=originalText; }
}
document.querySelector("#openFormButton").addEventListener("click",openCreateForm);
["#closeFormButton","#cancelFormButton"].forEach(selector=>document.querySelector(selector).addEventListener("click",closeForm));
document.querySelector("#resetFilters").addEventListener("click",()=>{activeStatus="all";activeProvince="전체";activeRegion="전체";activeCategory="전체";activeTag="전체";elements.search.value="";render();mapController.focusArea(restaurants);});
document.querySelector("#locateButton").addEventListener("click",async()=>{try{await mapController.locate();}catch(error){window.alert(error instanceof Error?error.message:"현재 위치를 찾지 못했어요.");}});
elements.form.addEventListener("submit",handleSubmit); elements.form.elements.namedItem("status").addEventListener("change",updateFormRequirements); elements.search.addEventListener("input",render); elements.sort.addEventListener("change",render);
document.querySelector("#clearSearch").addEventListener("click",()=>{elements.search.value="";elements.search.focus();render();});
document.querySelectorAll("[data-mobile-view]").forEach(button=>button.addEventListener("click",()=>setMobileView(button.dataset.mobileView)));
document.querySelectorAll("[data-app-tab]").forEach(button=>button.addEventListener("click",()=>switchAppTab(button.dataset.appTab)));
document.querySelector("#restartRecommendation").addEventListener("click",resetRecommendation);
document.querySelector("#toggleSelectionButton").addEventListener("click",toggleSelectionMode);
document.querySelector("#selectAllVisible").addEventListener("click",selectAllVisibleRestaurants);
document.querySelector("#applyBulkCollection").addEventListener("click",applyBulkCollection);
elements.collectionCreateForm.addEventListener("submit",createCollectionFolder);
document.querySelector("#exportButton").addEventListener("click",exportBackup); document.querySelector("#importButton").addEventListener("click",()=>document.querySelector("#importInput").click()); document.querySelector("#importInput").addEventListener("change",importBackup);
elements.collectionGrid.addEventListener("click",event=>{const button=event.target.closest("[data-collection-place]");if(button)openPlaceFromInsights(button.dataset.collectionPlace);});
elements.recommendationResult.addEventListener("click",event=>{const button=event.target.closest("[data-recommended-place]");if(button)openPlaceFromInsights(button.dataset.recommendedPlace);});
document.querySelector("#searchAddressButton").addEventListener("click",searchAddress); elements.form.elements.namedItem("address").addEventListener("input",resetAddressSearch); elements.form.elements.namedItem("address").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();searchAddress();}});
async function toggleAdmin(){ if(!hasSupabaseConfig()){window.alert("Supabase 설정이 없습니다.");return;} if(isAdmin){try{await signOutAdmin();isAdmin=false;render();}catch(error){console.error("로그아웃하지 못했습니다.",error);window.alert("로그아웃하지 못했어요.");}return;}document.querySelector("#authDialog").showModal(); }
function resetAuthForm(){document.querySelector("#authForm").reset();document.querySelector("#authStatus").textContent="";}
async function handleAdminLogin(event){event.preventDefault();const form=event.currentTarget;const status=document.querySelector("#authStatus");const submit=document.querySelector("#authSubmitButton");const email=String(new FormData(form).get("email")).trim();submit.disabled=true;status.textContent="로그인 링크를 보내는 중…";try{await requestAdminMagicLink(email);status.textContent="이메일의 Sign in 링크를 눌러 주세요. 링크를 연 브라우저에서 자동 로그인됩니다.";}catch(error){console.error("관리자 로그인 링크를 보내지 못했습니다.",error);status.textContent="등록된 관리자 이메일인지 확인하거나 잠시 후 다시 시도해 주세요.";}finally{submit.disabled=false;}}
document.querySelector("#authButton").addEventListener("click",toggleAdmin);document.querySelector("#authForm").addEventListener("submit",handleAdminLogin);document.querySelector("#closeAuthButton").addEventListener("click",()=>document.querySelector("#authDialog").close());document.querySelector("#authDialog").addEventListener("close",resetAuthForm);
document.querySelector("#retryDataButton").addEventListener("click",()=>window.location.reload());
document.querySelector("#tagOptions").replaceChildren(...TAG_OPTIONS.map(tag=>{const label=document.createElement("label");label.className="tag-option";const input=document.createElement("input");input.type="checkbox";input.name="tags";input.value=tag;label.append(input,document.createTextNode(tag));return label;}));
render();
