// TripMind live trip control panel
export function LiveTripControlPanel({day,lateRisk,controlActions,onDelay,onSkipNext,onRebuild,onRefresh}){
  const next=lateRisk?.nextActivity||null;
  const lvl=lateRisk?.level;
  return(
    <div style={{display:"grid",gap:14}}>
      {/* Status card */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:8}}>🗺 Live trip control</div>
        <div style={{padding:"10px 12px",borderRadius:10,background:lvl==="late"?"#fef2f2":lvl==="tight"?"#fff7ed":"var(--tm-surface)",color:"var(--tm-text)",marginBottom:12,fontSize:".84rem",lineHeight:1.5}}>
          {lateRisk?.text||"No live timing info available."}
        </div>
        {next&&<div style={{border:"1px solid #E8E8E8",borderRadius:10,padding:12,background:"var(--tm-surface)",marginBottom:12}}>
          <div style={{fontWeight:700}}>{typeEmoji(next.type)} {next.name}</div>
          <div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:3}}>{next.time||"--:--"} · {next.type||"Activity"}</div>
          {(lateRisk?.km!=null||lateRisk?.etaMinutes!=null)&&<div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:5}}>
            {lateRisk.km!=null?`${lateRisk.km} km`:""}{lateRisk.km!=null&&lateRisk.etaMinutes!=null?" · ":""}{lateRisk.etaMinutes!=null?`${lateRisk.etaMinutes} min away`:""}
          </div>}
        </div>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onRefresh} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>⟳ Refresh</button>
          <button onClick={()=>onDelay(15)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+15 min</button>
          <button onClick={()=>onDelay(30)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+30 min</button>
          <button onClick={()=>onDelay(60)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+60 min</button>
          {next&&<button onClick={onSkipNext} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#b91c1c",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>⏭ Skip next stop</button>}
          <button onClick={onRebuild} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>🔀 Rebuild rest of day</button>
        </div>
      </div>
      {/* Suggested actions */}
      {(controlActions||[]).length>0&&<div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Suggested actions</div>
        <div style={{display:"grid",gap:8}}>
          {(controlActions||[]).map(a=>(
            <div key={a.id} style={{padding:"10px 12px",borderRadius:10,background:a.type==="info"?"var(--tm-surface)":a.type==="skip"?"#fef2f2":a.type==="rebuild"?"var(--tm-border)":"#fff7ed",border:"1px solid #E8E8E8",borderLeft:"3px solid "+(a.type==="info"?"var(--tm-border)":a.type==="skip"?"#dc2626":a.type==="rebuild"?"#555":"#d97706")}}>
              <div style={{fontWeight:700,fontSize:".86rem"}}>{a.label}</div>
              <div style={{fontSize:".73rem",color:"var(--tm-text3)",marginTop:2,textTransform:"capitalize"}}>{a.type}</div>
            </div>
          ))}
        </div>
      </div>}
      {/* Timeline */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Today's timeline</div>
        <div style={{display:"grid",gap:8}}>
          {(day?.activities||[]).map(a=>(
            <div key={a._id||a.name} style={{padding:"10px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid #E8E8E8"}}>
              <div style={{fontWeight:700,fontSize:".86rem"}}>{typeEmoji(a.type)} {a.name}</div>
              <div style={{fontSize:".76rem",color:"var(--tm-text2)",marginTop:3}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
              {a.liveAdjustment&&<div style={{fontSize:".68rem",color:"var(--tm-text2)",marginTop:4,fontStyle:"italic"}}>Adjusted: {a.liveAdjustment?.type}</div>}
            </div>
          ))}
          {!(day?.activities||[]).length&&<div style={{color:"var(--tm-text3)",fontSize:".82rem",textAlign:"center",padding:"14px 0"}}>No activities scheduled.</div>}
        </div>
      </div>
    </div>
  );
}
