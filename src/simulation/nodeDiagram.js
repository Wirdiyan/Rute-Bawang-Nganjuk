// A small schematic of the selected visit order, not geographic coordinates.
export function createNodeDiagram(route, legs = []) {
  const names = [...new Set(route ?? [])];
  if (names.length < 2 || names.length > 4) return null;
  const layouts = {
    2: [[140,210],[500,210]],
    3: [[320,310],[120,100],[520,100]],
    4: [[125,300],[125,100],[515,100],[515,300]],
  };
  const nodes = names.map((name,index) => ({name,index,x:layouts[names.length][index][0],y:layouts[names.length][index][1]}));
  const byName = new Map(nodes.map(node => [node.name,node]));
  const edges = legs.map((leg,index) => {
    const from = byName.get(leg.from), to = byName.get(leg.to);
    if (!from || !to || from === to || !Number.isFinite(leg.distance_m) || leg.distance_m < 0) throw new Error('Ruas diagram tidak valid.');
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
    const normal={x:-dy/length,y:dx/length};
    const curve=nodes.length===2 ? -75 : 0;
    const control={x:(from.x+to.x)/2+normal.x*curve,y:(from.y+to.y)/2+normal.y*curve};
    const startT=36/length,endT=1-startT;
    const edge={index,from,to,control,distanceM:leg.distance_m,startT,endT};
    const a=pointOnEdge(edge,startT),b=pointOnEdge(edge,endT);
    // Exact quadratic sub-curve so arrowheads stop outside the node circle.
    const c={x:a.x+(endT-startT)*((1-startT)*(control.x-from.x)+startT*(to.x-control.x)),
      y:a.y+(endT-startT)*((1-startT)*(control.y-from.y)+startT*(to.y-control.y))};
    const middle=pointOnEdge(edge,0.5);
    const labelOffset=nodes.length===2 ? -28 : 26;
    return {...edge,path:`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`,
      label:{x:middle.x+normal.x*labelOffset,y:middle.y+normal.y*labelOffset}};
  });
  return {nodes,edges,totalDistanceM:legs.reduce((sum,leg)=>sum+leg.distance_m,0)};
}

export function pointOnEdge(edge,progress) {
  const t=Math.max(0,Math.min(1,progress)),u=1-t;
  return {x:u*u*edge.from.x+2*u*t*edge.control.x+t*t*edge.to.x,
    y:u*u*edge.from.y+2*u*t*edge.control.y+t*t*edge.to.y};
}

export function sampleNodeDiagram(diagram,frame) {
  if (!diagram || !frame) return null;
  const edge=diagram.edges[frame.legIndex];
  const traveling=frame.phase==='travel';
  const position=edge ? pointOnEdge(edge,traveling ? frame.legProgress : 1) : diagram.nodes[0];
  const progress=diagram.edges.map((item,index)=>{
    if (frame.phase==='loading') return 0;
    if (index<frame.legIndex || frame.phase==='finished') return 1;
    if (index>frame.legIndex) return 0;
    return traveling ? Math.max(0,Math.min(1,(frame.legProgress-item.startT)/(item.endT-item.startT))) : 1;
  });
  return {position,progress};
}
