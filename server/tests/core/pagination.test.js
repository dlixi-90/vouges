import test from "node:test";
import assert from "node:assert/strict";
import {getPaginationPages} from "../../../client/src/utils/pagination.js";

test("282 collection pages stay compact at the beginning, middle and end",()=>{
  assert.deepEqual(getPaginationPages(1,282),[1,2,3,4,5,"end-gap",282]);
  assert.deepEqual(getPaginationPages(140,282),[1,"start-gap",139,140,141,"end-gap",282]);
  assert.deepEqual(getPaginationPages(282,282),[1,"start-gap",278,279,280,281,282]);
});
test("small and out-of-range page lists have valid, unique boundaries",()=>{
  assert.deepEqual(getPaginationPages(3,5),[1,2,3,4,5]);
  assert.deepEqual(getPaginationPages(0,0),[1]);
  assert.deepEqual(getPaginationPages(Infinity,Infinity),[1]);
  assert.deepEqual(getPaginationPages(999,8),[1,"start-gap",4,5,6,7,8]);
});
test("every current page remains visible with at most seven slots and accurate gaps",()=>{
  for(const total of [8,9,10,38,98,282,10000]){
    for(let current=1;current<=total;current++){
      const range=getPaginationPages(current,total);
      assert.ok(range.length<=7);
      assert.equal(range[0],1);assert.equal(range.at(-1),total);
      const numbers=range.filter(value=>typeof value==="number");
      assert.ok(numbers.includes(current));assert.equal(new Set(numbers).size,numbers.length);
      for(let i=1;i<range.length;i++){
        if(typeof range[i]==="number"&&typeof range[i-1]==="number")assert.equal(range[i],range[i-1]+1);
      }
    }
  }
});
