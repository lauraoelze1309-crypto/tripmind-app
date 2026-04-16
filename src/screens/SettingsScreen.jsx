// TripMind settings screen
import { useState } from 'react';
import { LANGUAGES, getLang, t } from '../constants/i18n.js';
import { CSS } from '../constants/css.js';

export function SettingsScreen(){
  const [profile,setProfile]=useState(()=>getUserProfile());
  const [editingName,setEditingName]=useState(false);
  const [nameDraft,setNameDraft]=useState(profile.name||"");
  const [lang,setLangState]=useState(getLang);
  const [notif,setNotif]=useState(()=>{try{return localStorage.getItem("tm_notif")==="1";}catch(_){return false;}});
  const [showLangPicker,setShowLangPicker]=useState(false);
  const [langSearch,setLangSearch]=useState("");
  // Dark mode state — reads from document (set by useDarkMode in App)
  const [darkMode,setDarkMode]=useState(()=>document.documentElement.getAttribute("data-theme")==="dark");
  function toggleDark(){
    const next=!darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme",next?"dark":"light");
    try{localStorage.setItem("tm_theme",next?"dark":"light");}catch(_){}
  }
  const photoRef=useRef(null);

  function compressImage(file,maxPx=320){
    return new Promise(resolve=>{
      const img=new Image();
      const url=URL.createObjectURL(file);
      img.onload=()=>{
        URL.revokeObjectURL(url);
        const scale=Math.min(1,maxPx/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*scale);
        c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',0.82));
      };
      img.onerror=()=>{ URL.revokeObjectURL(url); resolve(null); };
      img.src=url;
    });
  }
  async function onPhotoSelected(e){
    const file=e.target.files?.[0];
    if(!file) return;
    e.target.value='';
    const dataUrl=await compressImage(file);
    if(dataUrl) saveProfile({photo:dataUrl});
  }
  function doRemovePhoto(){ saveProfile({photo:null}); }

  const T=(k)=>t(lang,k);

  function saveProfile(updates){
    const next={...profile,...updates};
    setProfile(next);
    try{localStorage.setItem("tm_user",JSON.stringify(next));}catch(_){}
  }
  function saveLang(code){
    setLangState(code);
    try{localStorage.setItem("tm_lang",code);}catch(_){}
    setShowLangPicker(false);
    setLangSearch("");
  }
  async function toggleNotif(){
    if(notif){
      setNotif(false);
      try{localStorage.setItem("tm_notif","0");}catch(_){}
      if("serviceWorker" in navigator){
        navigator.serviceWorker.ready.then(r=>r.active?.postMessage({type:"TM_CLEAR"})).catch(()=>{});
      }
    } else {
      if(!("Notification" in window)){alert(T("notifUnsupported"));return;}
      if("serviceWorker" in navigator){ try{await navigator.serviceWorker.register("/sw.js");}catch(_){} }
      const perm=await Notification.requestPermission();
      const on=perm==="granted";
      setNotif(on);
      try{localStorage.setItem("tm_notif",on?"1":"0");}catch(_){}
    }
  }

  const displayName=profile.name||T("defaultName");
  const currentLang=LANGUAGES[lang]||LANGUAGES.en;
  const filteredLangs=Object.entries(LANGUAGES).filter(([,l])=>l.name.toLowerCase().includes(langSearch.toLowerCase()));

  const sCard={background:"var(--tm-bg)",borderRadius:16,border:"1px solid #EBEBEB",overflow:"hidden",marginBottom:12};
  const sSecLabel={padding:"14px 16px 8px",fontSize:".6rem",fontWeight:800,color:"var(--tm-text)",textTransform:"uppercase",letterSpacing:".13em",borderBottom:"1px solid #F2F2F2"};
  const Row=({title,sub,right,onClick,danger})=>(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:13,padding:"14px 16px",borderBottom:"1px solid #F2F2F2",cursor:onClick?"pointer":"default",background:"var(--tm-bg)"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:".9rem",fontWeight:600,color:danger?"#dc2626":"#111"}}>{title}</div>
        {sub&&<div style={{fontSize:".76rem",color:"var(--tm-text)",marginTop:2}}>{sub}</div>}
      </div>
      {right&&<div style={{flexShrink:0}}>{right}</div>}
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"var(--tm-surface)",fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif',paddingBottom:100}}>
      <style>{CSS}</style>
      <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={onPhotoSelected}/>

      {/* ── HEADER ── */}
      <div style={{background:"var(--tm-bg)",borderBottom:"1px solid #EBEBEB",padding:"52px 20px 18px"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <div style={{fontSize:".6rem",fontWeight:800,letterSpacing:".14em",textTransform:"uppercase",color:"var(--tm-text)",marginBottom:3}}>TripMind</div>
          <div style={{fontSize:"1.25rem",fontWeight:900,color:"var(--tm-text)",letterSpacing:"-.03em"}}>{T("settings")}</div>
        </div>
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"18px 16px"}}>

        {/* Profile avatar + name */}
        <div style={{...sCard,padding:"20px 16px",display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
          <button onClick={()=>photoRef.current?.click()}
            style={{width:64,height:64,borderRadius:"50%",background:"var(--tm-surface2)",border:"1.5px solid #E0E0E0",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"var(--tm-text)",fontWeight:900,fontSize:"1.4rem",cursor:"pointer",overflow:"hidden",padding:0,flexShrink:0}}>
            {profile.photo
              ?<img src={profile.photo} alt={T("profile")} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<span style={{fontSize:".9rem",fontWeight:800,color:"var(--tm-text)"}}>{getInitials(profile.name)||"T"}</span>
            }
          </button>
          <div style={{flex:1,minWidth:0}}>
            {editingName?(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input autoFocus value={nameDraft} onChange={e=>setNameDraft(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"){saveProfile({name:nameDraft.trim()||T("defaultName")});setEditingName(false);}if(e.key==="Escape")setEditingName(false);}}
                  style={{flex:1,padding:"7px 10px",borderRadius:9,border:"1.5px solid #E0E0E0",fontSize:".95rem",fontWeight:700,fontFamily:"inherit",color:"var(--tm-text)",background:"var(--tm-bg)",outline:"none"}}/>
                <button onClick={()=>{saveProfile({name:nameDraft.trim()||T("defaultName")});setEditingName(false);}}
                  style={{padding:"7px 12px",borderRadius:9,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".8rem",cursor:"pointer"}}>{T("save")}</button>
              </div>
            ):(
              <div>
                <div style={{fontSize:"1.05rem",fontWeight:800,color:"var(--tm-text)",letterSpacing:"-.02em"}}>{displayName}</div>
                <button onClick={()=>{setNameDraft(profile.name||"");setEditingName(true);}}
                  style={{background:"none",border:"none",padding:0,fontSize:".76rem",color:"var(--tm-text)",cursor:"pointer",fontFamily:"inherit",fontWeight:600,textDecoration:"underline",textUnderlineOffset:2}}>{T("editName")}</button>
              </div>
            )}
          </div>
          <button onClick={()=>photoRef.current?.click()}
            style={{padding:"7px 14px",borderRadius:10,border:"1.5px solid #E0E0E0",background:"var(--tm-bg)",color:"var(--tm-text)",fontSize:".76rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
            {profile.photo?T("changePhoto"):T("addPhoto")}
          </button>
        </div>

        {/* Notifications */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("notifications")}</div>
          <Row title={T("notifTitle")} sub={T("notifSub")}
            right={
              <div onClick={toggleNotif} style={{width:46,height:26,borderRadius:99,background:notif?"#111":"var(--tm-border2)",position:"relative",cursor:"pointer",transition:"background .2s"}}>
                <div style={{position:"absolute",top:3,left:notif?22:3,width:20,height:20,borderRadius:"50%",background:"var(--tm-bg)",boxShadow:"0 1px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
              </div>
            }/>
        </div>

        {/* Appearance */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("appearance")}</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 16px"}}>
            <div>
              <div style={{fontWeight:700,fontSize:".88rem",color:"var(--tm-text)"}}>
                {darkMode?T("darkMode"):T("lightMode")}
              </div>
              <div style={{fontSize:".74rem",color:"var(--tm-text3)",marginTop:2}}>
                {darkMode?T("darkActive"):T("lightActive")}
              </div>
            </div>
            {/* Toggle switch */}
            <button onClick={toggleDark} aria-label={T("toggleDark")}
              style={{
                width:48,height:28,borderRadius:999,border:"none",cursor:"pointer",padding:3,
                background:darkMode?"#111":"var(--tm-border)",
                transition:"background .2s",position:"relative",flexShrink:0,
              }}>
              <div style={{
                width:22,height:22,borderRadius:"50%",background:"#fff",
                position:"absolute",top:3,
                left:darkMode?23:3,
                transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,.25)",
              }}/>
            </button>
          </div>
        </div>

        {/* Language */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("language")}</div>
          <Row title={currentLang.name} sub={T("langSub")}
            onClick={()=>setShowLangPicker(true)}
            right={<span style={{color:"var(--tm-text)",fontSize:"1.1rem",fontWeight:300}}>›</span>}/>
        </div>

        {/* Profile photo */}
        {profile.photo&&(
          <div style={sCard}>
            <div style={sSecLabel}>{T("profilePhoto")}</div>
            <Row title={T("removePhoto")} sub={T("removePhotoSub")} danger
              onClick={doRemovePhoto}/>
          </div>
        )}

        {/* App info */}
        <div style={sCard}>
          <div style={sSecLabel}>{T("app")}</div>
          <Row title="TripMind AI" sub={T("appSub")}/>
          <Row title={T("privacy")} sub={T("privacySub")}/>
        </div>

      </div>

      {/* Language picker sheet */}
      {showLangPicker&&(
        <div onClick={()=>setShowLangPicker(false)} style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"var(--tm-bg)",borderRadius:"20px 20px 0 0",padding:"20px 0 32px",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{width:36,height:4,borderRadius:99,background:"var(--tm-border2)",margin:"0 auto 16px"}}/>
            <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)",padding:"0 20px 12px"}}>{T("selectLanguage")}</div>
            <div style={{padding:"0 16px 10px"}}>
              <input autoFocus value={langSearch} onChange={e=>setLangSearch(e.target.value)} placeholder={T("searchLang")}
                style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid #E0E0E0",fontFamily:"inherit",fontSize:".88rem",background:"var(--tm-bg)",color:"var(--tm-text)",boxSizing:"border-box",outline:"none"}}/>
            </div>
            <div style={{overflowY:"auto",flex:1}}>
              {filteredLangs.map(([code,l])=>(
                <button key={code} onClick={()=>saveLang(code)}
                  style={{width:"100%",padding:"13px 20px",background:lang===code?"#F2F2F2":"transparent",border:"none",borderBottom:"1px solid #F2F2F2",textAlign:"left",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:".9rem",fontWeight:lang===code?800:500,color:"var(--tm-text)",flex:1}}>{l.name}</span>
                  {lang===code&&<span style={{color:"var(--tm-text)",fontWeight:800,fontSize:".85rem"}}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
