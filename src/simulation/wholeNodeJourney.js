import { layoutRoadLesson } from './roadLesson.js';

const pointOnCurve=(edge,t)=>{
  const u=1-t;
  return {x:u*u*edge.from.x+2*u*t*edge.control.x+t*t*edge.to.x,
    y:u*u*edge.from.y+2*u*t*edge.control.y+t*t*edge.to.y};
};

export function createWholeNodeJourney(result) {
  if(!result)return null;
  const route=result.route,lessons=result.road_lessons;
  if(!route||route[0]!==route.at(-1)||!lessons||lessons.length!==route.length-1)throw new Error('Rute node keseluruhan belum lengkap.');
  const terminalCount=route.length-1;
  const layouts={
    2:[[210,470],[1030,470]],
    3:[[210,730],[620,150],[1030,730]],
    4:[[210,150],[1030,150],[1030,750],[210,750]],
  };
  const positions=layouts[terminalCount];
  if(!positions)throw new Error('Diagram mendukung satu sampai tiga tujuan.');
  const nodes=positions.map(([x,y],index)=>({id:`stop:${index}`,name:route[index],
    code:index===0?'GD':`T${index}`,kind:index===0?'depot':'destination',x,y,index}));
  const edges=[],legs=[];
  lessons.forEach((lesson,index)=>{
    if(lesson.from!==route[index]||lesson.to!==route[index+1])throw new Error('Urutan koridor tidak sesuai perjalanan.');
    const diagram=layoutRoadLesson(lesson);
    const from=nodes[index],to=nodes[(index+1)%terminalCount];
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
    const normal={x:-dy/length,y:dx/length};
    const project=point=>{
      const t=(point.x-65)/(diagram.width-130);
      const bend=terminalCount===2?-190*Math.sin(Math.PI*t):0;
      const across=(point.y-300)*.85+bend;
      return {x:from.x+dx*t+normal.x*across,y:from.y+dy*t+normal.y*across};
    };
    const byId=new Map();
    for(const node of diagram.nodes) {
      if(node.id===lesson.start){byId.set(node.id,from);continue;}
      if(node.id===lesson.goal){byId.set(node.id,to);continue;}
      const transformed={...node,...project(node),id:`leg:${index}:${node.id}`,code:`${index+1}${node.code}`,kind:'junction',legIndex:index};
      nodes.push(transformed);byId.set(node.id,transformed);
    }
    const edgeById=new Map();
    for(const edge of diagram.edges) {
      const a=byId.get(edge.source),b=byId.get(edge.target),control=project(edge.control);
      const trim=(node,other,radius)=>{
        const d=Math.max(1,Math.hypot(other.x-node.x,other.y-node.y));
        return {x:node.x+(other.x-node.x)*radius/d,y:node.y+(other.y-node.y)*radius/d};
      };
      const start=trim(a,control,a.kind==='junction'?21:31),end=trim(b,control,b.kind==='junction'?24:34);
      const item={id:`leg:${index}:${edge.id}`,source:a.id,target:b.id,from:a,to:b,control,
        distanceM:edge.distance_m,legIndex:index,
        path:`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`};
      edges.push(item);edgeById.set(edge.id,item);
    }
    const selected=lesson.searches.guided.path_edges.map(id=>edgeById.get(id));
    let total=0;
    const path=selected.map(edge=>{
      const startM=total;total+=edge.distanceM;edge.selected=true;
      return {edge,startM,endM:total};
    });
    if(Math.abs(total-result.legs[index].distance_m)>1e-5)throw new Error('Biaya koridor tidak sesuai hasil perjalanan.');
    legs.push({index,from:route[index],to:route[index+1],path,distanceM:total,
      intermediateCount:diagram.nodes.length-2});
  });
  // Intermediate nodes are appended; terminal lookups must stay explicit.
  const terminals=nodes.filter(node=>node.kind!=='junction');
  const obstacles=nodes.flatMap(node=>[
    {x:node.x-36,y:node.y-36,w:72,h:72},
    {x:node.x-(node.kind==='junction'?60:90),y:node.y+27,w:node.kind==='junction'?120:180,h:55},
  ]);
  const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  for(const edge of edges) {
    let best=null;
    for(const t of [.5,.3,.7])for(const offset of [-15,15,-30,30,0]) {
      const point=pointOnCurve(edge,t),dx=edge.to.x-edge.from.x,dy=edge.to.y-edge.from.y,d=Math.max(1,Math.hypot(dx,dy));
      const x=point.x-dy/d*offset,y=point.y+dx/d*offset,rect={x:x-38,y:y-12,w:76,h:24};
      const score=obstacles.reduce((sum,item)=>sum+overlap(rect,item),0)*100+Math.abs(t-.5)*20+Math.abs(offset)*.2;
      if(!best||score<best.score)best={x,y,rect,score};
    }
    edge.label={x:best.x,y:best.y};obstacles.push(best.rect);
  }
  return {width:1240,height:900,nodes,edges,legs,terminals,first:terminals[0],
    totalDistanceM:legs.reduce((sum,leg)=>sum+leg.distanceM,0)};
}

export function sampleWholeNodeJourney(model,frame) {
  if(!model||!frame)return null;
  const completed=frame.phase==='finished';
  const legIndex=Math.max(0,Math.min(model.legs.length-1,frame.legIndex??0));
  const fraction=frame.phase==='loading'?0:Math.max(0,Math.min(1,frame.legProgress));
  const progress=new Map(),visited=new Set([model.first.id]);
  let position={x:model.first.x,y:model.first.y},activeNode=model.first.id;
  for(const leg of model.legs) {
    const traveled=completed||leg.index<legIndex?leg.distanceM:leg.index===legIndex?fraction*leg.distanceM:0;
    for(const item of leg.path) {
      const value=completed||leg.index<legIndex||traveled>=item.endM-1e-7?1:
        item.edge.distanceM?Math.max(0,Math.min(1,(traveled-item.startM)/item.edge.distanceM)):0;
      progress.set(item.edge.id,value);
      if(value>0)visited.add(item.edge.source);
      if(value===1)visited.add(item.edge.target);
      if(leg.index===legIndex&&traveled>=item.startM&&traveled<=item.endM) {
        position=pointOnCurve(item.edge,value);activeNode=value===0?item.edge.source:item.edge.target;
      }
    }
  }
  if(completed){position={x:model.first.x,y:model.first.y};activeNode=model.first.id;}
  return {position,activeNode,visited,progress,legIndex};
}
