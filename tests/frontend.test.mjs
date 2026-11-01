import test from 'node:test';
import assert from 'node:assert/strict';
import { replayTrace, visitedNames } from '../src/api/adapters/searchTrace.js';
import { createAlternativeRows, createSearchRows } from '../src/api/adapters/routeData.js';

const a = { key:'10:0', node:10, mask:0, g:0, h:5, f:5 };
const b = { key:'20:0', node:20, mask:0, g:4, h:2, f:6 };
const c = { key:'10:1', node:10, mask:1, g:8, h:0, f:8 };
test('same road node with different masks remains a different state', () => {
  const frame = replayTrace([{...a,opened:[b,c]}], a, 0);
  assert.equal(frame.openCount,2); assert.equal(frame.closedCount,1);
  assert.deepEqual(frame.open.map(x=>x.key),['20:0','10:1']);
});
test('reopening replaces closed state and updates candidate cost', () => {
  const improved = {...a,g:1,f:6};
  const frame = replayTrace([{...a,opened:[b,c]},{...b,opened:[improved]}],a,1);
  assert.equal(frame.openCount,2); assert.equal(frame.closedCount,1);
  assert.equal(frame.open.find(x=>x.key===a.key).g,1);
  assert.deepEqual(frame.closed.map(x=>x.key),[b.key]);
});
test('mask labels follow request order',()=>assert.deepEqual(visitedNames(5,['N','R','G']),['N','G']));
test('goal depends on full state, not just a return to the depot',()=>{
  const rows=createSearchRows({trace:[{...a,step:1,status:'expanded'},{...c,step:2,status:'goal'}]});
  assert.equal(rows[0].status,'Ekspansi'); assert.equal(rows[1].status,'Goal');
});
test('equal-cost baseline alternatives are labelled without claiming both selected',()=>{
  const rows=createAlternativeRows({comparison:{distance_m:21000},candidates:[
    {rank:1,route:['S','N','S'],total_distance_m:21000,is_optimal:true,is_selected:false},
    {rank:2,route:['S','G','S'],total_distance_m:21000,is_optimal:true,is_selected:true}]});
  assert.equal(rows[0].selected,false); assert.equal(rows[0].tag,'Minimum'); assert.equal(rows[1].selected,true);
});
