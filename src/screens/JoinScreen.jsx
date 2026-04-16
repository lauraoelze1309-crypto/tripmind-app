// TripMind join screen
import { useState } from 'react';
import { CSS } from '../constants/css.js';
import { DestPhotoBg } from '../hooks/useDestImg.js';

export function JoinScreen({tripData,onJoin}){
  const [name,setName]=useState("");
  const dest=tripData?.destination||"this trip";
  const memberCount=(tripData?.members||[]).length;
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2C365A,#111)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif'}}>
      <style>{CSS}</style>
      <div style={{background:"var(--tm-bg)",borderRadius:24,padding:"40px 32px",maxWidth:440,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:"3rem",marginBottom:12}}>✈️</div>
          <h2 style={{fontSize:"1.5rem",fontWeight:900,color:"var(--tm-text)",margin:"0 0 8px"}}>Du wurdest eingeladen!</h2>
          <p style={{color:"var(--tm-text2)",fontSize:".9rem",lineHeight:1.6,margin:0}}>
            Reise nach <b style={{color:"var(--tm-text)"}}>{dest}</b>
            {memberCount>0&&<span> · {memberCount} {memberCount===1?"Reisender":"Reisende"} dabei</span>}
          </p>
        </div>
        {/* Avatar preview of existing members */}
        {(tripData?.members||[]).length>0&&(
          <div style={{display:"flex",justifyContent:"center",gap:-4,marginBottom:24}}>
            {(tripData.members||[]).slice(0,5).map((m,i)=>(
              <div key={i} title={m.name} style={{width:36,height:36,borderRadius:"50%",background:"#111",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".8rem",fontWeight:800,border:"2.5px solid #fff",marginLeft:i>0?-10:0,zIndex:10-i,boxShadow:"0 2px 6px rgba(0,0,0,.15)"}}>
                {(m.avatar||m.name||"?")[0].toUpperCase()}
              </div>
            ))}
          </div>
        )}
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:".78rem",fontWeight:700,color:"var(--tm-text)",marginBottom:8}}>Dein Name (wird der Gruppe angezeigt)</label>
          <input
            autoFocus
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onJoin(name.trim())}
            placeholder="z.B. Anna"
            style={{width:"100%",padding:"14px 16px",borderRadius:12,border:"2px solid #E8E8E8",fontSize:"1rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <button
          disabled={!name.trim()}
          onClick={()=>name.trim()&&onJoin(name.trim())}
          style={{width:"100%",padding:"15px",borderRadius:12,border:"none",background:name.trim()?"#111":"var(--tm-border)",color:"#fff",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:name.trim()?"pointer":"default",transition:"background .15s"}}>
          Dem Trip beitreten →
        </button>
        <p style={{textAlign:"center",fontSize:".68rem",color:"var(--tm-text3)",marginTop:14,margin:"14px 0 0"}}>Kein Account nötig · Name wird nur innerhalb der Gruppe gesehen</p>
      </div>
    </div>
  );
}
