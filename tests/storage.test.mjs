import assert from "node:assert/strict";
import test from "node:test";
import { LATITUDE_RANGE, LONGITUDE_RANGE } from "../js/constants.js";
import { normalizeCoordinate, normalizeFoodMapData, validateImportedData, validateImportedItem } from "../js/storage.js";

const validRestaurant = {
  id:"restaurant-1",
  name:"테스트 식당",
  address:"충청북도 청주시",
  lat:36.6424,
  lng:127.489
};

test("좌표는 빈 값과 범위 밖 숫자를 null로 정규화한다",()=>{
  assert.equal(normalizeCoordinate(null,LATITUDE_RANGE),null);
  assert.equal(normalizeCoordinate("",LATITUDE_RANGE),null);
  assert.equal(normalizeCoordinate("91",LATITUDE_RANGE),null);
  assert.equal(normalizeCoordinate("-181",LONGITUDE_RANGE),null);
  assert.equal(normalizeCoordinate("36.6424",LATITUDE_RANGE),36.6424);
});

test("기존 배열 백업과 새 객체 백업을 모두 정규화한다",()=>{
  const legacy=normalizeFoodMapData([{...validRestaurant,collections:["기존"]}]);
  const current=normalizeFoodMapData({restaurants:[validRestaurant],collections:["빈 폴더"]});
  assert.deepEqual(legacy.collections,["기존"]);
  assert.deepEqual(current.collections,["빈 폴더"]);
});

test("백업 항목은 필수 문자열과 유효한 좌표를 요구한다",()=>{
  assert.equal(validateImportedItem(validRestaurant),true);
  assert.equal(validateImportedItem({...validRestaurant,id:""}),false);
  assert.equal(validateImportedItem({...validRestaurant,lat:null}),false);
  assert.equal(validateImportedItem({...validRestaurant,lng:181}),false);
  assert.equal(validateImportedItem({...validRestaurant,status:"unknown"}),false);
  assert.equal(validateImportedItem({...validRestaurant,rating:4.9}),false);
  assert.equal(validateImportedItem({...validRestaurant,rating:5}),true);
  assert.equal(validateImportedItem({...validRestaurant,rating:10}),true);
  assert.equal(validateImportedItem({...validRestaurant,rating:10.1}),false);
});

test("백업 전체에서 중복 ID와 잘못된 컬렉션을 거부한다",()=>{
  assert.equal(validateImportedData([validRestaurant],["청주 맛집"]),true);
  assert.equal(validateImportedData([validRestaurant,{...validRestaurant}],[]),false);
  assert.equal(validateImportedData([validRestaurant],[42]),false);
});
