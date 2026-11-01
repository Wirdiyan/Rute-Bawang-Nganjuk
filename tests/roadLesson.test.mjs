import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutRoadLesson,lessonSnapshot,sampleLessonVehicle} from '../src/simulation/roadLesson.js';

const nodes=[{id:'S',latitude:0,longitude:0},{id:'A',latitude:.001,longitude:.001},{id:'B',latitude:-.001,longitude:.001},{id:'T',latitude:0,longitude:.002}];
const edges=[{id:'sa',source:'S',target:'A',distance_m:100},{id:'at',source:'A',target:'T',distance_m:100},{id:'sb',source:'S',target:'B',distance_m:150},{id:'bt',source:'B',target:'T',distance_m:150}];
const steps=[{node:null,open:[{node:'S',g:0,h:100,f:100}],closed:[],goal:false},
  {node:'S',g:0,h:100,f:100,open:[{node:'A',g:100,h:70,f:170},{node:'B',g:150,h:70,f:220}],closed:['S'],goal:false},
  {node:'T',g:200,h:0,f:200,open:[],closed:['S','A','T'],goal:true}];
const search={steps,path:['S','A','T'],path_edges:['sa','at']};
const lesson={nodes,edges,start:'S',goal:'T',leg_index:0,distance_m:200,searches:{guided:search}};

test('lesson keeps solution hidden until goal and shows discovered candidates only',()=>{
  const initial=lessonSnapshot(search,0);
  assert.equal(initial.revealedEdges.size,0);assert.equal(initial.known.has('A'),false);
  const expanded=lessonSnapshot(search,1);
  assert.equal(expanded.open.has('A'),true);assert.equal(expanded.revealedEdges.size,0);
  assert.deepEqual([...lessonSnapshot(search,99).revealedEdges],['sa','at']);
  assert.equal(lessonSnapshot(search,-1).current.node,null);
});
test('layout preserves all directed alternatives with finite separate positions',()=>{
  const result=layoutRoadLesson(lesson);
  assert.equal(result.nodes.length,4);assert.equal(result.edges.length,4);
  for(const node of result.nodes)assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y));
  for(const edge of result.edges)assert.ok(!edge.path.includes('NaN'));
  assert.ok(Math.hypot(result.nodes[1].x-result.nodes[2].x,result.nodes[1].y-result.nodes[2].y)>60);
});
test('vehicle visits intermediate node and reaches the same end points as the map leg',()=>{
  const diagram=layoutRoadLesson(lesson),byId=new Map(diagram.nodes.map(n=>[n.id,n]));
  const sample=p=>sampleLessonVehicle(diagram,lesson,{phase:'travel',legIndex:0,legProgress:p});
  assert.deepEqual(sample(0),{x:byId.get('S').x,y:byId.get('S').y});
  assert.deepEqual(sample(.5),{x:byId.get('A').x,y:byId.get('A').y});
  assert.deepEqual(sample(1),{x:byId.get('T').x,y:byId.get('T').y});
  assert.equal(sampleLessonVehicle(diagram,lesson,{phase:'travel',legIndex:1,legProgress:.4}),null);
});
