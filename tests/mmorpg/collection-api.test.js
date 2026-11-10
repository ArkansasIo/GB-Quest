import test from "node:test";
import assert from "node:assert/strict";
import { GBQuestMMOApi } from "../../src/mmorpg/net/mmorpg-api.js";
function response(data,status=200){return {ok:status<400,status,json:async()=>data};}
test("collection API reads persistent character collections",async()=>{
 const calls=[];const api=new GBQuestMMOApi({baseUrl:"https://realm.example",fetchImpl:async(url,options)=>{calls.push({url,options});return response({collections:{mounts:["mossback-stag"]}});}});
 api.token="session-token";const result=await api.collections("character-1");
 assert.deepEqual(result.collections.mounts,["mossback-stag"]);
 assert.equal(calls[0].url,"https://realm.example/api/characters/character-1/collections");
 assert.equal(calls[0].options.headers.authorization,"Bearer session-token");
});
test("collection activation posts a category and entry id",async()=>{
 let call;const api=new GBQuestMMOApi({baseUrl:"https://realm.example",fetchImpl:async(url,options)=>{call={url,options};return response({active:{category:"mounts",entryId:"mossback-stag"}});}});
 const result=await api.activateCollection("character-1","mounts","mossback-stag");
 assert.deepEqual(result.active,{category:"mounts",entryId:"mossback-stag"});
 assert.equal(call.options.method,"POST");
 assert.deepEqual(JSON.parse(call.options.body),{category:"mounts",entryId:"mossback-stag"});
});
