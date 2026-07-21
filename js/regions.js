import { KOREAN_PROVINCES } from "./constants.js";

const PROVINCE_ALIASES = {
  서울특별시:["서울특별시","서울"], 부산광역시:["부산광역시","부산"], 대구광역시:["대구광역시","대구"],
  인천광역시:["인천광역시","인천"], 광주광역시:["광주광역시","광주"], 대전광역시:["대전광역시","대전"],
  울산광역시:["울산광역시","울산"], 세종특별자치시:["세종특별자치시","세종시","세종"], 경기도:["경기도","경기"],
  강원특별자치도:["강원특별자치도","강원도","강원"], 충청북도:["충청북도","충북"], 충청남도:["충청남도","충남"],
  전북특별자치도:["전북특별자치도","전라북도","전북"], 전라남도:["전라남도","전남"],
  경상북도:["경상북도","경북"], 경상남도:["경상남도","경남"], 제주특별자치도:["제주특별자치도","제주도","제주"]
};

const METROPOLITAN_CITIES = new Set(["서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","세종특별자치시"]);

export function getProvince(item){
  const text=`${item.address ?? ""} ${item.region ?? ""}`;
  for(const [province,aliases] of Object.entries(PROVINCE_ALIASES)){
    if(aliases.some(alias=>text.includes(alias))) return province;
  }
  for(const [province,cities] of Object.entries(KOREAN_PROVINCES)){
    if(cities.some(city=>text.includes(city))) return province;
  }
  return "기타 지역";
}

export function getDistrict(item){
  const region=String(item.region ?? "").trim();
  const province=getProvince(item);
  if(region){
    const aliases=PROVINCE_ALIASES[province]??[];
    const district=region.split(/\s+/).filter(word=>!aliases.includes(word)).join(" ");
    return district||region;
  }
  const words=String(item.address ?? "").trim().split(/\s+/);
  const withoutProvince=words.filter(word=>!PROVINCE_ALIASES[province]?.includes(word));
  return withoutProvince.slice(0,METROPOLITAN_CITIES.has(province)?1:2).join(" ")||"지역 미등록";
}
