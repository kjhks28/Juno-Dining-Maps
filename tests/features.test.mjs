import assert from "node:assert/strict";
import test from "node:test";
import { getCollectionGroups, getRecommendationChoices, recommendMenu } from "../js/insights.js";
import { matchesRestaurantSearch } from "../js/search.js";

const restaurants = [{
  id:"prince",
  name:"프린스빌1차",
  category:"한식",
  subcategory:"말고기",
  region:"충청북도 청주시 서원구",
  address:"충북 청주시",
  comment:"말고기 맛집",
  description:"",
  menuReviews:"말고기 9.5",
  rating:10,
  tags:[],
  collections:["청주 맛집"]
}];

test("초성·복수 검색어·부분 검색을 지원한다",()=>{
  assert.equal(matchesRestaurantSearch(restaurants[0],"청주 프린스"),true);
  assert.equal(matchesRestaurantSearch(restaurants[0],"ㅍㄹㅅㅂ"),true);
  assert.equal(matchesRestaurantSearch(restaurants[0],"서울 초밥"),false);
});

test("비어 있는 컬렉션 폴더도 유지한다",()=>{
  const groups=getCollectionGroups(restaurants,["빈 폴더","청주 맛집"]);
  assert.equal(groups.find(([name])=>name==="빈 폴더")[1].length,0);
  assert.equal(groups.find(([name])=>name==="청주 맛집")[1].length,1);
});

test("카드 데이터로 메뉴 선택과 추천을 수행한다",()=>{
  assert.deepEqual(getRecommendationChoices(restaurants,"category",{}),["한식"]);
  assert.equal(recommendMenu(restaurants,{category:"한식",subcategory:"말고기",menu:"말고기"}).id,"prince");
});
