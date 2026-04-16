// TripMind API key setup screen
import { useState } from 'react';
import { CSS } from '../constants/css.js';
import { Btn } from '../components/Primitives.jsx';

export function SetupKeyScreen({onDone}){
  const [key,setKey]=useState("");
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  async function save(){
    if(!key.trim().startsWith("sk-ant-")){setErr("Key must start with sk-ant-…");return;}
    setSaving(true); setErr("");
    try{
      const r=await fetch("/api/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key.trim()})});
      const d=await r.json();
      if(d.ok) onDone();
      else setErr(d.error||"Could not save key");
    }catch(e){setErr(e.message);}
    finally{setSaving(false);}
  }
  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif'}}>
      <style>{CSS}</style>
      <div style={{background:"var(--tm-bg)",borderRadius:20,padding:"36px 32px",maxWidth:420,width:"100%",boxShadow:"0 8px 40px rgba(47,65,86,.12)"}}>
        <div style={{fontSize:"2.4rem",marginBottom:12,textAlign:"center"}}>✈️</div>
        <h2 style={{fontSize:"1.4rem",fontWeight:900,color:"var(--tm-text)",marginBottom:6,textAlign:"center"}}>Welcome to TripMind</h2>
        <p style={{fontSize:".84rem",color:"var(--tm-text2)",textAlign:"center",lineHeight:1.6,marginBottom:24}}>
          One-time setup: enter your Claude API key to activate trip generation.<br/>
          It stays on your computer — no account needed.
        </p>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:".72rem",fontWeight:700,color:"var(--tm-text)",marginBottom:5}}>🔑 Claude API Key</div>
          <input
            type="password"
            value={key}
            onChange={e=>{setKey(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&save()}
            placeholder="sk-ant-…"
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${err?"#fca5a5":key?"#111":"var(--tm-border)"}`,fontSize:".9rem",fontFamily:"inherit",background:"var(--tm-surface2)",outline:"none"}}
            autoFocus
          />
          {err&&<div style={{fontSize:".73rem",color:"#dc2626",marginTop:5}}>⚠ {err}</div>}
          <div style={{fontSize:".68rem",color:"var(--tm-text3)",marginTop:6}}>
            Get a free key at <b>console.anthropic.com</b> → API Keys → Create Key.<br/>Stored locally in <code>api_key.txt</code> — never sent to third parties.
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving||!key.trim()}
          style={{marginTop:16,width:"100%",padding:"13px",borderRadius:11,border:"none",background:key.trim()&&!saving?"#111":"var(--tm-border)",color:"#fff",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:key.trim()&&!saving?"pointer":"default",transition:"background .15s"}}>
          {saving?"Saving…":"Save & Start →"}
        </button>
      </div>
    </div>
  );
}
