import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { layoutRoadLesson, lessonSnapshot, sampleLessonVehicle } from '../../simulation/roadLesson.js';

const km=value=>`${(value/1000).toFixed(3)} km`;

export default function NodeSimulation({ optimal, playback, mode, disabled=false }) {
  const [legIndex,setLegIndex]=useState(0);
  const [method,setMethod]=useState('guided');
  const [cursor,setCursor]=useState(0);
  const [playing,setPlaying]=useState(false);
  const marker=useRef(null);
  const id=useId().replace(/:/g,'');
  const lessons=optimal?.road_lessons??[];
  const activeLeg=mode==='journey' ? (playback.frame?.legIndex??0) : legIndex;
  const lesson=lessons[activeLeg]??lessons[0];
  const search=lesson?.searches[mode==='journey'?'guided':method];
  const diagram=useMemo(()=>lesson?layoutRoadLesson(lesson):null,[lesson]);
  const shownCursor=mode==='journey'&&search?search.steps.length-1:cursor;
  const snapshot=useMemo(()=>search?lessonSnapshot(search,shownCursor):null,[search,shownCursor]);
  const byId=useMemo(()=>new Map((lesson?.nodes??[]).map(n=>[n.id,n])),[lesson]);
  useEffect(()=>{setCursor(0);setPlaying(false);},[lesson,method,mode]);
  useEffect(()=>{
    if(!playing||disabled||mode!=='search'||!search)return undefined;
    const timer=setInterval(()=>setCursor(value=>Math.min(value+1,search.steps.length-1)),1200);
    return ()=>clearInterval(timer);
  },[playing,disabled,mode,search]);
  useEffect(()=>{if(disabled||cursor>=(search?.steps.length??1)-1)setPlaying(false);},[disabled,cursor,search]);
  useEffect(()=>{
    const draw=frame=>{
      if(!marker.current||!diagram||!lesson)return;
      const point=mode==='journey'?sampleLessonVehicle(diagram,lesson,frame):null;
      marker.current.setAttribute('visibility',point?'visible':'hidden');
      if(point)marker.current.setAttribute('transform',`translate(${point.x} ${point.y})`);
    };
    playback.nodeRendererRef.current=draw;draw(playback.frame);
    return ()=>{if(playback.nodeRendererRef.current===draw)playback.nodeRendererRef.current=null;};
  },[diagram,lesson,mode,playback.nodeRendererRef]);
  if(!lesson||!diagram||!snapshot)return <div className="node-empty"><h2>Cari jalan lewat simpang dan permukiman</h2><p>Tekan <strong>Hitung rute</strong> untuk menyiapkan pilihan jalan OSM. Setiap ruas akan menampilkan 2–4 node perantara, lalu jalurnya dipelajari langkah demi langkah.</p></div>;
  const {current,known,open,closed,revealedEdges,revealedNodes}=snapshot;
  const title=node=>`${byId.get(node)?.code??''} · ${byId.get(node)?.name??node}`;
  const go=value=>{setPlaying(false);setCursor(value);};
  const final=current.goal;
  return <section className="road-lesson" aria-label="Belajar pencarian jalan dengan node">
    <div className="lesson-intro"><span className="lesson-kicker">{mode==='search'?'BAGAIMANA JALURNYA DIPILIH?':'PERJALANAN MELALUI SIMPANG'}</span><h2>{lesson.from} → {lesson.to}</h2><p><strong>{lesson.nodes.length-2} node perantara</strong> · {lesson.alternative_corridors} koridor contoh · {optimal.request.destinations.length} tujuan pengiriman tetap. Simpang perantara bukan tujuan bongkar.</p></div>
    {mode==='search'&&<div className="lesson-selectors"><label>Pelajari ruas<select aria-label="Pelajari ruas" value={legIndex} disabled={disabled} onChange={event=>{go(0);setLegIndex(Number(event.target.value));}}>{lessons.map((item,index)=><option key={index} value={index}>{index+1}. {item.from} → {item.to}{index===lessons.length-1?' · pulang':''}</option>)}</select></label><label>Metode pada satu ruas<select aria-label="Metode pencarian ruas" value={method} disabled={disabled} onChange={event=>{go(0);setMethod(event.target.value);}}><option value="guided">A* · perkiraan jarak lurus</option><option value="zero">Tanpa heuristik · Dijkstra</option></select></label></div>}
    <div className="lesson-legend"><span><i className="unseen"/>Belum diperiksa</span><span><i className="frontier"/>OPEN</span><span><i className="active"/>Diperiksa</span><span><i className="closed"/>CLOSED</span><span><i className="solved"/>Jalur hasil</span></div>
    <div className="lesson-diagram-scroll" tabIndex="0" role="region" aria-label="Diagram cabang jalan, geser untuk melihat seluruh node"><svg className="lesson-svg" viewBox={`0 ${diagram.top} ${diagram.width} ${diagram.height}`} style={{minWidth:650}} role="img" aria-label={`Pilihan jalan dari ${lesson.from} ke ${lesson.to}, langkah ${shownCursor}`}>
      <defs>{['base','solved','examined'].map(tone=><marker key={tone} id={`${id}-${tone}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={tone==='solved'?'#15803d':tone==='examined'?'#b7791f':'#a9b4ac'}/></marker>)}</defs>
      {diagram.edges.map(edge=>{const solved=revealedEdges.has(edge.id),examined=current.updates.some(update=>update.edge===edge.id);return <g key={edge.id} className={`lesson-edge ${solved?'solved':examined?'examined':''}`}><path d={edge.path} markerEnd={`url(#${id}-${solved?'solved':examined?'examined':'base'})`}/><g transform={`translate(${edge.label.x} ${edge.label.y})`}><rect x="-38" y="-10" width="76" height="20" rx="4"/><text textAnchor="middle" dominantBaseline="central">{km(edge.distance_m)}</text></g><title>{title(edge.source)} → {title(edge.target)}; {km(edge.distance_m)}; {edge.road_node_count} node jalan</title></g>;})}
      {diagram.nodes.map(node=>{const row=known.get(node.id),state=revealedNodes.has(node.id)?'solved':current.node===node.id?'active':closed.has(node.id)?'closed':open.has(node.id)?'frontier':'unseen';return <g key={node.id} className={`lesson-node ${state}`} transform={`translate(${node.x} ${node.y})`}><title>{title(node.id)}{node.locality?`; titik permukiman OSM berjarak ${Math.round(node.locality.distance_m)} m dari simpang`:''}; node jalan {node.id}</title><circle r="23"/><text className="lesson-code" textAnchor="middle" dominantBaseline="central">{node.code}</text>{row&&<text className="lesson-f" y="-34" textAnchor="middle">f = {(row.f/1000).toFixed(3)}</text>}<foreignObject x="-60" y="30" width="120" height="52"><div className="lesson-node-name">{node.name}</div></foreignObject></g>;})}
      <g ref={marker} className="node-vehicle" visibility="hidden" aria-label="Kendaraan pada diagram jalan"><rect x="-16" y="-16" width="32" height="32" rx="8"/><svg x="-11" y="-11" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/></svg></g>
    </svg></div>
    <p className="lesson-hint">Geser diagram bila perlu. Panah = jarak jalan (km); f = prioritas node (km). Setiap panah merangkum ruas jalan berarah yang sebenarnya.</p>
    {mode==='search'&&<>
      <div className="lesson-controls"><button onClick={()=>go(0)} disabled={disabled||cursor===0}>Awal</button><button onClick={()=>go(Math.max(0,cursor-1))} disabled={disabled||cursor===0} aria-label="Langkah sebelumnya">←</button><button className="lesson-play" onClick={()=>{if(final)setCursor(0);setPlaying(!playing);}} disabled={disabled}>{playing?'Jeda':'Putar pencarian'}</button><button onClick={()=>go(Math.min(search.steps.length-1,cursor+1))} disabled={disabled||final}>Langkah berikutnya →</button><button onClick={()=>go(search.steps.length-1)} disabled={disabled||final}>Lihat hasil</button></div>
      <label className="lesson-seek">Langkah {Math.min(cursor,search.steps.length-1)} dari {search.steps.length-1}<input type="range" min="0" max={search.steps.length-1} value={Math.min(cursor,search.steps.length-1)} disabled={disabled} aria-label="Langkah pencarian jalan" onChange={event=>go(Number(event.target.value))}/></label>
      <div className="lesson-explanation" role="status"><strong>{current.node?final?`Tujuan ${lesson.to} tercapai`:`Periksa ${title(current.node)}`:'Mulai dari S, jalur hasil belum ditampilkan'}</strong><p>{!current.node?'Masukkan S ke OPEN. Pilih kandidat dengan f terkecil, lalu hitung biaya menuju setiap tetangganya.':final?`Jarak minimum ${km(search.distance_m)}. Telusuri parent dari T kembali ke S untuk membentuk jalur hijau.`:`Node ini dipilih dari OPEN dengan f terkecil saat itu: g ${km(current.g)} + h ${km(current.h)} = f ${km(current.f)}.`}</p></div>
      {current.updates.length>0&&<ul className="lesson-updates" aria-label="Perhitungan tetangga">{current.updates.map(update=><li key={update.edge}><strong>{byId.get(update.node)?.code}</strong><span>g baru = {(current.g/1000).toFixed(3)} + {(update.edge_m/1000).toFixed(3)} = {(update.candidate_g/1000).toFixed(3)} km; h = {(update.h/1000).toFixed(3)}; f = {(update.f/1000).toFixed(3)}</span><em>{update.improved?'Simpan ke OPEN':`Abaikan: g lama ${(update.old_g/1000).toFixed(3)} km lebih baik / sama`}</em></li>)}</ul>}
      <div className="lesson-open"><h3>OPEN setelah langkah ini</h3>{current.open.length?<div className="lesson-table-scroll"><table><thead><tr><th>Node</th><th>g (km)</th><th>h (km)</th><th>f (km)</th></tr></thead><tbody>{current.open.map(row=><tr key={row.node}><th>{title(row.node)}</th><td>{(row.g/1000).toFixed(3)}</td><td>{(row.h/1000).toFixed(3)}</td><td>{(row.f/1000).toFixed(3)}</td></tr>)}</tbody></table></div>:<p>OPEN kosong.</p>}<p className="lesson-hint">Urut f terkecil. Kandidat dengan f sama dapat diperiksa dalam urutan berbeda.</p></div>
    </>}
    {final&&<div className="lesson-result"><strong>Jalur minimum · {km(search.distance_m)}</strong><p>{search.path.map(node=>title(node)).join(' → ')}</p>{mode==='search'&&<p>Pada graf yang sama: A* memeriksa {lesson.searches.guided.expanded} node, Dijkstra {lesson.searches.zero.expanded} node. Jarak minimum keduanya {km(search.distance_m)}.</p>}</div>}
    <details className="lesson-method"><summary>Arti g, h, f dan hubungan dengan MST</summary><p><strong>g</strong>: jarak dari awal ruas. <strong>h</strong>: perkiraan jarak tersisa. <strong>f = g + h</strong>: prioritas OPEN.</p><p>Pelajaran satu ruas ini memakai h jarak lurus ke T, atau h = 0 pada Dijkstra. MST di konfigurasi dipakai untuk seluruh perjalanan multi-tujuan: biaya pohon minimum geometris yang menghubungkan posisi saat ini, tujuan tersisa, dan gudang. MST adalah perkiraan, bukan rute kendaraan.</p><p>{lesson.scope} Ini jarak terpendek; waktu tempuh dan lalu lintas belum dimodelkan.</p></details>
    <details className="lesson-method"><summary>Sumber nama permukiman dan simpang</summary><p>“Dekat” berarti dekat titik label permukiman OSM; bukan bukti berada dalam batas desa itu. Beberapa simpang boleh merujuk permukiman yang sama. Posisi diagram tidak berskala geografis.</p><ul>{lesson.nodes.filter(node=>node.locality).map(node=><li key={node.id}>{node.code}: <a href={node.locality.source_url} target="_blank" rel="noreferrer">{node.locality.name}</a> · {node.locality.place_type} · {Math.round(node.locality.distance_m)} m dari titik label</li>)}</ul><p>© OpenStreetMap contributors · ODbL · diambil {lesson.locality_source.fetched_at_utc?new Date(lesson.locality_source.fetched_at_utc).toLocaleDateString('id-ID'):'—'}</p></details>
  </section>;
}
