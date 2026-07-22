function hasRating(item){ return item.rating!==null&&item.rating!==""&&Number.isFinite(Number(item.rating)); }
function getMenuNames(item){
  const lines=String(item.menuReviews??"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const menus=lines.map(line=>line.replace(/\s+(?:₩?[\d,]+원?|\d+(?:\.\d+)?(?:\s*점|\/10)?)$/u,"").trim()).filter(Boolean);
  return [...new Set(menus.length?menus:[String(item.subcategory??"").trim()].filter(Boolean))];
}

export function getStats(restaurants){
  const rated=restaurants.filter(hasRating);
  const categoryCounts=restaurants.reduce((counts,item)=>{const category=item.category||"기타";counts[category]=(counts[category]??0)+1;return counts;},{});
  const regionCounts=restaurants.reduce((counts,item)=>{const region=item.region||"지역 미등록";counts[region]=(counts[region]??0)+1;return counts;},{});
  const monthlyCounts=restaurants.filter(item=>item.status==="visited"&&/^\d{4}-\d{2}-\d{2}$/.test(item.visitDate??"")).reduce((counts,item)=>{const month=item.visitDate.slice(0,7);counts[month]=(counts[month]??0)+1;return counts;},{});
  return {
    total:restaurants.length,
    visited:restaurants.filter(item=>item.status==="visited").length,
    wishlist:restaurants.filter(item=>item.status==="wishlist").length,
    averageRating:rated.length?(rated.reduce((sum,item)=>sum+Number(item.rating),0)/rated.length).toFixed(1):"-",
    categoryCounts:Object.entries(categoryCounts).sort((left,right)=>right[1]-left[1]),
    regionCounts:Object.entries(regionCounts).sort((left,right)=>right[1]-left[1]).slice(0,6),
    monthlyCounts:Object.entries(monthlyCounts).sort((left,right)=>left[0].localeCompare(right[0])).slice(-6)
  };
}
export function getCollectionGroups(restaurants,collectionNames=[]){
  const groups=new Map(collectionNames.map(name=>[name,[]]));
  restaurants.forEach(item=>(item.collections??[]).forEach(name=>{if(!groups.has(name))groups.set(name,[]);groups.get(name).push(item);}));
  return [...groups.entries()].sort((left,right)=>left[0].localeCompare(right[0],"ko"));
}
export function getRecommendationChoices(restaurants,step,selection={}){
  const candidates=restaurants.filter(item=>getMenuNames(item).length>0);
  if(step==="category") return [...new Set(candidates.map(item=>item.category||"기타"))].sort((a,b)=>a.localeCompare(b,"ko"));
  const byCategory=candidates.filter(item=>(item.category||"기타")===selection.category);
  if(step==="subcategory") return [...new Set(byCategory.map(item=>item.subcategory||"기타"))].sort((a,b)=>a.localeCompare(b,"ko"));
  return [...new Set(byCategory.filter(item=>(item.subcategory||"기타")===selection.subcategory).flatMap(getMenuNames))].sort((a,b)=>a.localeCompare(b,"ko"));
}
export function recommendMenu(restaurants,selection){
  const candidates=restaurants.filter(item=>(item.category||"기타")===selection.category&&(item.subcategory||"기타")===selection.subcategory&&getMenuNames(item).includes(selection.menu));
  return candidates.sort((left,right)=>(hasRating(right)?Number(right.rating):-1)-(hasRating(left)?Number(left.rating):-1))[0]??null;
}
