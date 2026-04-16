// TripMind loading screen
import { CSS } from '../constants/css.js';

export function Loading({msg,pct}){
  // Parse "Days ready: X / Y" for the grid if present
  const gridMatch=msg&&msg.match(/Days ready:\s*(\d+)\s*\/\s*(\d+)/);
  const doneDays=gridMatch?parseInt(gridMatch[1]):null;
  const totalDaysLoading=gridMatch?parseInt(gridMatch[2]):null;
  return(
    <div style={{minHeight:"100vh",background:"#111",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif',gap:20,padding:28}}>
      <style>{CSS}</style>
      <div style={{fontSize:"3.2rem",animation:"pulse 2s infinite"}}>🗺️</div>
      <div style={{fontSize:"1.25rem",fontWeight:900,textAlign:"center",color:"#fff",letterSpacing:"-.01em"}}>Building Your Trip</div>
      <div style={{fontSize:".84rem",color:"var(--tm-border)",maxWidth:300,textAlign:"center",lineHeight:1.6,minHeight:38}}>{msg}</div>
      {/* Progress bar */}
      <div style={{width:"100%",maxWidth:300}}>
        <div style={{background:"rgba(200,217,230,.2)",borderRadius:50,height:6,overflow:"hidden"}}>
          <div style={{height:"100%",background:"var(--tm-surface2)",borderRadius:50,width:pct+"%",transition:"width .35s ease"}}/>
        </div>
        <div style={{textAlign:"center",fontSize:".72rem",color:"var(--tm-text3)",marginTop:5}}>{Math.round(pct)}%</div>
      </div>
      {/* Per-day grid — shows once parallel generation starts */}
      {totalDaysLoading&&<div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",maxWidth:320}}>
        {Array.from({length:totalDaysLoading},(_,i)=>{
          const done=i<doneDays;
          return(
            <div key={i} style={{width:36,height:36,borderRadius:10,background:done?"#555":"rgba(200,217,230,.12)",border:"1.5px solid "+(done?"var(--tm-border)":"rgba(200,217,230,.2)"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:".65rem",fontWeight:700,color:done?"#fff":"rgba(200,217,230,.35)",transition:"all .3s"}}>
              {done?"✓":"D"+(i+1)}
            </div>
          );
        })}
      </div>}
      {!totalDaysLoading&&<Spin size={26}/>}
    </div>
  );
}
