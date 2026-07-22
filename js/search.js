const INITIAL_CONSONANTS = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const MAX_TYPO_DISTANCE = 1;

function normalizeText(value){ return String(value??"").trim().toLowerCase().replace(/\s+/g," "); }
function getInitials(value){
  return [...normalizeText(value)].map(character=>{
    const code=character.charCodeAt(0);
    return code>=HANGUL_BASE&&code<=HANGUL_END?INITIAL_CONSONANTS[Math.floor((code-HANGUL_BASE)/588)]:character;
  }).join("");
}
function getDistance(left,right){
  if(Math.abs(left.length-right.length)>MAX_TYPO_DISTANCE) return MAX_TYPO_DISTANCE+1;
  let previous=Array.from({length:right.length+1},(_,index)=>index);
  for(let leftIndex=1;leftIndex<=left.length;leftIndex+=1){
    const current=[leftIndex];
    for(let rightIndex=1;rightIndex<=right.length;rightIndex+=1){
      const cost=left[leftIndex-1]===right[rightIndex-1]?0:1;
      current[rightIndex]=Math.min(current[rightIndex-1]+1,previous[rightIndex]+1,previous[rightIndex-1]+cost);
    }
    previous=current;
  }
  return previous[right.length];
}
function matchesToken(token,text,words,initials){
  if(text.includes(token)||initials.includes(token)) return true;
  if(token.length<2) return false;
  return words.some(word=>getDistance(token,word)<=MAX_TYPO_DISTANCE);
}

export function matchesRestaurantSearch(item,query){
  const tokens=normalizeText(query).split(" ").filter(Boolean);
  if(tokens.length===0) return true;
  const fields=[item.name,item.category,item.subcategory,item.region,item.address,item.comment,item.description,item.menuReviews,...(item.tags??[]),...(item.collections??[])];
  const text=normalizeText(fields.join(" "));
  const words=text.split(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]+/).filter(Boolean);
  const initials=getInitials(text);
  return tokens.every(token=>matchesToken(token,text,words,initials));
}
