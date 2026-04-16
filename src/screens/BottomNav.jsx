// TripMind bottom navigation
import { getLang, t } from '../constants/i18n.js';

export function BottomNav({tab,setTab,tripsCount}){
  const lang=getLang();
  const T=(k)=>t(lang,k);
  const profile=getUserProfile();
  const initials=getInitials(profile.name||"");
  const userPhoto=profile.photo||null;
  const active=tab===undefined?"home":tab;
  const isDark=document.documentElement.getAttribute("data-theme")==="dark";
  const iconColor=(id)=>active===id?"#fff":(isDark?"#f0f0f2":"#111");
  const HomeIcon=({c})=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
      <polyline points="1.5,11 12,2 22.5,11"/>
      <polyline points="4,11 12,4.8 20,11"/>
      <line x1="1.5" y1="11" x2="1.5" y2="21"/>
      <line x1="22.5" y1="11" x2="22.5" y2="21"/>
      <line x1="1" y1="21" x2="23" y2="21"/>
      <rect x="9.8" y="14.5" width="4.4" height="6.6" fill={c} stroke="none"/>
    </svg>
  );
  const PlanIcon=({c})=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* Outer circle */}
      <circle cx="12" cy="12" r="9.5" stroke={c} strokeWidth="2"/>
      {/* Cardinal ticks */}
      <line x1="12" y1="2.5" x2="12" y2="4.8" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      <line x1="12" y1="21.5" x2="12" y2="19.2" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      <line x1="2.5" y1="12" x2="4.8" y2="12" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      <line x1="21.5" y1="12" x2="19.2" y2="12" stroke={c} strokeWidth="2" strokeLinecap="square"/>
      {/* Diagonal ticks */}
      <line x1="18.7" y1="5.3" x2="17.4" y2="6.6" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      <line x1="5.3" y1="5.3" x2="6.6" y2="6.6" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      <line x1="18.7" y1="18.7" x2="17.4" y2="17.4" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      <line x1="5.3" y1="18.7" x2="6.6" y2="17.4" stroke={c} strokeWidth="1.5" strokeLinecap="square"/>
      {/* N S W E */}
      <text x="12" y="8.6" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">N</text>
      <text x="12" y="18.6" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">S</text>
      <text x="5.8" y="13.1" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">W</text>
      <text x="18.2" y="13.1" textAnchor="middle" fontSize="3.2" fontWeight="700" fill={c} fontFamily="system-ui,sans-serif">E</text>
      {/* Needle (filled diamond pointing NE) */}
      <path d="M17,7 L12.7,11.8 L8.5,16.5 L11.3,12.2 Z" fill={c}/>
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.2" fill={c}/>
    </svg>
  );
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:"var(--tm-nav-bg,rgba(255,255,255,.97))",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",borderTop:"1px solid var(--tm-border)",padding:"8px 16px calc(8px + env(safe-area-inset-bottom))"}}>
      <div style={{maxWidth:600,margin:"0 auto",display:"flex",gap:6}}>
        {/* Home */}
        <button onClick={()=>setTab("home")}
          style={{flex:1,padding:"10px 8px 8px",borderRadius:14,border:"none",fontFamily:"inherit",cursor:"pointer",
            background:active==="home"?"#111":"transparent",
            color:active==="home"?"#fff":"var(--tm-text)",
            transition:"all .18s",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <HomeIcon c={iconColor("home")}/>
          <span style={{fontSize:".68rem",fontWeight:active==="home"?700:500,letterSpacing:".01em"}}>Home</span>
          {tripsCount>0&&<span style={{position:"absolute",top:7,right:"calc(50% - 20px)",minWidth:17,height:17,borderRadius:999,background:"#dc2626",color:"#fff",fontSize:".58rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{tripsCount}</span>}
        </button>
        {/* Plan */}
        <button onClick={()=>setTab("plan")}
          style={{flex:1,padding:"10px 8px 8px",borderRadius:14,border:"none",fontFamily:"inherit",cursor:"pointer",
            background:active==="plan"?"#111":"transparent",
            color:active==="plan"?"#fff":"var(--tm-text)",
            transition:"all .18s",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <PlanIcon c={iconColor("plan")}/>
        </button>
        {/* Profile */}
        <button onClick={()=>setTab("settings")}
          style={{flex:1,padding:"10px 8px 8px",borderRadius:14,border:"none",fontFamily:"inherit",cursor:"pointer",
            background:active==="settings"?"#111":"transparent",
            color:active==="settings"?"#fff":"var(--tm-text)",
            transition:"all .18s",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          {(()=>{
            const gc=(cx,cy,n,rt,rr,tf=0.44)=>{const s=(2*Math.PI)/n;const gap=s*(1-tf)/2;const tw=s*tf;let d='';for(let i=0;i<n;i++){const a=i*s-Math.PI/2;const f=(r,ang)=>`${(cx+r*Math.cos(ang)).toFixed(2)},${(cy+r*Math.sin(ang)).toFixed(2)}`;const pts=[f(rr,a+gap),f(rt,a+gap),f(rt,a+gap+tw),f(rr,a+gap+tw)];d+=(i===0?'M':'L')+pts[0]+' L'+pts[1]+' L'+pts[2]+' L'+pts[3]+' ';}return d+'Z';};
            const co=iconColor("settings");
            return(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d={gc(12,12,12,10.6,8.4,0.44)} stroke={co} strokeWidth="1.3" strokeLinejoin="miter" fill="none"/>
                <circle cx="12" cy="12" r="7.6" stroke={co} strokeWidth="1.3" fill="none"/>
                <path d={gc(12,12,8,5.8,4.4,0.42)} stroke={co} strokeWidth="1.1" strokeLinejoin="miter" fill="none"/>
                <circle cx="12" cy="12" r="2.8" stroke={co} strokeWidth="1.1" fill="none"/>
                <circle cx="12" cy="12" r="1.5" stroke={co} strokeWidth="1" fill="none"/>
              </svg>
            );
          })()}
          <span style={{fontSize:".68rem",fontWeight:active==="settings"?700:500,letterSpacing:".01em"}}>{T("settings")}</span>
        </button>
      </div>
    </div>
  );
}
