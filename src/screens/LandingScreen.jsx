// TripMind landing screen
import { useState, useEffect } from 'react';
import { CSS } from '../constants/css.js';
import { DestPhotoBg } from '../hooks/useDestImg.js';

export function LandingScreen({onEnter}){
  const [leaving,setLeaving]=useState(false);
  const [step,setStep]=useState("home");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [pass2,setPass2]=useState("");
  const [userName,setUserName]=useState("");
  const [code,setCode]=useState("");
  const [signupToken,setSignupToken]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [devCode,setDevCode]=useState("");

  const BG="url(https://images.unsplash.com/photo-1551632811-561732d1e306?w=1800&q=85)";

  function enter(){ setLeaving(true); setTimeout(onEnter,700); }
  function goStep(s){ setErr(""); setStep(s); }

  async function doLogin(e){
    e.preventDefault(); setErr(""); setLoading(true);
    try{
      const users=JSON.parse(localStorage.getItem("tm_users")||"[]");
      const user=users.find(u=>u.email===email.trim().toLowerCase());
      if(!user){ setErr("No account found for this email."); setLoading(false); return; }
      const ok=await verifyPw(pass,user.passwordHash);
      if(!ok){ setErr("Wrong password. Please try again."); setLoading(false); return; }
      localStorage.setItem("tm_session",JSON.stringify({email:user.email,name:user.name}));
      try{ const p=JSON.parse(localStorage.getItem("tm_profile")||"{}"); if(!p.name) localStorage.setItem("tm_profile",JSON.stringify({...p,name:user.name})); }catch(_){}
      enter();
    }catch(_){ setErr("Something went wrong. Try again."); }
    setLoading(false);
  }

  async function doSignupEmail(e){
    e.preventDefault();
    if(!email.includes("@")){ setErr("Please enter a valid email."); return; }
    setErr(""); setLoading(true);
    try{
      const r=await fetch("/api/auth/signup-start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim().toLowerCase()})});
      const d=await r.json();
      if(!r.ok){ setErr(d.error||"Could not send email."); setLoading(false); return; }
      setSignupToken(d.token);
      if(d._devCode) setDevCode(d._devCode);
      goStep("signup-code");
    }catch(_){ setErr("Network error. Check your connection."); }
    setLoading(false);
  }

  async function doVerifyCode(e){
    e.preventDefault();
    if(code.length!==6){ setErr("Enter the 6-digit code from your email."); return; }
    setErr(""); setLoading(true);
    try{
      const r=await fetch("/api/auth/signup-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:signupToken,code:code.trim()})});
      const d=await r.json();
      if(!r.ok||!d.valid){ setErr(d.error||"Wrong code. Please check your email."); setLoading(false); return; }
      goStep("signup-pass");
    }catch(_){ setErr("Network error. Try again."); }
    setLoading(false);
  }

  async function doCreateAccount(e){
    e.preventDefault();
    if(!userName.trim()){ setErr("Please enter your name."); return; }
    if(pass.length<8){ setErr("Password must be at least 8 characters."); return; }
    if(pass!==pass2){ setErr("Passwords don't match."); return; }
    setErr(""); setLoading(true);
    try{
      const passwordHash=await hashPw(pass);
      const users=JSON.parse(localStorage.getItem("tm_users")||"[]");
      const em=email.trim().toLowerCase();
      const newUser={email:em,name:userName.trim(),passwordHash,createdAt:Date.now()};
      localStorage.setItem("tm_users",JSON.stringify([...users.filter(u=>u.email!==em),newUser]));
      localStorage.setItem("tm_session",JSON.stringify({email:em,name:userName.trim()}));
      try{ const p=JSON.parse(localStorage.getItem("tm_profile")||"{}"); localStorage.setItem("tm_profile",JSON.stringify({...p,name:userName.trim()})); }catch(_){}
      enter();
    }catch(_){ setErr("Could not create account. Try again."); }
    setLoading(false);
  }

  const INP={width:"100%",padding:"13px 15px",borderRadius:12,background:"rgba(255,255,255,.14)",border:"1.5px solid rgba(255,255,255,.25)",color:"#fff",fontSize:".95rem",fontFamily:"inherit",outline:"none",marginBottom:10};
  const BTN_PRI={width:"100%",padding:"15px",borderRadius:14,marginTop:4,background:"var(--tm-bg)",border:"none",color:"#1a2a1a",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,.25)",opacity:loading?.6:1};
  const BACK={background:"none",border:"none",color:"rgba(255,255,255,.5)",fontSize:".8rem",fontFamily:"inherit",cursor:"pointer",marginTop:12,display:"block",width:"100%",textAlign:"center",padding:"6px 0"};
  const LABEL={fontSize:".72rem",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:"rgba(255,255,255,.5)",marginBottom:6,display:"block"};

  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,overflow:"hidden",background:"#0d1a0d",transition:"opacity .7s cubic-bezier(.4,0,.2,1)",opacity:leaving?0:1,pointerEvents:leaving?"none":"auto"}}>
      <style>{CSS}</style>
      <div style={{position:"absolute",inset:0,backgroundImage:BG,backgroundSize:"cover",backgroundPosition:"center 30%"}}/>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.15) 0%,rgba(0,0,0,.1) 35%,rgba(0,0,0,.65) 65%,rgba(0,0,0,.88) 100%)"}}/>

      {/* Logo */}
      <div className="landing-logo" style={{position:"absolute",top:0,left:0,right:0,zIndex:2,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 32px 0"}}>
        <div style={{fontWeight:900,fontSize:"1.05rem",letterSpacing:".22em",color:"#fff",textTransform:"uppercase",textShadow:"0 2px 12px rgba(0,0,0,.5)"}}>TripMind</div>
      </div>

      {/* Slogan */}
      <div style={{position:"absolute",inset:0,zIndex:2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px",paddingBottom:step==="home"?"210px":"320px",transition:"padding-bottom .45s cubic-bezier(.4,0,.2,1)"}}>
        {step==="home"&&(
          <div className="landing-title" style={{fontSize:"clamp(2.4rem,10vw,4rem)",fontWeight:900,color:"#fff",lineHeight:1.08,letterSpacing:"-.035em",textAlign:"center",textShadow:"0 4px 32px rgba(0,0,0,.45),0 1px 4px rgba(0,0,0,.6)"}}>
            Travel smarter.<br/>Live deeper.
          </div>
        )}
      </div>

      {/* Auth card */}
      <div className="landing-cta" style={{position:"absolute",bottom:0,left:0,right:0,zIndex:2,padding:"0 18px 34px"}}>
        <div style={{background:"rgba(14,20,14,.75)",backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",border:"1px solid rgba(255,255,255,.16)",borderRadius:24,padding:"24px 20px 20px",maxWidth:460,margin:"0 auto"}}>

          {step==="home"&&(
            <>
              <div style={{fontSize:".74rem",fontWeight:600,color:"rgba(255,255,255,.5)",textAlign:"center",letterSpacing:".07em",textTransform:"uppercase",marginBottom:16}}>Your next adventure awaits</div>
              <div style={{display:"flex",gap:10,marginBottom:12}}>
                <button onClick={()=>goStep("login")} style={{flex:1,padding:"15px 10px",borderRadius:14,background:"rgba(255,255,255,.15)",border:"1.5px solid rgba(255,255,255,.26)",color:"#fff",fontWeight:700,fontSize:".95rem",fontFamily:"inherit",cursor:"pointer"}}>Log in</button>
                <button onClick={()=>goStep("signup-email")} style={{flex:1,padding:"15px 10px",borderRadius:14,background:"var(--tm-bg)",border:"none",color:"#1a2a1a",fontWeight:800,fontSize:".95rem",fontFamily:"inherit",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>Sign up — free</button>
              </div>
              <div style={{textAlign:"center",fontSize:".68rem",color:"rgba(255,255,255,.28)",letterSpacing:".02em"}}>No credit card required</div>
            </>
          )}

          {step==="login"&&(
            <form onSubmit={doLogin}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:18,textAlign:"center"}}>Welcome back</div>
              <label style={LABEL}>Email</label>
              <input style={INP} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email"/>
              <label style={LABEL}>Password</label>
              <input style={INP} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required autoComplete="current-password"/>
              {err&&<div style={{color:"#fca5a5",fontSize:".8rem",marginBottom:8,textAlign:"center"}}>{err}</div>}
              <button type="submit" style={BTN_PRI} disabled={loading}>{loading?"Signing in…":"Log in"}</button>
              <button type="button" style={BACK} onClick={()=>goStep("home")}>← Back</button>
            </form>
          )}

          {step==="signup-email"&&(
            <form onSubmit={doSignupEmail}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:6,textAlign:"center"}}>Create your account</div>
              <div style={{fontSize:".8rem",color:"rgba(255,255,255,.45)",textAlign:"center",marginBottom:18}}>We'll send a verification code to your email</div>
              <label style={LABEL}>Email address</label>
              <input style={INP} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email"/>
              {err&&<div style={{color:"#fca5a5",fontSize:".8rem",marginBottom:8,textAlign:"center"}}>{err}</div>}
              <button type="submit" style={BTN_PRI} disabled={loading}>{loading?"Sending code…":"Send verification code"}</button>
              <button type="button" style={BACK} onClick={()=>goStep("home")}>← Back</button>
            </form>
          )}

          {step==="signup-code"&&(
            <form onSubmit={doVerifyCode}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:6,textAlign:"center"}}>Check your email</div>
              <div style={{fontSize:".8rem",color:"rgba(255,255,255,.45)",textAlign:"center",marginBottom:16}}>We sent a 6-digit code to<br/><span style={{color:"rgba(255,255,255,.8)",fontWeight:700}}>{email}</span></div>
              {devCode&&<div style={{background:"rgba(255,255,170,.1)",border:"1px solid rgba(255,255,100,.28)",borderRadius:10,padding:"10px 14px",marginBottom:12,textAlign:"center",fontSize:".8rem",color:"rgba(255,255,180,.85)"}}>🧑‍💻 Dev mode — no email sent.<br/>Code: <strong style={{letterSpacing:4}}>{devCode}</strong></div>}
              <label style={LABEL}>Verification code</label>
              <input style={{...INP,textAlign:"center",fontSize:"1.6rem",fontWeight:900,letterSpacing:"10px",padding:"14px"}} type="text" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="——————" autoComplete="one-time-code"/>
              {err&&<div style={{color:"#fca5a5",fontSize:".8rem",marginBottom:8,textAlign:"center"}}>{err}</div>}
              <button type="submit" style={{...BTN_PRI,opacity:(loading||code.length!==6)?.5:1}} disabled={loading||code.length!==6}>{loading?"Verifying…":"Verify code"}</button>
              <button type="button" style={BACK} onClick={()=>{setCode("");setDevCode("");goStep("signup-email");}}>← Resend code</button>
            </form>
          )}

          {step==="signup-pass"&&(
            <form onSubmit={doCreateAccount}>
              <div style={{fontWeight:800,fontSize:"1.05rem",color:"#fff",marginBottom:6,textAlign:"center"}}>Almost there!</div>
              <div style={{fontSize:".8rem",color:"rgba(255,255,255,.45)",textAlign:"center",marginBottom:18}}>Set your name and a password</div>
              <label style={LABEL}>Your name</label>
              <input style={INP} type="text" value={userName} onChange={e=>setUserName(e.target.value)} placeholder="First name" required autoComplete="name"/>
              <label style={LABEL}>Password</label>
              <input style={INP} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Min. 8 characters" required autoComplete="new-password"/>
              <label style={LABEL}>Confirm password</label>
              <input style={INP} type="password" value={pass2} onChange={e=>setPass2(e.target.value)} placeholder="Repeat password" required autoComplete="new-password"/>
              {err&&<div style={{color:"#fca5a5",fontSize:".8rem",marginBottom:8,textAlign:"center"}}>{err}</div>}
              <button type="submit" style={BTN_PRI} disabled={loading}>{loading?"Creating account…":"Create account"}</button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
