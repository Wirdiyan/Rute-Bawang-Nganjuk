import test from 'node:test';
import assert from 'node:assert/strict';
import {createWholeNodeJourney,sampleWholeNodeJourney} from '../src/simulation/wholeNodeJourney.js';

function fixture(destinations=3) {
  const names=['Sukomoro',...['Gondang','Rejoso','Nganjuk'].slice(0,destinations),'Sukomoro'];
  const legs=names.slice(1).map((to,index)=>({from:names[index],to,distance_m:100}));
  const road_lessons=legs.map((leg,index)=>({from:leg.from,to:leg.to,leg_index:index,start:'S',goal:'T',
    nodes:[{id:'S',name:leg.from,latitude:0,longitude:0},{id:'A',name:'Dekat desa A',latitude:.001,longitude:.001},
      {id:'B',name:'Dekat desa B',latitude:-.001,longitude:.001},{id:'T',name:leg.to,latitude:0,longitude:.002}],
    edges:[{id:'sa',source:'S',target:'A',distance_m:40},{id:'at',source:'A',target:'T',distance_m:60},
      {id:'sb',source:'S',target:'B',distance_m:80},{id:'bt',source:'B',target:'T',distance_m:80}],
    searches:{guided:{path_edges:['sa','at']}}}));
  return {route:names,legs,road_lessons};
}

test('whole cycle shares each terminal and returns to exactly one depot',()=>{
  const input=fixture(),before=JSON.stringify(input),model=createWholeNodeJourney(input);
  assert.equal(model.terminals.length,4);
  assert.equal(model.nodes.filter(n=>n.kind==='depot').length,1);
  assert.equal(model.nodes.length,12);
  assert.equal(model.totalDistanceM,400);
  model.legs.forEach((leg,index)=>{
    assert.equal(leg.intermediateCount,2);
    assert.equal(leg.path.at(-1).edge.target,model.legs[(index+1)%4].path[0].edge.source);
  });
  assert.equal(new Set(model.edges.map(edge=>edge.id)).size,model.edges.length);
  assert.equal(JSON.stringify(input),before);
});
test('start and finish are the same visual node after all legs are completed',()=>{
  const model=createWholeNodeJourney(fixture());
  const start=sampleWholeNodeJourney(model,{phase:'loading',legIndex:null,legProgress:0});
  const finish=sampleWholeNodeJourney(model,{phase:'finished',legIndex:3,legProgress:1});
  assert.deepEqual(finish.position,start.position);
  assert.equal(finish.activeNode,model.first.id);
  assert.ok([...finish.progress.values()].every(value=>value===1));
  assert.ok(model.terminals.every(node=>finish.visited.has(node.id)));
});
test('vehicle passes intermediate node and completed/future legs have correct trails',()=>{
  const model=createWholeNodeJourney(fixture());
  const frame=sampleWholeNodeJourney(model,{phase:'travel',legIndex:1,legProgress:.4});
  const intermediate=model.legs[1].path[0].edge.to;
  assert.deepEqual(frame.position,{x:intermediate.x,y:intermediate.y});
  assert.ok(model.legs[0].path.every(item=>frame.progress.get(item.edge.id)===1));
  assert.ok(model.legs[2].path.every(item=>frame.progress.get(item.edge.id)===0));
  assert.equal(frame.progress.size,model.edges.filter(edge=>edge.selected).length);
});
test('one and two destinations remain closed cycles with distinct return corridors',()=>{
  for(const count of [1,2]) {
    const model=createWholeNodeJourney(fixture(count));
    assert.equal(model.terminals.length,count+1);
    for(const edge of model.edges)assert.ok(!edge.path.includes('NaN'));
    assert.equal(model.legs.at(-1).path.at(-1).edge.target,model.first.id);
    if(count===1) {
      const outbound=sampleWholeNodeJourney(model,{phase:'travel',legIndex:0,legProgress:.5});
      const returning=sampleWholeNodeJourney(model,{phase:'travel',legIndex:1,legProgress:.5});
      assert.ok(Math.abs(outbound.position.y-returning.position.y)>100);
    }
  }
});
test('mismatched ordering or cost is rejected instead of drawing a false complete trip',()=>{
  const cost=fixture();cost.legs[1].distance_m=999;
  assert.throws(()=>createWholeNodeJourney(cost),/Biaya/);
  const order=fixture();order.road_lessons[1].to='wrong';
  assert.throws(()=>createWholeNodeJourney(order),/Urutan/);
});
test('fractional road lengths leave every selected edge fully green at finish',()=>{
  const input=fixture();
  for(const lesson of input.road_lessons) {
    lesson.edges[0].distance_m=.1;lesson.edges[1].distance_m=.2;
  }
  input.legs.forEach(leg=>{leg.distance_m=.3;});
  const model=createWholeNodeJourney(input);
  const end=sampleWholeNodeJourney(model,{phase:'finished',legIndex:3,legProgress:1});
  assert.ok([...end.progress.values()].every(value=>value===1));
  assert.ok(model.edges.filter(edge=>edge.selected).every(edge=>end.visited.has(edge.target)));
});
