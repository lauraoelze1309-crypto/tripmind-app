// TripMind weather fallback panel
export function WeatherFallbackPanel({weatherForecast,selectedActivity,fallbackOptions,onAddAlternative,onReplaceWithFallback,onDismiss}){
  if(!selectedActivity) return(
    <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
      <div style={{fontWeight:800,marginBottom:6}}>🌦 Weather fallback</div>
      <div style={{fontSize:".82rem",color:"var(--tm-text2)"}}>Select an activity first to see weather-based alternatives.</div>
    </div>
  );
  const rainy=weatherLooksRainy(weatherForecast),cold=weatherLooksCold(weatherForecast),hot=weatherLooksHot(weatherForecast);
  const weatherBadge=rainy?"🌧 Rainy":cold?"🥶 Cold":hot?"🌡 Hot":"";
  return(
    <div className="fu" style={{display:"grid",gap:14}}>
      {/* Selected activity + weather context */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:6}}>🌦 Weather fallback options</div>
        <div style={{fontSize:".82rem",color:"var(--tm-text2)",marginBottom:10}}>
          Current weather: <b>{weatherForecast||"unknown"}</b>{weatherBadge?" · "+weatherBadge:""}
        </div>
        <div style={{padding:"10px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid #E8E8E8"}}>
          <div style={{fontWeight:700}}>{typeEmoji(selectedActivity.type)} {selectedActivity.name}</div>
          <div style={{fontSize:".78rem",color:"var(--tm-text2)",marginTop:3}}>{selectedActivity.time||"--:--"} · {selectedActivity.type||"Activity"}</div>
        </div>
      </div>
      {/* Alternatives */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Suggested weather alternatives</div>
        {!fallbackOptions.length&&<div style={{color:"var(--tm-text2)",fontSize:".82rem"}}>No strong weather alternatives found right now.</div>}
        <div style={{display:"grid",gap:10}}>
          {fallbackOptions.map(f=>(
            <div key={f._id} style={{border:"1px solid #E8E8E8",borderRadius:12,padding:12,background:"var(--tm-surface)",borderLeft:"3px solid #555"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                <div>
                  <div style={{fontWeight:800}}>{typeEmoji(f.type)} {f.name}</div>
                  <div style={{fontSize:".76rem",color:"var(--tm-text2)",marginTop:3}}>{f.type}{f.time?` · ${f.time}`:""}{f.duration?` · ${f.duration}`:""}</div>
                </div>
                <span style={{padding:"3px 9px",borderRadius:50,background:"var(--tm-surface2)",color:"var(--tm-text)",fontWeight:700,fontSize:".68rem",flexShrink:0,height:"fit-content"}}>Weather alt</span>
              </div>
              {f.desc&&<div style={{fontSize:".8rem",color:"var(--tm-text)",lineHeight:1.45,marginBottom:6}}>{f.desc}</div>}
              {f.fallbackReason&&<div style={{fontSize:".76rem",color:"var(--tm-text2)",marginBottom:6}}><b>Why this fits:</b> {f.fallbackReason}</div>}
              {f.address&&<div style={{fontSize:".75rem",color:"var(--tm-text3)",marginBottom:8}}>📍 {f.address}</div>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>onAddAlternative(f)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text)",fontWeight:700,fontFamily:"inherit"}}>+ Add as alternative</button>
                <button onClick={()=>onReplaceWithFallback(f)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Replace current activity</button>
                <button onClick={()=>onDismiss(f._id)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text3)",fontWeight:700,fontFamily:"inherit"}}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
