// TripMind DayMap component
import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';

function domEl(tag,styles,children){
  const e=document.createElement(tag);
  if(styles) Object.assign(e.style,styles);
  (children||[]).forEach(c=>{
    if(c==null) return;
    e.appendChild(typeof c==="string"?document.createTextNode(c):c);
  });
  return e;
}

export function DayMap({acts,destination,hotel,isFirstDay,isLastDay,userLoc,onRequestLocation,visible,onReady,zoomToActId}){
  const containerRef=useRef(null);
  const mapRef=useRef(null);
  const markersRef=useRef([]);
  const markerMapRef=useRef({});
  const animRafRef=useRef(null);
  const [mapLoaded,setMapLoaded]=useState(false);
  const [plotting,setPlotting]=useState(false);
  const actNamesKey=acts.map(a=>(a._id||a.name)||'').join('\x00');
  const geoAbortRef=useRef({cancelled:false});

  // ── Build marker DOM elements using only DOM APIs (no innerHTML) ─────────────
  function makeActPin(emoji,num){
    const outer=domEl('div',{position:'relative',width:'48px',height:'48px',borderRadius:'50%',background:'var(--tm-bg)',border:'2.5px solid #111',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 14px rgba(0,0,0,.28)',cursor:'pointer',transition:'filter .18s'});
    const em=domEl('span',{fontSize:'23px',lineHeight:'1',pointerEvents:'none'},[emoji]);
    const badge=domEl('div',{position:'absolute',top:'-6px',right:'-6px',width:'20px',height:'20px',borderRadius:'50%',background:'#111',border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center'});
    badge.appendChild(domEl('span',{fontSize:'9px',fontWeight:'900',color:'#fff',lineHeight:'1'},[String(num)]));
    outer.appendChild(em);outer.appendChild(badge);
    outer.addEventListener('mouseenter',()=>{outer.style.filter='brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,.35))';});
    outer.addEventListener('mouseleave',()=>{outer.style.filter='';});
    return outer;
  }
  function makeSquarePin(emoji,bg,labelText,labelColor){
    const outer=domEl('div',{width:'44px',height:'44px',borderRadius:'12px',background:bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(0,0,0,.36)',border:'2.5px solid #fff',cursor:'pointer',transition:'filter .18s'});
    outer.appendChild(domEl('span',{fontSize:'19px',lineHeight:'1',pointerEvents:'none'},[emoji]));
    outer.appendChild(domEl('span',{fontSize:'5.5px',color:labelColor||'#fff',fontWeight:'900',letterSpacing:'.04em',marginTop:'1px',pointerEvents:'none'},[labelText]));
    outer.addEventListener('mouseenter',()=>{outer.style.filter='brightness(1.12) drop-shadow(0 4px 8px rgba(0,0,0,.35))';});
    outer.addEventListener('mouseleave',()=>{outer.style.filter='';});
    return outer;
  }
  function makePopup(act,em,dest){
    const gyg='https://www.getyourguide.com/s/?q='+encodeURIComponent(act.name+' '+dest);
    const timing=[act.time,act.duration].filter(Boolean).join(' · ');
    const wrap=domEl('div',{fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif',maxWidth:'215px'});
    wrap.appendChild(domEl('div',{fontSize:'20px',marginBottom:'4px'},[em]));
    wrap.appendChild(domEl('b',{fontSize:'13px',color:'#2C365A'},[act.name]));
    if(timing) wrap.appendChild(domEl('div',{fontSize:'11px',color:'#555',marginTop:'3px'},[timing]));
    if(act.address) wrap.appendChild(domEl('div',{fontSize:'10px',color:'#8A9CAA',marginTop:'2px'},['📍 '+act.address]));
    wrap.appendChild(domEl('div',{fontSize:'11px',marginTop:'4px',fontWeight:'600',color:act.isFree?'#555':'#111'},[act.isFree?'Kostenlos':(act.price||'')]));
    if(act.transport) wrap.appendChild(domEl('div',{fontSize:'10px',color:'#555',marginTop:'3px'},['🚌 '+act.transport]));
    if(!act.isFree&&act.price){
      const a=domEl('a',{display:'inline-block',marginTop:'7px',padding:'4px 11px',background:'#dc2626',borderRadius:'5px',color:'#fff',fontSize:'11px',fontWeight:'700',textDecoration:'none'},['Buchen']);
      a.href=gyg; a.target='_blank'; a.rel='noopener noreferrer';
      wrap.appendChild(a);
    }
    return wrap;
  }

  // ── Init map once ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(mapRef.current||!containerRef.current) return;
    const m=new maplibregl.Map({
      container:containerRef.current,
      style:'https://tiles.openfreemap.org/styles/liberty',
      center:[0,20],zoom:2,pitch:30,bearing:0,attributionControl:false,
    });
    m.addControl(new maplibregl.NavigationControl(),'top-right');
    m.on('load',()=>{
      // Colour palette: match app's #111 navy / #E8E8E8 steel-blue scheme
      const safe=(fn)=>{try{fn();}catch(_){}};
      safe(()=>m.setPaintProperty('water','fill-color','#B8D4E8'));
      safe(()=>m.setPaintProperty('waterway','line-color','#9DC2D6'));
      safe(()=>m.setPaintProperty('park','fill-color','#C8DAC8'));
      safe(()=>m.setPaintProperty('landuse-park','fill-color','#C8DAC8'));
      safe(()=>m.setPaintProperty('building','fill-color','#E8ECF0'));
      safe(()=>m.setPaintProperty('building','fill-opacity',.65));
      // Route: fat halo + animated dash on top
      m.addSource('route',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:[]}}});
      m.addLayer({id:'route-halo',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#E8E8E8','line-width':8,'line-opacity':.45}});
      m.addLayer({id:'route-line',type:'line',source:'route',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#111','line-width':3,'line-dasharray':[1,3]}});
      setMapLoaded(true);
    });
    mapRef.current=m;
    return()=>{if(animRafRef.current) cancelAnimationFrame(animRafRef.current);};
  },[]);

  // ── Animate the dashed route line (marching ants effect) ────────────────────
  useEffect(()=>{
    if(!mapLoaded||!mapRef.current) return;
    const m=mapRef.current;
    const steps=[[0,1,3],[.33,1,2.67],[.66,1,2.34],[1,1,2],[0,1,3]];
    let s=0,last=0;
    const tick=(t)=>{
      animRafRef.current=requestAnimationFrame(tick);
      if(t-last<90) return;
      last=t; s=(s+1)%steps.length;
      try{m.setPaintProperty('route-line','line-dasharray',steps[s]);}catch(_){}
    };
    animRafRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(animRafRef.current);
  },[mapLoaded]);

  // ── Geocode + place markers whenever the day changes ─────────────────────────
  useEffect(()=>{
    if(!mapRef.current||!mapLoaded) return;
    geoAbortRef.current.cancelled=true;
    const token={cancelled:false};
    geoAbortRef.current=token;
    const m=mapRef.current;
    markersRef.current.forEach(mk=>mk.remove());
    markersRef.current=[];markerMapRef.current={};
    if(m.getSource('route')) m.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:[]}});
    setPlotting(true);
    const allPoints=[];

    function renderMarkers(){
      if(token.cancelled) return;
      setPlotting(false);
      if(!allPoints.length) return;
      const hotelPt=allPoints.find(p=>p.kind==='hotel');
      const airportPt=allPoints.find(p=>p.kind==='airport');
      const actPts=[...allPoints.filter(p=>p.kind==='act')].sort((a,b)=>a.idx-b.idx);
      // fitBounds — auto-zoom so all stops of this day fit perfectly
      const coords=allPoints.map(p=>[p.lng,p.lat]);
      try{
        const bounds=coords.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0]));
        m.fitBounds(bounds,{padding:{top:60,bottom:80,left:60,right:60},maxZoom:14,duration:900});
      }catch(_){}
      // Update animated route line
      const routeCoords=[];
      if(hotelPt) routeCoords.push([hotelPt.lng,hotelPt.lat]);
      actPts.forEach(p=>routeCoords.push([p.lng,p.lat]));
      if(airportPt) routeCoords.push([airportPt.lng,airportPt.lat]);
      if(routeCoords.length>1&&m.getSource('route'))
        m.getSource('route').setData({type:'Feature',geometry:{type:'LineString',coordinates:routeCoords}});
      // Hotel pin
      if(hotelPt){
        const el=makeSquarePin('🏨','#555','HOTEL');
        const mk=new maplibregl.Marker({element:el,anchor:'bottom'})
          .setLngLat([hotelPt.lng,hotelPt.lat])
          .setPopup(new maplibregl.Popup({offset:14,maxWidth:'200px'}).setDOMContent(domEl('div',{fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif',fontSize:'13px'},[domEl('b',{},['\uD83C\uDFE8 '+hotel]),domEl('div',{fontSize:'11px',color:'#555',marginTop:'3px'},['Dein Hotel'])])))
          .addTo(m);
        markersRef.current.push(mk);
      }
      // Activity pins
      actPts.forEach(p=>{
        const act=p.act;const em=typeEmoji(act.type);
        const el=makeActPin(em,p.idx+1);
        const mk=new maplibregl.Marker({element:el,anchor:'center'})
          .setLngLat([p.lng,p.lat])
          .setPopup(new maplibregl.Popup({offset:30,maxWidth:'230px'}).setDOMContent(makePopup(act,em,destination)))
          .addTo(m);
        markersRef.current.push(mk);
        markerMapRef.current[act._id||act.name]={marker:mk,lat:p.lat,lng:p.lng};
      });
      // Airport pin
      if(airportPt){
        const label=isFirstDay&&isLastDay?'AIRPORT':isFirstDay?'ARRIVAL':'DEPART';
        const el=makeSquarePin('✈️','#111',label,'#E8E8E8');
        const mk=new maplibregl.Marker({element:el,anchor:'bottom'})
          .setLngLat([airportPt.lng,airportPt.lat])
          .setPopup(new maplibregl.Popup({offset:14}).setDOMContent(domEl('div',{fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif',fontSize:'13px'},[domEl('b',{},['✈️ '+(isFirstDay&&isLastDay?'An- & Abreise':isFirstDay?'Ankunft':'Abreise')])])))
          .addTo(m);
        markersRef.current.push(mk);
      }
      // User location dot
      if(userLoc){
        const el=domEl('div',{width:'14px',height:'14px',borderRadius:'50%',background:'#111',border:'3px solid #fff',boxShadow:'0 0 0 3px rgba(47,65,86,.3)'});
        const mk=new maplibregl.Marker({element:el,anchor:'center'})
          .setLngLat([userLoc.lng,userLoc.lat])
          .setPopup(new maplibregl.Popup({offset:12}).setDOMContent(domEl('b',{},['Du bist hier'])))
          .addTo(m);
        markersRef.current.push(mk);
      }
      // Expose zoomTo API to plan-tab
      if(onReady) onReady({zoomTo:(actId)=>{
        const entry=markerMapRef.current[actId];
        if(entry&&mapRef.current){
          mapRef.current.flyTo({center:[entry.lng,entry.lat],zoom:16,speed:.9,essential:true});
          setTimeout(()=>{try{entry.marker.togglePopup();}catch(_){}},600);
        }
      }});
    }

    async function runAllGeocode(){
      // 1. Geocode city center first (needed for viewbox bias)
      const cityCoord=await geocodeQuery(destination);
      if(token.cancelled) return;
      const cityCenter=cityCoord||null;
      if(cityCenter) m.flyTo({center:[cityCenter.lng,cityCenter.lat],zoom:12,duration:800});
      const vb=cityCenter?`${cityCenter.lng-.15},${cityCenter.lat+.15},${cityCenter.lng+.15},${cityCenter.lat-.15}`:null;

      // 2. Build all geocode tasks — hotel, airport, activities — run in parallel
      const tasks=[];
      const taskMeta=[]; // track what each task result maps to

      if(hotel){
        tasks.push(()=>geocodeLocal(hotel+', '+destination,vb));
        taskMeta.push({kind:'hotel'});
      }
      if(isFirstDay||isLastDay){
        tasks.push(()=>geocodeQuery('international airport '+destination));
        taskMeta.push({kind:'airport'});
      }
      if(acts?.length){
        acts.forEach((act,i)=>{
          if(act.lat&&act.lng){
            const ok=!cityCenter||(Math.abs(act.lat-cityCenter.lat)<.5&&Math.abs(act.lng-cityCenter.lng)<.5);
            if(ok){
              // Already geocoded — skip network, add directly
              allPoints.push({lat:act.lat,lng:act.lng,kind:'act',act,idx:i});
              return;
            }
          }
          const q=act.name+(act.address?', '+act.address:'')+', '+destination;
          tasks.push(()=>geocodeLocal(q,vb));
          taskMeta.push({kind:'act',act,idx:i});
        });
      }

      // Run all remaining geocode tasks with concurrency=3 (cache makes repeated queries instant)
      const results=await geocodeBatch(tasks,3);
      if(token.cancelled) return;

      results.forEach((coord,ti)=>{
        if(!coord) return;
        const meta=taskMeta[ti];
        allPoints.push({lat:coord.lat,lng:coord.lng,kind:meta.kind,...(meta.kind==='act'?{act:meta.act,idx:meta.idx}:{})});
      });

      if(!token.cancelled) renderMarkers();
    }
    runAllGeocode();
    return()=>{token.cancelled=true;};
  },[mapLoaded,actNamesKey,destination,hotel,isFirstDay,isLastDay,userLoc]);

  // Zoom to specific activity (from plan-tab tap)
  useEffect(()=>{
    if(!zoomToActId) return;
    const entry=markerMapRef.current[zoomToActId];
    if(entry&&mapRef.current){
      mapRef.current.flyTo({center:[entry.lng,entry.lat],zoom:16,speed:.9,essential:true});
      setTimeout(()=>{try{entry.marker.togglePopup();}catch(_){}},600);
    }
  },[zoomToActId]);

  // Resize map when tab reveals it
  useEffect(()=>{
    if(visible&&mapRef.current){
      setTimeout(()=>{try{mapRef.current.resize();}catch(_){}},60);
      setTimeout(()=>{try{mapRef.current.resize();}catch(_){}},320);
    }
  },[visible]);

  const navUrl=()=>{
    const stops=(acts||[]).map(a=>encodeURIComponent((a.name||'')+' '+destination));
    const orig=hotel?encodeURIComponent(hotel+', '+destination):(stops[0]||'');
    if(!stops.length) return 'https://www.google.com/maps/search/'+encodeURIComponent(hotel||destination);
    return 'https://www.google.com/maps/dir/'+orig+'/'+stops.join('/');
  };

  return(
    <div style={{display:visible?'block':'none'}}>
      <div style={{position:'relative',borderRadius:16,overflow:'hidden',border:'1px solid #E8E8E8',marginBottom:10,height:300,background:'#F0F0F0'}}>
        <div ref={containerRef} style={{width:'100%',height:'100%'}}/>
        {!mapLoaded&&(
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,background:'rgba(247,247,247,.95)'}}>
            <Spin size={26}/><div style={{fontSize:'.78rem',color:'#555'}}>Karte wird geladen…</div>
          </div>
        )}
        {mapLoaded&&plotting&&(
          <div style={{position:'absolute',bottom:12,left:'50%',transform:'translateX(-50%)',background:'rgba(17,17,17,.88)',color:'#fff',fontSize:'.7rem',padding:'5px 14px',borderRadius:50,whiteSpace:'nowrap',pointerEvents:'none',backdropFilter:'blur(6px)'}}>
            Stops werden eingezeichnet…
          </div>
        )}
        {mapLoaded&&!plotting&&(hotel||(isFirstDay||isLastDay))&&(
          <div style={{position:'absolute',top:10,left:10,display:'flex',flexDirection:'column',gap:4,pointerEvents:'none',zIndex:1}}>
            {hotel&&<div style={{background:'rgba(255,255,255,.92)',backdropFilter:'blur(6px)',borderRadius:6,padding:'3px 8px',fontSize:'.62rem',fontWeight:700,color:'#555',display:'flex',alignItems:'center',gap:4}}>🏨 Hotel</div>}
            {(isFirstDay||isLastDay)&&<div style={{background:'rgba(255,255,255,.92)',backdropFilter:'blur(6px)',borderRadius:6,padding:'3px 8px',fontSize:'.62rem',fontWeight:700,color:'#111',display:'flex',alignItems:'center',gap:4}}>✈️ {isFirstDay&&isLastDay?'Airport':isFirstDay?'Arrival':'Departure'}</div>}
          </div>
        )}
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {!userLoc
          ?<button onClick={onRequestLocation} style={{padding:'10px 15px',borderRadius:9,background:'#111',border:'none',color:'#fff',fontSize:'.82rem',fontWeight:700,fontFamily:'inherit',minHeight:44,cursor:'pointer'}}>📍 Mein Standort</button>
          :<span style={{padding:'9px 13px',borderRadius:9,background:'#E8E8E8',border:'1px solid #E8E8E8',fontSize:'.8rem',color:'#555',fontWeight:600}}>📍 Aktiv</span>
        }
        <a href={navUrl()} target="_blank" rel="noreferrer" style={{padding:'10px 15px',borderRadius:9,background:'#111',border:'none',color:'#fff',fontSize:'.82rem',fontWeight:700,display:'flex',alignItems:'center',gap:5,minHeight:44,textDecoration:'none'}}>🧭 Tag navigieren</a>
      </div>
    </div>
  );
}
