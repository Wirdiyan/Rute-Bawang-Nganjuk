import { useEffect, useId, useMemo, useRef } from 'react';
import JourneyControls from './JourneyControls.jsx';
import { createJourneyModel } from '../../simulation/routeJourney.js';
import useJourneyPlayback from '../../simulation/useJourneyPlayback.js';
import { createWholeNodeJourney, sampleWholeNodeJourney } from '../../simulation/wholeNodeJourney.js';

export default function WholeNodeJourney({ optimal, locations, busy=false, dirty=false }) {
  const vehicle=useRef(null),trails=useRef(new Map());
  const id=useId().replace(/:/g,'');
  const prepared=useMemo(()=>{
    if(!optimal||!locations)return {diagram:null,journey:null,error:''};
    try {
      return {diagram:createWholeNodeJourney(optimal),journey:createJourneyModel({
        coordinates:optimal.path_coordinates.map(point=>[point.latitude,point.longitude]),
        route:optimal.route,legs:optimal.legs,stops:[locations.warehouse,...locations.destinations],
      }),error:''};
    }catch(error){return {diagram:null,journey:null,error:error.message};}
  },[optimal,locations]);
  const {diagram,journey,error}=prepared;
  const playback=useJourneyPlayback(journey,!busy&&!dirty);
  const sample=useMemo(()=>sampleWholeNodeJourney(diagram,playback.frame),[diagram,playback.frame]);
  useEffect(()=>{
    const draw=frame=>{
      const current=sampleWholeNodeJourney(diagram,frame);
      if(!current)return;
      vehicle.current?.setAttribute('transform',`translate(${current.position.x} ${current.position.y})`);
      for(const [edge,progress]of current.progress)trails.current.get(edge)?.setAttribute('stroke-dasharray',`${progress} 1`);
    };
    playback.nodeRendererRef.current=draw;draw(playback.getCurrentFrame());
    return ()=>{if(playback.nodeRendererRef.current===draw)playback.nodeRendererRef.current=null;};
  },[diagram,playback.nodeRendererRef,playback.getCurrentFrame]);
  return <section className="whole-node-panel panel" aria-label="Simulasi node perjalanan keseluruhan">
    <div className="whole-node-heading"><div><span className="lesson-kicker">SIMULASI NODE KESELURUHAN</span><h2>Satu perjalanan, kembali ke gudang</h2><p>Seluruh ruas ditampilkan sekaligus. Kendaraan berangkat dari Sukomoro, mengunjungi tujuan sesuai hasil perhitungan, lalu kembali ke node gudang yang sama.</p></div><span className="eyebrow-badge">PULANG–PERGI</span></div>
    {!diagram?<p className="whole-node-empty" role={error?'alert':'status'}>{error||'Tekan Hitung rute di konfigurasi untuk menampilkan siklus lengkap beserta node perantaranya.'}</p>:<>
      <ol className="whole-node-route" aria-label="Rute perjalanan keseluruhan">{optimal.route.map((name,index)=><li key={`${name}-${index}`} className={index===0||index===optimal.route.length-1?'depot':''}><span>{index===0?'Mulai':index===optimal.route.length-1?'Kembali':`Tujuan ${index}`}</span><strong>{name}</strong></li>)}</ol>
      <div className="whole-node-legend"><span><i className="destination"/>Gudang / tujuan</span><span><i className="junction"/>Node perantara</span><span><i className="selected"/>Jalur terpilih</span><span><i className="alternative"/>Alternatif koridor</span><span><i className="traveled"/>Sudah dilalui</span></div>
      <div className="whole-node-scroll" tabIndex="0" role="region" aria-label="Diagram node seluruh perjalanan, geser bila perlu"><svg className="whole-node-svg" viewBox={`0 0 ${diagram.width} ${diagram.height}`} role="img" aria-label={`Siklus node ${optimal.route.join(' ke ')}`}>
        <defs>{['selected','alternative'].map(tone=><marker key={tone} id={`${id}-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={tone==='selected'?'#7a9c85':'#c6cec8'}/></marker>)}</defs>
        {diagram.edges.map(edge=><g key={edge.id} className={`whole-node-edge ${edge.selected?'selected':'alternative'}`}><path d={edge.path} markerEnd={`url(#${id}-${edge.selected?'selected':'alternative'})`}/>{edge.selected&&<path className="whole-node-trail" ref={element=>{if(element)trails.current.set(edge.id,element);else trails.current.delete(edge.id);}} d={edge.path} pathLength="1" strokeDasharray="0 1"/>}<g transform={`translate(${edge.label.x} ${edge.label.y})`}><rect x="-35" y="-10" width="70" height="20" rx="4"/><text textAnchor="middle" dominantBaseline="central">{(edge.distanceM/1000).toFixed(3)} km</text></g><title>Ruas {edge.legIndex+1}: {edge.from.name} → {edge.to.name}; {(edge.distanceM/1000).toFixed(3)} km</title></g>)}
        <g className="whole-node-total"><text x="620" y="417" textAnchor="middle">TOTAL PERJALANAN</text><text x="620" y="455" textAnchor="middle" className="whole-node-total-value">{(diagram.totalDistanceM/1000).toFixed(3)} km</text><text x="620" y="484" textAnchor="middle">{optimal.request.destinations.length} tujuan · berangkat dan kembali ke Sukomoro</text></g>
        {diagram.nodes.map(node=><g key={node.id} className={`whole-node-location ${node.kind} ${sample?.visited.has(node.id)?'visited':''} ${sample?.activeNode===node.id?'active':''}`} transform={`translate(${node.x} ${node.y})`}><circle r={node.kind==='junction'?19:29}/><text className="whole-node-code" textAnchor="middle" dominantBaseline="central">{node.code}</text><foreignObject x={node.kind==='junction'?-60:-90} y={node.kind==='junction'?27:38} width={node.kind==='junction'?120:180} height="52"><div className="whole-node-name">{node.kind==='depot'?`Gudang ${node.name}`:node.name}</div></foreignObject><title>{node.kind==='junction'?`Ruas ${node.legIndex+1}, node perantara ${node.code}`:node.kind==='depot'?'Gudang yang sama untuk berangkat dan kembali':`Tujuan pengiriman ${node.index}`}: {node.name}</title></g>)}
        <g ref={vehicle} className="node-vehicle whole-node-vehicle" transform={`translate(${diagram.first.x} ${diagram.first.y})`} aria-label="Kendaraan pada siklus keseluruhan"><rect x="-17" y="-17" width="34" height="34" rx="9"/><svg x="-12" y="-12" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/></svg></g>
      </svg></div>
      <p className="whole-node-note">Diagram tetap utuh selama animasi. Ada {diagram.legs.map(leg=>leg.intermediateCount).join(' / ')} node perantara pada masing-masing ruas. Nama “dekat” dan bobot jalan memakai koridor OSM yang sama dengan simulasi per ruas; posisi diagram tidak berskala geografis.</p>
      <div className="whole-node-legs" aria-label="Status ruas perjalanan keseluruhan">{diagram.legs.map(leg=><div key={leg.index} className={sample?.legIndex===leg.index?'active':''}><span>Ruas {leg.index+1}</span><strong>{leg.from} → {leg.to}</strong><small>{(leg.distanceM/1000).toFixed(3)} km · {leg.intermediateCount} perantara</small></div>)}</div>
    </>}
    <JourneyControls model={journey} playback={playback} disabled={busy||dirty} busy={busy} dirty={dirty} error={error}/>
  </section>;
}
