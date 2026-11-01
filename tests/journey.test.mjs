import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyModel, sampleJourney } from '../src/simulation/routeJourney.js';

const config = () => ({
  coordinates: [[0,0],[0,0.002],[0.001,0.002],[0.002,0.002],[0.002,0.001],[0,0]],
  route:['S','G','R','S'],
  legs:[{from:'S',to:'G',distance_m:300},{from:'G',to:'R',distance_m:400},{from:'R',to:'S',distance_m:200}],
  stops:[{name:'S',latitude:0,longitude:0},{name:'G',latitude:0.001,longitude:0.002},{name:'R',latitude:0.002,longitude:0.001}],
});

test('journey loads at depot, visits ordered stops and returns to the depot',()=>{
  const model=createJourneyModel(config());
  assert.deepEqual(model.phases.map(x=>x.type),['loading','travel','unloading','travel','unloading','travel','finished']);
  assert.deepEqual(sampleJourney(model,0).position,[0,0]);
  assert.equal(model.destinationCount,2);
  assert.equal(model.totalDistanceM,900);
  assert.equal(sampleJourney(model,model.totalMs).completedStops,2);
});
test('vehicle interpolates along road bends rather than drawing a straight shortcut',()=>{
  const model=createJourneyModel(config());
  const phase=model.phases[1];
  const frame=sampleJourney(model,(phase.startMs+phase.endMs)/2);
  assert.equal(frame.position[0],0);
  assert.ok(frame.position[1]>0.0014 && frame.position[1]<0.0016);
  assert.equal(frame.roadDistanceM,150);
  assert.equal(frame.title,'Menuju G');
});
test('unloading holds the exact destination coordinate and distance',()=>{
  const model=createJourneyModel(config());
  const phase=model.phases[2];
  for(const time of [phase.startMs+1,(phase.startMs+phase.endMs)/2,phase.endMs-1]) {
    const frame=sampleJourney(model,time);
    assert.equal(frame.phase,'unloading');assert.deepEqual(frame.position,[0.001,0.002]);assert.equal(frame.roadDistanceM,300);
  }
});
test('final frame and out-of-range seeks clamp exactly to depot and total distance',()=>{
  const model=createJourneyModel(config());
  assert.equal(sampleJourney(model,-100).progress,0);
  const last=sampleJourney(model,model.totalMs+10000);
  assert.deepEqual(last.position,[0,0]);assert.equal(last.roadDistanceM,900);assert.equal(last.progress,1);assert.equal(last.finished,true);
});
test('a repeated depot road coordinate does not end the trip early',()=>{
  const input=config();input.coordinates.splice(1,0,[0,0.001],[0,0]);
  const model=createJourneyModel(input);
  assert.equal(model.phases.at(-2).endIndex,input.coordinates.length-1);
  const frame=sampleJourney(model,model.phases.at(-2).startMs+1);
  assert.equal(frame.completedStops,2);assert.equal(frame.finished,false);
});
test('missing stop geometry is rejected instead of animating a fictional shortcut',()=>{
  const input=config();input.stops[1].latitude=1;
  assert.throws(()=>createJourneyModel(input),/berhenti/);
});
test('invalid route geometry, road costs and timing are rejected',()=>{
  const bad=config();bad.coordinates[1]=[NaN,0];assert.throws(()=>createJourneyModel(bad),/Geometri/);
  const badCost=config();badCost.legs[0].distance_m=-1;assert.throws(()=>createJourneyModel(badCost),/Jarak/);
  assert.throws(()=>createJourneyModel({...config(),travelMs:Infinity}),/Durasi/);
  const badRoute=config();badRoute.route[3]='R';assert.throws(()=>createJourneyModel(badRoute),/gudang/);
});
test('movement phase changes explain deliveries and the return journey',()=>{
  const model=createJourneyModel(config());
  const toSecond=sampleJourney(model,model.phases[3].startMs+1);
  assert.equal(toSecond.completedStops,1);assert.match(toSecond.explanation,/1 dari 2/);
  const returning=sampleJourney(model,model.phases[5].startMs+1);
  assert.match(returning.title,/Kembali ke gudang/);
});
