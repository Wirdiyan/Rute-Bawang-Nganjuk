// Small deterministic SVG layout; no graph-rendering dependency.
export function layoutRoadLesson(lesson) {
  const width=Math.max(850,Math.min(1400,lesson.nodes.length*85)),height=600;
  const first=lesson.nodes.find(n=>n.id===lesson.start),last=lesson.nodes.find(n=>n.id===lesson.goal);
  const dx=last.longitude-first.longitude,dy=last.latitude-first.latitude;
  const length=Math.hypot(dx,dy)||1;
  const projected=lesson.nodes.map(n=>({id:n.id,
    along:((n.longitude-first.longitude)*dx+(n.latitude-first.latitude)*dy)/(length*length),
    across:((n.longitude-first.longitude)*-dy+(n.latitude-first.latitude)*dx)/length}));
  const span=Math.max(...projected.map(n=>Math.abs(n.across)),0.00001);
  const points=projected.map((n,i)=>({...n,
    x:Math.max(100,Math.min(width-100,85+n.along*(width-170))),
    y:height/2-n.across/span*180+(i%2 ? 15 : -15)}));
  const byId=new Map(points.map(n=>[n.id,n]));
  const pairs=[...new Set(lesson.edges.map(e=>[e.source,e.target].sort().join('|')))].map(key=>key.split('|'));
  for(let iteration=0;iteration<230;iteration++) {
    const force=new Map(points.map(n=>[n.id,{x:0,y:0}]));
    for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) {
      const a=points[i],b=points[j];
      let x=a.x-b.x,y=a.y-b.y;
      if(Math.hypot(x,y)<1) { x=(i%2?1:-1);y=1; }
      const distance=Math.max(1,Math.hypot(x,y));
      const strength=Math.min(12,12500/(distance*distance));
      force.get(a.id).x+=x/distance*strength;force.get(a.id).y+=y/distance*strength;
      force.get(b.id).x-=x/distance*strength;force.get(b.id).y-=y/distance*strength;
    }
    for(const [source,target] of pairs) {
      const a=byId.get(source),b=byId.get(target),x=b.x-a.x,y=b.y-a.y,d=Math.max(1,Math.hypot(x,y));
      const strength=(d-185)*0.018;
      force.get(a.id).x+=x/d*strength;force.get(a.id).y+=y/d*strength;
      force.get(b.id).x-=x/d*strength;force.get(b.id).y-=y/d*strength;
    }
    for(const node of points) {
      if(node.id===lesson.start || node.id===lesson.goal) {
        node.x=node.id===lesson.start?65:width-65;node.y=height/2;continue;
      }
      node.x=Math.max(145,Math.min(width-145,node.x+force.get(node.id).x));
      node.y=Math.max(70,Math.min(height-100,node.y+force.get(node.id).y));
    }
  }
  const groups=new Map();
  lesson.edges.forEach(edge=>{const key=[edge.source,edge.target].sort().join('|');groups.set(key,[...(groups.get(key)??[]),edge.id]);});
  const edges=lesson.edges.map(edge=>{
    const a=byId.get(edge.source),b=byId.get(edge.target),dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy));
    const siblings=groups.get([edge.source,edge.target].sort().join('|'));
    const offset=siblings.length>1 ? (siblings.indexOf(edge.id)-(siblings.length-1)/2)*65*(edge.source<edge.target?1:-1) : 0;
    const c={x:(a.x+b.x)/2-dy/d*offset,y:(a.y+b.y)/2+dx/d*offset};
    const start={x:a.x+(c.x-a.x)*25/Math.max(1,Math.hypot(c.x-a.x,c.y-a.y)),y:a.y+(c.y-a.y)*25/Math.max(1,Math.hypot(c.x-a.x,c.y-a.y))};
    const end={x:b.x+(c.x-b.x)*27/Math.max(1,Math.hypot(c.x-b.x,c.y-b.y)),y:b.y+(c.y-b.y)*27/Math.max(1,Math.hypot(c.x-b.x,c.y-b.y))};
    return {...edge,from:a,to:b,control:c,path:`M ${start.x} ${start.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`,
      label:{x:(a.x+2*c.x+b.x)/4,y:(a.y+2*c.y+b.y)/4}};
  });
  const obstacles=points.flatMap(n=>[
    {x:n.x-30,y:n.y-30,w:60,h:60},
    {x:n.x-65,y:n.y+28,w:130,h:56},
    {x:n.x-45,y:n.y-46,w:90,h:20},
  ]);
  const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  for(const edge of edges) {
    let best=null;
    for(const t of [.5,.35,.65,.25,.75]) for(const offset of [-15,15,-30,30,0]) {
      const u=1-t,dx=edge.to.x-edge.from.x,dy=edge.to.y-edge.from.y,d=Math.max(1,Math.hypot(dx,dy));
      const x=u*u*edge.from.x+2*u*t*edge.control.x+t*t*edge.to.x-dy/d*offset;
      const y=u*u*edge.from.y+2*u*t*edge.control.y+t*t*edge.to.y+dx/d*offset;
      const rect={x:x-41,y:y-13,w:82,h:26};
      const score=obstacles.reduce((sum,item)=>sum+overlap(rect,item),0)*100+Math.abs(t-.5)*20+Math.abs(offset)*.2;
      if(!best||score<best.score)best={x,y,rect,score};
    }
    edge.label={x:best.x,y:best.y};obstacles.push(best.rect);
  }
  const top=Math.max(0,Math.min(...points.map(n=>n.y))-65);
  const bottom=Math.min(height,Math.max(...points.map(n=>n.y))+90);
  return {width,height:bottom-top,top,nodes:lesson.nodes.map(n=>({...n,...byId.get(n.id)})),edges};
}

export function lessonSnapshot(search,index) {
  const cursor=Math.max(0,Math.min(search.steps.length-1,index));
  const current=search.steps[cursor];
  const known=new Map();
  for(const step of search.steps.slice(0,cursor+1)) {
    if(step.node) known.set(step.node,step);
    step.open.forEach(row=>known.set(row.node,row));
  }
  return {current,known,open:new Set(current.open.map(row=>row.node)),closed:new Set(current.closed),
    revealedNodes:new Set(current.goal?search.path:[]),revealedEdges:new Set(current.goal?search.path_edges:[])};
}

export function sampleLessonVehicle(diagram,lesson,frame) {
  if(!frame) return null;
  if(frame.legIndex!==lesson.leg_index) return frame.phase==='loading'&&lesson.leg_index===0 ? diagram.nodes.find(n=>n.id===lesson.start) : null;
  const byId=new Map(diagram.edges.map(edge=>[edge.id,edge]));
  const path=lesson.searches.guided.path_edges.map(id=>byId.get(id));
  let remaining=Math.max(0,Math.min(1,frame.legProgress))*lesson.distance_m;
  for(let i=0;i<path.length;i++) {
    const edge=path[i];
    if(remaining<=edge.distance_m||i===path.length-1) {
      const t=edge.distance_m?Math.max(0,Math.min(1,remaining/edge.distance_m)):1,u=1-t;
      return {x:u*u*edge.from.x+2*u*t*edge.control.x+t*t*edge.to.x,y:u*u*edge.from.y+2*u*t*edge.control.y+t*t*edge.to.y};
    }
    remaining-=edge.distance_m;
  }
  return null;
}
