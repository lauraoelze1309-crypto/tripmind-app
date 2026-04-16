// TripMind notification setup card
import { useState } from 'react';

export function NotifSetupCard(){
  const [status,setStatus]=useState(()=>{
    try{ return localStorage.getItem("tm_notif")==="1"?"granted":Notification?.permission||"default"; }catch(_){ return "default"; }
  });
  const [loading,setLoading]=useState(false);

  async function request(){
    if(!("Notification" in window)){ alert("Dein Browser unterstützt keine Benachrichtigungen."); return; }
    setLoading(true);
    // Register SW first so it's ready
    if("serviceWorker" in navigator){
      try{ await navigator.serviceWorker.register("/sw.js"); }catch(_){}
    }
    const perm=await Notification.requestPermission();
    setLoading(false);
    setStatus(perm);
    try{ localStorage.setItem("tm_notif",perm==="granted"?"1":"0"); }catch(_){}
  }

  if(status==="granted") return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:12,marginBottom:12}}>
      <span style={{fontSize:"1.2rem"}}>🔔</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:".86rem",color:"#166534"}}>Benachrichtigungen aktiv</div>
        <div style={{fontSize:".74rem",color:"#4ade80",marginTop:1}}>Du wirst 15 Min vor jeder Aktivität erinnert</div>
      </div>
      <span style={{fontSize:".8rem",fontWeight:800,color:"#16a34a"}}>✓</span>
    </div>
  );

  if(status==="denied") return(
    <div style={{padding:"12px 14px",background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:12,marginBottom:12,fontSize:".8rem",color:"#dc2626"}}>
      🔕 Benachrichtigungen blockiert — bitte in den Browser-Einstellungen erlauben.
    </div>
  );

  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"var(--tm-bg)",border:"1.5px solid #E8E8E8",borderRadius:12,marginBottom:12}}>
      <span style={{fontSize:"1.2rem"}}>🔔</span>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:".86rem",color:"var(--tm-text)"}}>Aktivitäts-Erinnerungen</div>
        <div style={{fontSize:".74rem",color:"var(--tm-text3)",marginTop:1}}>15 Min Vorwarnung — auch wenn die App im Hintergrund läuft</div>
      </div>
      <button onClick={request} disabled={loading} style={{flexShrink:0,padding:"7px 13px",borderRadius:9,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".78rem",cursor:"pointer",opacity:loading?.6:1}}>
        {loading?"…":"Erlauben"}
      </button>
    </div>
  );
}
