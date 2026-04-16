// TripMind realtime status panel
import { useState, useEffect } from 'react';
import { Spin } from './Primitives.jsx';

export function RealtimeStatusPanel({day,onReoptimize,onRefreshNow,realtimeEnabled,onToggleRealtime}){
  const banner=buildRealtimeBanner(day);
  const realtimeSuggestions=day?.realtime?.realtimeSuggestions||[];
  const nowTime=day?.realtime?.nowTime||"";
  return(
    <div className="fu" style={{display:"grid",gap:14}}>
      {/* Toggle + status */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <button onClick={onToggleRealtime} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #E8E8E8",background:realtimeEnabled?"#111":"#fff",color:realtimeEnabled?"#fff":"#111",fontWeight:700,fontFamily:"inherit"}}>
            {realtimeEnabled?"🟢 Realtime On":"⭕ Realtime Off"}
          </button>
          <span style={{fontSize:".8rem",color:"var(--tm-text2)"}}>Updates every minute · Now {nowTime||"—"}</span>
        </div>
        <div style={{fontWeight:800,marginBottom:6}}>{banner.title}</div>
        <div style={{fontSize:".82rem",color:"var(--tm-text2)",marginBottom:10}}>{banner.text}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onRefreshNow} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>⟳ Refresh now</button>
          <button onClick={onReoptimize} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>🔀 Re-optimize day</button>
        </div>
      </div>
      {/* Realtime suggestions */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Live suggestions</div>
        <div style={{display:"grid",gap:10}}>
          {realtimeSuggestions.map(s=>(
            <div key={s.id} style={{border:"1px solid #E8E8E8",borderRadius:12,padding:12,background:s.type==="weather"?"#fef9ec":s.type==="route"?"#fef2f2":"var(--tm-surface)",borderLeft:"3px solid "+(s.type==="weather"?"#b45309":s.type==="route"?"#dc2626":s.type==="next_step"?"#555":"var(--tm-border)")}}>
              <div style={{fontWeight:700,fontSize:".88rem"}}>{s.label}</div>
              <div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:4}}>{s.text}</div>
            </div>
          ))}
          {!realtimeSuggestions.length&&<div style={{color:"var(--tm-text2)",fontSize:".82rem"}}>No live suggestions right now.</div>}
        </div>
      </div>
      {/* Live timeline */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Today's live timeline</div>
        <div style={{display:"grid",gap:8}}>
          {(day?.activities||[]).map(a=>{
            const isLive=a.liveStatus==="live",isSoon=a.liveStatus==="soon",isDone=a.liveStatus==="missed_or_done"||a.liveStatus==="just_finished";
            return(
              <div key={a._id||a.name} style={{padding:"10px 12px",borderRadius:10,background:isLive?"var(--tm-border)":isSoon?"#fef9ec":"var(--tm-surface)",border:"1.5px solid "+(isLive?"#555":isSoon?"#d97706":"var(--tm-border)"),opacity:isDone?.55:1}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:".86rem"}}>{typeEmoji(a.type)} {a.name}</div>
                    <div style={{fontSize:".73rem",color:"var(--tm-text2)",marginTop:2}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
                  </div>
                  <span style={{padding:"3px 9px",borderRadius:999,background:"var(--tm-bg)",border:"1px solid #E8E8E8",fontSize:".68rem",fontWeight:700,height:"fit-content",whiteSpace:"nowrap",color:isLive?"#111":isSoon?"#d97706":isDone?"#8A9CAA":"#555"}}>
                    {isLive?"● Live":isSoon?"⏱ Soon":isDone?"✓ Done":a.liveStatus==="upcoming"?"○ Upcoming":"○ Unscheduled"}
                  </span>
                </div>
                {a.liveWarning&&<div style={{marginTop:7,fontSize:".76rem",color:"#b45309",background:"#fef9ec",padding:"5px 8px",borderRadius:6}}>⚠ {a.liveWarning}</div>}
              </div>
            );
          })}
          {!(day?.activities||[]).length&&<div style={{color:"var(--tm-text3)",fontSize:".82rem",textAlign:"center",padding:"16px 0"}}>No activities for this day yet.</div>}
        </div>
      </div>
    </div>
  );
}
