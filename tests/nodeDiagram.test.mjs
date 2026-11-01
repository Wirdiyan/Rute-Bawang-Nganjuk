import test from 'node:test';
import assert from 'node:assert/strict';
import {createNodeDiagram,pointOnEdge,sampleNodeDiagram} from '../src/simulation/nodeDiagram.js';

const route=['S','G','R','N','S'];
const legs=route.slice(1).map((to,index)=>({from:route[index],to,distance_m:[9,6,10,5][index]*1000}));
test('returning depot is one node and each directed leg preserves its real cost',()=>{
  const diagram=createNodeDiagram(route,legs);
  assert.equal(diagram.nodes.length,4);assert.equal(diagram.edges.length,4);assert.equal(diagram.totalDistanceM,30000);
  assert.deepEqual(diagram.edges.map(edge=>[edge.from.name,edge.to.name,edge.distanceM]),legs.map(leg=>[leg.from,leg.to,leg.distance_m]));
});
test('one-destination round trip has separate outward and return curves',()=>{
  const diagram=createNodeDiagram(['S','G','S'],[{from:'S',to:'G',distance_m:3},{from:'G',to:'S',distance_m:5}]);
  assert.equal(diagram.nodes.length,2);assert.notEqual(pointOnEdge(diagram.edges[0],0.5).y,pointOnEdge(diagram.edges[1],0.5).y);
  assert.equal(diagram.edges[1].distanceM,5);
  assert.ok(Math.abs(diagram.edges[0].label.y-diagram.edges[1].label.y)>28);
});
test('moving token reaches the exact next node and stays there for unloading',()=>{
  const diagram=createNodeDiagram(route,legs);
  const before=sampleNodeDiagram(diagram,{phase:'travel',legIndex:0,legProgress:0});
  const after=sampleNodeDiagram(diagram,{phase:'unloading',legIndex:0,legProgress:1});
  assert.deepEqual(before.position,{x:diagram.nodes[0].x,y:diagram.nodes[0].y});
  assert.deepEqual(after.position,{x:diagram.nodes[1].x,y:diagram.nodes[1].y});
  assert.deepEqual(after.progress,[1,0,0,0]);
});
test('finished diagram returns token to the depot and highlights every leg',()=>{
  const diagram=createNodeDiagram(route,legs);
  const frame=sampleNodeDiagram(diagram,{phase:'finished',legIndex:3,legProgress:1});
  assert.deepEqual(frame.position,{x:diagram.nodes[0].x,y:diagram.nodes[0].y});assert.deepEqual(frame.progress,[1,1,1,1]);
});
test('preview before calculation contains locations without invented links or weights',()=>{
  const diagram=createNodeDiagram(['S','N','R','G']);
  assert.equal(diagram.nodes.length,4);assert.equal(diagram.edges.length,0);
});
test('unknown or invalid edges are rejected and node count adapts to selection',()=>{
  assert.equal(createNodeDiagram(['S','N','S'],[{from:'S',to:'N',distance_m:1},{from:'N',to:'S',distance_m:1}]).nodes.length,2);
  assert.equal(createNodeDiagram(['S']),null);
  assert.throws(()=>createNodeDiagram(route,[{from:'S',to:'unknown',distance_m:1}]));
});
