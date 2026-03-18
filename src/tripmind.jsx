import { useState, useEffect, useRef } from "react";

const API = "/api/messages";
const MODEL = "claude-sonnet-4-5-20251029";
const INTERESTS = ["Food & Dining","Culture","History","Nightlife","Nature","Art","Shopping","Hidden Spots","Architecture","Sports","Wellness","Photography"];
const AGE_GROUPS = ["18-25","26-40","41-60","60+","Mixed / Family"];
const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
const LEAFLET_JS  = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
const GOOGLE_PLACES_KEY = "PASTE_YOUR_KEY_HERE";
// Picsum gives real photos by seed - deterministic so no flicker on re-render
function picsum(seed, w, h){ return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w||600}/${h||400}`; }
function heroImg(dest){ return picsum(dest.toLowerCase().replace(/\s+/g,"-"),1200,500); }
function actImg(q){ return picsum((q||"travel").toLowerCase().replace(/\s+/g,"-").slice(0,40),600,400); }

function typeEmoji(t){
  if(!t) return "📍"; const s=t.toLowerCase();
  if(s.includes("museum")||s.includes("gallery")) return "🏛️";
  if(s.includes("nightclub")||s.includes("club")) return "🎉";
  if(s.includes("bar")||s.includes("pub")||s.includes("cocktail")) return "🍸";
  if(s.includes("park")||s.includes("garden")||s.includes("nature")) return "🌳";
  if(s.includes("beach")) return "🏖️";
  if(s.includes("restaurant")||s.includes("dining")) return "🍽️";
  if(s.includes("cafe")||s.includes("bistro")) return "☕";
  if(s.includes("castle")||s.includes("palace")) return "🏰";
  if(s.includes("church")||s.includes("cathedral")) return "⛪";
  if(s.includes("market")) return "🛍️";
  if(s.includes("viewpoint")||s.includes("view")) return "🌄";
  return "📍";
}
function getDays(s,e){ if(!s||!e) return 0; return Math.max(1,Math.round((new Date(e)-new Date(s))/86400000)+1); }
function fmtDate(d){ if(!d) return ""; return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
function uid(){ return "_"+Math.random().toString(36).slice(2,9); }
function toMins(t){ if(!t) return null; const p=(t+"").split(":").map(Number); return isNaN(p[0])?null:p[0]*60+(p[1]||0); }
function fmtTime(m){ if(m==null) return ""; return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
function parseEuro(price){
  if(!price) return 0;
  const s=String(price).replace(",",".").toLowerCase();
  if(s.includes("free")) return 0;
  const match=s.match(/(\d+(\.\d+)?)/);
  return match?Number(match[1]):0;
}
function parseDurationToMinutes(duration){
  if(!duration) return 90;
  const s=String(duration).toLowerCase();
  const h=s.match(/(\d+)\s*h/); const m=s.match(/(\d+)\s*m/);
  let mins=0;
  if(h) mins+=Number(h[1])*60;
  if(m) mins+=Number(m[1]);
  if(!mins){ if(s.includes("half day")) return 240; if(s.includes("full day")) return 480; return 90; }
  return mins;
}
function isOutdoorActivity(act){
  const t=`${act?.type||""} ${act?.name||""} ${act?.desc||""}`.toLowerCase();
  return ["park","garden","beach","viewpoint","hike","walking","nature","market","photography","architecture","boat","outdoor"].some(k=>t.includes(k));
}
function isIndoorActivity(act){
  const t=`${act?.type||""} ${act?.name||""} ${act?.desc||""}`.toLowerCase();
  return ["museum","gallery","cafe","restaurant","spa","shopping","mall","cathedral","church","cinema","theater","indoor"].some(k=>t.includes(k));
}
function isDining(act){
  const t=`${act?.type||""} ${act?.name||""}`.toLowerCase();
  return ["restaurant","dining","bistro","brasserie","cafe","bar","cocktail"].some(k=>t.includes(k));
}
function weatherLooksRainy(wf){ return ["rain","storm","shower","thunder"].some(k=>String(wf||"").toLowerCase().includes(k)); }
function weatherLooksHot(wf){ const m=String(wf||"").match(/(-?\d+)/); const t=m?Number(m[1]):null; return t!=null&&t>=28; }
function computeDayBudget(day){
  const acts=(day.activities||[]).reduce((s,a)=>s+parseEuro(a.price),0);
  return{activities:acts,lunch:parseEuro(day.lunch?.price),dinner:parseEuro(day.dinner?.price),total:acts+parseEuro(day.lunch?.price)+parseEuro(day.dinner?.price)};
}
function computeTripBudget(days){
  return days.reduce((acc,day)=>{const d=computeDayBudget(day);acc.activities+=d.activities;acc.lunch+=d.lunch;acc.dinner+=d.dinner;acc.total+=d.total;return acc;},{activities:0,lunch:0,dinner:0,total:0});
}
function museumLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["museum","gallery","cathedral","church","palace","castle"].some(k=>t.includes(k)); }
function viewpointLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["viewpoint","rooftop","sunset","tower","lookout"].some(k=>t.includes(k)); }
function nightlifeLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["bar","club","nightlife","cocktail","pub","live music"].some(k=>t.includes(k)); }
function scoreActivity(act,context){
  let score=0;
  const outdoor=isOutdoorActivity(act),indoor=isIndoorActivity(act),dining=isDining(act);
  if(context.isRainy){ if(indoor) score+=30; if(outdoor) score-=35; }
  if(context.isHot){ if(indoor) score+=12; if(outdoor) score-=8; }
  if(context.period==="morning"){ if(dining) score-=8; if(outdoor) score+=6; }
  if(context.period==="midday"){ if(dining) score+=18; if(indoor) score+=8; }
  if(context.period==="afternoon"){ if(museumLike(act)) score+=10; if(viewpointLike(act)) score+=6; }
  if(context.period==="evening"){ if(dining) score+=20; if(nightlifeLike(act)) score+=25; if(museumLike(act)) score-=10; }
  if(act.locked) score+=1000;
  return score;
}
function getDayStart(day,form){
  if(day?.day===1&&form?.arrivalTime){const a=toMins(form.arrivalTime);if(a!=null)return Math.min(a+60,18*60);}
  return 9*60;
}
function getDayEnd(day,form,totalDays){
  if(day?.day===totalDays&&form?.departureTime){const d=toMins(form.departureTime);if(d!=null)return Math.max(d-120,10*60);}
  return 22*60;
}
function getTimeBlocks(dayStart,dayEnd){
  const blocks=[];
  const morningStart=dayStart,middayStart=Math.max(dayStart,12*60),afternoonStart=Math.max(dayStart,15*60),eveningStart=Math.max(dayStart,19*60);
  if(morningStart<Math.min(dayEnd,12*60)) blocks.push({label:"morning",start:morningStart});
  if(middayStart<Math.min(dayEnd,15*60)) blocks.push({label:"midday",start:middayStart});
  if(afternoonStart<Math.min(dayEnd,19*60)) blocks.push({label:"afternoon",start:afternoonStart});
  if(eveningStart<dayEnd) blocks.push({label:"evening",start:eveningStart});
  return blocks;
}
function normalizeActivity(act,idx){
  const durationMins=parseDurationToMinutes(act.duration);
  const explicitStart=toMins(act.time);
  return{...act,_engine:{originalIndex:idx,durationMins,explicitStart,outdoor:isOutdoorActivity(act),indoor:isIndoorActivity(act),dining:isDining(act)}};
}
function stableSortByScore(list,getScore){
  return [...list].map((item,index)=>({item,index,score:getScore(item)})).sort((a,b)=>b.score!==a.score?b.score-a.score:a.index-b.index).map(x=>x.item);
}
function assignTimes(activities,dayStart,dayEnd){
  let cursor=dayStart;
  return activities.map(act=>{
    const dur=act._engine.durationMins;
    const start=act.locked&&act._engine.explicitStart!=null?Math.max(act._engine.explicitStart,cursor):cursor;
    const end=start+dur;
    cursor=end+20;
    return{...act,time:fmtTime(start),endTime:fmtTime(end),conflict:end>dayEnd,_engine:{...act._engine,start,end}};
  });
}
function prioritizeActivities(activities,weatherForecast,dayStart,dayEnd){
  const isRainy=weatherLooksRainy(weatherForecast),isHot=weatherLooksHot(weatherForecast);
  const locked=activities.filter(a=>a.locked),flexible=activities.filter(a=>!a.locked);
  const blocks=getTimeBlocks(dayStart,dayEnd);
  if(!blocks.length) return [...locked,...flexible];
  const used=new Set(),selected=[];
  for(const block of blocks){
    const candidates=flexible.filter(a=>!used.has(a._engine.originalIndex));
    if(!candidates.length) continue;
    const best=stableSortByScore(candidates,act=>scoreActivity(act,{isRainy,isHot,period:block.label}))[0];
    if(best){used.add(best._engine.originalIndex);selected.push(best);}
  }
  const remaining=flexible.filter(a=>!used.has(a._engine.originalIndex));
  const rankedRemaining=stableSortByScore(remaining,act=>scoreActivity(act,{isRainy,isHot,period:"afternoon"}));
  return [...locked,...selected,...rankedRemaining];
}
function buildAlternativePlan(day,mode){
  const acts=[...(day.activities||[])];
  if(mode==="budget") return{...day,altMode:"budget",activities:acts.map(a=>parseEuro(a.price)<=20?a:{...a,alternativeFlag:true,desc:`${a.desc||""} Budget-friendly alternative recommended.`})};
  if(mode==="relaxed") return{...day,altMode:"relaxed",activities:acts.slice(0,Math.max(1,acts.length-1))};
  if(mode==="fast") return{...day,altMode:"fast",activities:acts.map(a=>({...a,duration:"1h"}))};
  if(mode==="rainy") return{...day,altMode:"rainy",activities:[...acts].sort((a,b)=>(isOutdoorActivity(a)?1:0)-(isOutdoorActivity(b)?1:0))};
  return day;
}
function buildTripText(data,form,days){
  const l=[];
  l.push("TripMind AI"); l.push(data.destination); l.push("");
  l.push(`Travelers: ${form.travelers||"-"}`); l.push(`Style: ${form.style||"-"}`); l.push(`Transport: ${form.transport||"-"}`); l.push("");
  for(const day of days){
    l.push(`DAY ${day.day}: ${day.theme||""}`);
    if(day.neighborhood) l.push(`Area: ${day.neighborhood}`);
    if(day.weatherForecast) l.push(`Weather: ${day.weatherForecast}`);
    l.push("");
    for(const act of day.activities||[]){
      l.push(`- ${act.time||"--:--"} ${act.name} (${act.type||"Activity"})`);
      if(act.address) l.push(`  ${act.address}`);
      if(act.price) l.push(`  Price: ${act.price}`);
    }
    if(day.lunch?.name) l.push(`Lunch: ${day.lunch.name} (${day.lunch.price||""})`);
    if(day.dinner?.name) l.push(`Dinner: ${day.dinner.name} (${day.dinner.price||""})`);
    l.push("");
  }
  return l.join("\n");
}
function downloadTextFile(filename,content){
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
function exportTripAsPrintableHTML(data,form,days){
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>TripMind - ${data.destination}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#222}h1{margin-bottom:4px}.muted{color:#666;margin-bottom:20px}.day{margin:28px 0;padding-bottom:16px;border-bottom:1px solid #ddd}.act{margin:8px 0;padding:8px 0}</style></head>
<body><h1>${data.destination}</h1>
<div class="muted">Travelers: ${form.travelers||"-"} · Style: ${form.style||"-"} · Transport: ${form.transport||"-"}</div>
${days.map(day=>`<div class="day"><h2>Day ${day.day}: ${day.theme||""}</h2><div>${day.weatherForecast||""}</div>${(day.activities||[]).map(act=>`<div class="act"><strong>${act.time||"--:--"} - ${act.name}</strong><br/>${act.type||""}<br/>${act.address||""}<br/>${act.price||""}</div>`).join("")}</div>`).join("")}
<script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open("","_blank"); win.document.write(html); win.document.close();
}
async function shareTripText(data,form,days){
  const text=buildTripText(data,form,days);
  if(navigator.share){ await navigator.share({title:`TripMind - ${data.destination}`,text}); return; }
  await navigator.clipboard.writeText(text);
  alert("Trip copied to clipboard.");
}
function weatherStyle(f){
  const m=(f||"").match(/(-?\d+)/); const t=m?parseInt(m[1]):null;
  if(t===null) return {bg:"#EEE8DF",bd:"#C8D9E6",c:"#567C8D"};
  if(t>=20)    return {bg:"#e8f4f0",bd:"#A8C3D3",c:"#2F4156"};
  if(t>=10)    return {bg:"#dceaf3",bd:"#567C8D",c:"#2F4156"};
  return {bg:"#EEE8DF",bd:"#C8D9E6",c:"#567C8D"};
}

const CSS=[
  "@keyframes spin{to{transform:rotate(360deg)}}",
  "@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}",
  "@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}",
  ".fu{animation:fadeUp .25s ease forwards}",
  "*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}",
  "body{background:#F5EFEB;-webkit-text-size-adjust:100%}",
  "input,textarea,select{font-size:16px!important}",
  "input:focus,textarea:focus,select:focus{outline:2px solid #567C8D;outline-offset:1px}",
  "a{text-decoration:none}",
  "button{cursor:pointer;touch-action:manipulation}",
  "button:active{opacity:.72}",
  ".sx{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch}",
  ".sx::-webkit-scrollbar{display:none}",
  ".leaflet-container{font-family:'Segoe UI',system-ui,sans-serif}",
].join("\n");

// ── Primitives ─────────────────────────────────────────────────────────────────
const Lbl=({c,sub})=><div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:sub?"#8A9CAA":"#567C8D",marginBottom:6}}>{c}</div>;
const TIn=({value,onChange,placeholder,type,style})=><input type={type||"text"} value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",padding:"12px 13px",background:"#EEE8DF",border:"1.5px solid #C8D9E6",borderRadius:9,color:"#2F4156",fontFamily:"inherit",...(style||{})}}/>;
const Chip=({label,on,onClick})=><button onClick={onClick} style={{padding:"9px 14px",minHeight:38,borderRadius:50,fontSize:".8rem",fontFamily:"inherit",background:on?"#2F4156":"#EEE8DF",border:"1.5px solid "+(on?"#2F4156":"#C8D9E6"),color:on?"#fff":"#2F4156",whiteSpace:"nowrap"}}>{label}</button>;
const Crd=({children,style})=><div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:18,marginBottom:13,...(style||{})}}>{children}</div>;
const Spin=({size})=><div style={{width:size||22,height:size||22,border:"2.5px solid #C8D9E6",borderTop:"2.5px solid #567C8D",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}}/>;
const Btn=({children,onClick,color,disabled,full,outline})=>{
  const bg=disabled?"#C8D9E6":outline?"#fff":(color||"#2F4156");
  const cl=disabled?"#8A9CAA":outline?(color||"#2F4156"):"#fff";
  return <button onClick={disabled?null:onClick} style={{padding:"13px 20px",minHeight:50,borderRadius:12,fontSize:".95rem",fontWeight:800,fontFamily:"inherit",border:outline?"1.5px solid "+(color||"#2F4156"):"none",background:bg,color:cl,width:full?"100%":"auto"}}>{children}</button>;
};

// ── JSON repair ────────────────────────────────────────────────────────────────
function repairJSON(raw){
  // Strip markdown fences
  let s=raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  // Find outermost { }
  const si=s.indexOf("{");
  if(si===-1) throw new Error("No JSON object in response");
  s=s.slice(si);
  // Build cleaned string char-by-char
  let r="",inStr=false,esc=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(esc){
      // pass through valid escapes; drop invalid ones
      const valid='"\\\/bfnrtu'.includes(c);
      r+=valid?"\\"+c:c;
      esc=false; continue;
    }
    if(c==="\\"){esc=true;continue;}
    if(c==='"'){inStr=!inStr;r+=c;continue;}
    if(inStr){
      // sanitise control chars inside strings
      if(c==="\n"){r+=" ";continue;}
      if(c==="\r"||c==="\t"){continue;}
      if(c.charCodeAt(0)<32){continue;}
      // replace smart quotes/apostrophes with plain equivalents
      if(c==="\u2019"||c==="\u2018"){r+="'";continue;}
      if(c==="\u201c"||c==="\u201d"){r+='"';continue;}
      r+=c;
    } else {
      r+=c;
    }
  }
  // Try parsing as-is
  try{ return JSON.parse(r); }catch(_){
    // Count unclosed brackets and close them
    let op=0,ap=0,in2=false,es=false;
    for(const c of r){
      if(es){es=false;continue;}
      if(c==="\\"){es=true;continue;}
      if(c==='"'){in2=!in2;continue;}
      if(!in2){
        if(c==="{")op++;
        else if(c==="}")op--;
        else if(c==="[")ap++;
        else if(c==="]")ap--;
      }
    }
    let fx=r;
    // If we're mid-string, close it
    if(in2) fx+='"';
    for(let a=0;a<ap;a++) fx+="]";
    for(let b=0;b<op;b++) fx+="}";
    try{ return JSON.parse(fx); }
    catch(e){ throw new Error("Parse failed: "+e.message); }
  }
}

// ── AI call — proxied through local server.py (key stays server-side) ─────────
function getApiKey(){ try{ return localStorage.getItem("tm_api_key")||""; }catch(_){ return ""; } }
async function callAI(prompt,maxTok,attempt){
  attempt=attempt||0;
  try{
    // Always use backend proxy — API key is stored securely on the server
    const url="/api/messages";
    const headers={"Content-Type":"application/json"};
    const res=await fetch(url,{method:"POST",headers,
      body:JSON.stringify({model:MODEL,max_tokens:maxTok||900,messages:[{role:"user",content:prompt}]})});
    if(!res.ok){
      const t=await res.text().catch(()=>"");
      if((res.status===529||res.status>=500)&&attempt<2){await new Promise(r=>setTimeout(r,2000*(attempt+1)));return callAI(prompt,maxTok,attempt+1);}
      throw new Error("API "+res.status+(t?": "+t.slice(0,120):""));
    }
    const data=await res.json();
    if(data.error) throw new Error(data.error.message||"AI error");
    const raw=(data.content||[]).map(b=>b.text||"").join("");
    if(!raw.trim()) throw new Error("Empty response");
    return repairJSON(raw);
  }catch(err){
    if((err.name==="TypeError"||/fetch|network/i.test(err.message))&&attempt<2){
      await new Promise(r=>setTimeout(r,1500*(attempt+1)));
      return callAI(prompt,maxTok,attempt+1);
    }
    throw err;
  }
}

// ── Hidden Gems Engine ────────────────────────────────────────────────────────
function gemTextOf(p){ return[p?.name||"",p?.type||"",p?.desc||"",p?.address||"",p?.editorialSummary||""].join(" ").toLowerCase(); }
function hasAny(text,arr){ return arr.some(x=>text.includes(x)); }
function parsePriceLevel(priceText){
  const s=String(priceText||"").toLowerCase();
  if(!s) return 0;
  if(s.includes("free")) return 0;
  if(s.includes("cheap")||s.includes("budget")) return 1;
  if(s.includes("moderate")) return 2;
  if(s.includes("expensive")) return 3;
  if(s.includes("luxury")) return 4;
  const euros=s.match(/€/g);
  if(euros?.length) return Math.min(euros.length,4);
  return 2;
}
function _gemIsIndoor(p){ return hasAny(gemTextOf(p),["museum","gallery","bookstore","cafe","coffee","restaurant","bistro","workshop","market hall","cathedral","church","cinema","spa"]); }
function _gemIsOutdoor(p){ return hasAny(gemTextOf(p),["park","garden","beach","viewpoint","walk","hike","river","lake","square","market","outdoor","lookout"]); }
function isTouristy(p){ return hasAny(gemTextOf(p),["top attraction","must-see","most famous","world-famous","iconic","main attraction","tourist hotspot","very crowded","highly touristic"]); }
function looksHiddenGem(p){ return hasAny(gemTextOf(p),["hidden gem","local favorite","locals love","quiet","tucked away","off the beaten path","neighborhood spot","independent","small gallery","artisan","family-run","less crowded"]); }
function categoryFit(p,interests=[]){
  const t=gemTextOf(p); let score=0;
  const map={"Food & Dining":["restaurant","cafe","bakery","food","wine","bar","bistro"],"Culture":["culture","museum","gallery","theater","music","history"],"History":["history","historic","cathedral","church","palace","fort"],"Nightlife":["bar","cocktail","club","live music","nightlife","pub"],"Nature":["park","garden","lake","river","beach","hike"],"Art":["art","gallery","museum","atelier","studio"],"Shopping":["market","boutique","shop","vintage","design store"],"Hidden Spots":["hidden gem","quiet","off the beaten path","locals love"],"Architecture":["architecture","cathedral","palace","facade","tower"],"Sports":["stadium","sports","climbing","surf","fitness"],"Wellness":["spa","wellness","sauna","yoga"],"Photography":["viewpoint","sunset","lookout","scenic","photography"]};
  for(const i of interests){ const keys=map[i]||[]; if(hasAny(t,keys)) score+=8; }
  return score;
}
function styleFit(p,style="medium"){
  const level=parsePriceLevel(p.price||p.priceLevel||"");
  if(style==="budget"){ if(level<=1) return 8; if(level===2) return 2; return -8; }
  if(style==="luxury"){ if(level>=3) return 8; if(level===2) return 2; return -4; }
  return 3;
}
function timeFit(p,period="afternoon"){
  const t=gemTextOf(p); let score=0;
  if(period==="morning"){ if(hasAny(t,["cafe","bakery","market","walk","garden"])) score+=8; if(hasAny(t,["club","cocktail","nightlife"])) score-=10; }
  if(period==="midday"){ if(hasAny(t,["restaurant","market","museum","gallery"])) score+=8; }
  if(period==="afternoon"){ if(hasAny(t,["gallery","museum","viewpoint","design store"])) score+=7; }
  if(period==="evening"){ if(hasAny(t,["bar","cocktail","wine","live music","restaurant"])) score+=10; if(hasAny(t,["cathedral","museum"])) score-=4; }
  return score;
}
function gemWeatherFit(p,wf){
  if(!weatherLooksRainy(wf)) return 0;
  if(_gemIsIndoor(p)) return 10;
  if(_gemIsOutdoor(p)) return -12;
  return 0;
}
function uniquenessPenalty(p,existing=[]){
  const t=gemTextOf(p); let penalty=0;
  for(const act of existing){
    const a=gemTextOf(act); if(!a) continue;
    if((t.includes("museum")&&a.includes("museum"))||(t.includes("gallery")&&a.includes("gallery"))||(t.includes("restaurant")&&a.includes("restaurant"))||(t.includes("bar")&&a.includes("bar"))||(t.includes("viewpoint")&&a.includes("viewpoint"))) penalty+=5;
  }
  return penalty;
}
function scoreHiddenGem(p,context){
  let score=0;
  if(looksHiddenGem(p)) score+=18;
  if(isTouristy(p)) score-=16;
  score+=categoryFit(p,context.interests);
  score+=styleFit(p,context.style);
  score+=timeFit(p,context.period);
  score+=gemWeatherFit(p,context.weatherForecast);
  const rating=Number(p.rating||0);
  if(!Number.isNaN(rating)) score+=Math.min(Math.max(rating-3.5,0),1.5)*6;
  const reviews=Number(p.userRatingCount||p.reviewCount||0);
  if(reviews>20&&reviews<600) score+=4;
  if(reviews>5000) score-=4;
  score-=uniquenessPenalty(p,context.existingActivities);
  return score;
}
function rankHiddenGems(places,context){
  return [...(places||[])].map((p,i)=>({...p,hiddenGemScore:scoreHiddenGem(p,context),_idx:i})).sort((a,b)=>b.hiddenGemScore!==a.hiddenGemScore?b.hiddenGemScore-a.hiddenGemScore:a._idx-b._idx).map(({_idx,...rest})=>rest);
}
function selectTopHiddenGems(places,context,limit=4){
  return rankHiddenGems(places,context).filter(p=>p.hiddenGemScore>0).slice(0,limit).map(p=>({
    _id:p._id||uid(),name:p.name||"Hidden gem",type:p.type||"Place",desc:p.desc||p.editorialSummary||"",address:p.address||p.formattedAddress||"",duration:p.duration||"1h 30m",time:p.time||"",price:p.price||"Free",isFree:!!p.isFree||String(p.price||"").toLowerCase().includes("free"),
    openHours:p.openHours||"",tip:p.tip||"Less obvious pick chosen for better local fit and lower tourist density.",imgQuery:p.imgQuery||p.name||"hidden gem",rating:p.rating||null,hiddenGemScore:p.hiddenGemScore,hiddenGem:true
  }));
}

// ── Trip Personality Engine ───────────────────────────────────────────────────
const TRIP_PERSONALITIES = {
  explorer:  {id:"explorer",  label:"🗺️ Explorer",         description:"Packed days, lots of variety, mix of must-sees and hidden corners.",     pace:"fast",   diningStyle:"local",      activityBias:["sightseeing","walking","culture","landmark"]},
  relaxed:   {id:"relaxed",   label:"☀️ Relaxed",           description:"Slow mornings, fewer activities, time to breathe and soak it in.",       pace:"slow",   diningStyle:"sit-down",   activityBias:["park","cafe","garden","scenic","viewpoint"]},
  foodie:    {id:"foodie",    label:"🍽️ Foodie",            description:"Built around meals, markets, and culinary experiences.",                  pace:"medium", diningStyle:"restaurant", activityBias:["food","market","dining","restaurant","tasting"]},
  cultural:  {id:"cultural",  label:"🎭 Cultural Deep-Dive",description:"Museums, history, arts, and local traditions take center stage.",         pace:"medium", diningStyle:"local",      activityBias:["museum","history","art","gallery","heritage"]},
  adventure: {id:"adventure", label:"⚡ Adventure",          description:"Active, outdoorsy, physically engaging — no lazy mornings.",              pace:"fast",   diningStyle:"quick",      activityBias:["outdoor","sport","hike","nature","activity"]},
  luxury:    {id:"luxury",    label:"✨ Luxury",             description:"Premium experiences, fine dining, spas, and high-end stays.",             pace:"medium", diningStyle:"fine-dining",activityBias:["luxury","spa","premium","rooftop","exclusive"]},
  budget:    {id:"budget",    label:"💸 Budget Traveller",  description:"Free attractions, street food, local transport, maximum value.",          pace:"fast",   diningStyle:"street",     activityBias:["free","walking","market","street","gratis"]},
  romantic:  {id:"romantic",  label:"💑 Romantic",          description:"Intimate settings, scenic spots, candlelit dinners, and memorable moments.",pace:"slow",  diningStyle:"fine-dining",activityBias:["scenic","sunset","romantic","garden","view"]},
};
function getDefaultPersonalityFromForm(form){
  const interests=(form?.interests||[]).map(s=>s.toLowerCase());
  const style=(form?.style||"").toLowerCase();
  if(interests.some(i=>["food","foodie","dining","culinary","restaurant"].includes(i))) return "foodie";
  if(interests.some(i=>["hiking","outdoor","adventure","sport","climbing"].includes(i))) return "adventure";
  if(interests.some(i=>["museum","history","art","culture","gallery"].includes(i))) return "cultural";
  if(style==="luxury") return "luxury";
  if(style==="budget") return "budget";
  if(style==="relaxed"||style==="slow") return "relaxed";
  return "explorer";
}
function applyTripPersonalityToDay(day,form,personalityId,totalDays){
  const p=TRIP_PERSONALITIES[personalityId]||TRIP_PERSONALITIES.explorer;
  let acts=[...(day.activities||[])];
  if(p.pace==="slow") acts=acts.slice(0,Math.max(2,Math.ceil(acts.length*0.65)));
  const scored=acts.map(a=>{
    const text=[a.name,a.type,a.desc].join(" ").toLowerCase();
    return {...a,_pScore:p.activityBias.some(k=>text.includes(k))?1:0};
  });
  const sorted=[...scored].sort((a,b)=>b._pScore-a._pScore).map(({_pScore,...rest})=>rest);
  return optimizeDayPlan({...day,activities:sorted},form,totalDays);
}
function applyTripPersonalityToTrip(days,form,personalityId){
  return days.map(d=>applyTripPersonalityToDay(d,{...form,personalityId},personalityId,days.length));
}
function buildPersonalityPromptBlock(personalityId){
  const p=TRIP_PERSONALITIES[personalityId]||TRIP_PERSONALITIES.explorer;
  return `Trip personality: ${p.label} — ${p.description} Pace: ${p.pace}. Preferred dining: ${p.diningStyle}. Prioritize activity types: ${p.activityBias.join(", ")}.`;
}

// ── Route Optimizer ───────────────────────────────────────────────────────────
function haversineKm(a,b){
  const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
  const lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.sin(dLng/2)**2*Math.cos(lat1)*Math.cos(lat2);
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function estimateTravelMinutes(km,transport="mixed"){
  if(transport==="walking") return Math.max(8,Math.round(km*14));
  if(transport==="car") return Math.max(6,Math.round(km*3.2));
  if(transport==="public") return Math.max(10,Math.round(km*6.5));
  return Math.max(8,Math.round(km*5));
}
async function geocodeQuery(query){
  const url="https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(query);
  const res=await fetch(url); if(!res.ok) throw new Error("Geocoding failed");
  const d=await res.json(); if(!d?.[0]) return null;
  return {lat:Number(d[0].lat),lng:Number(d[0].lon)};
}
async function geocodeStop(stop,destination){
  if(stop?.lat!=null&&stop?.lng!=null) return {lat:Number(stop.lat),lng:Number(stop.lng)};
  const query=[stop.address,stop.name,destination].filter(Boolean).join(", ");
  return geocodeQuery(query);
}
async function geocodeStops(stops,destination){
  const out=[];
  for(const s of stops){
    try{ const c=await geocodeStop(s,destination); out.push({...s,lat:c?.lat??null,lng:c?.lng??null}); }
    catch(_){ out.push({...s,lat:null,lng:null}); }
  }
  return out;
}
function nearestNeighborOrder(stops,startPoint){
  const withCoords=stops.filter(s=>s.lat!=null&&s.lng!=null);
  const withoutCoords=stops.filter(s=>s.lat==null||s.lng==null);
  const remaining=[...withCoords]; const ordered=[]; let current=startPoint;
  while(remaining.length){
    let bestIdx=0,bestDist=Infinity;
    for(let i=0;i<remaining.length;i++){ const d=haversineKm(current,remaining[i]); if(d<bestDist){bestDist=d;bestIdx=i;} }
    const [picked]=remaining.splice(bestIdx,1); ordered.push(picked); current=picked;
  }
  return [...ordered,...withoutCoords];
}
function keepUserOrderButRetime(stops,startPoint,transport){
  let current=startPoint;
  return stops.map(s=>{
    let travelMinutes=0;
    if(current?.lat!=null&&current?.lng!=null&&s?.lat!=null&&s?.lng!=null)
      travelMinutes=estimateTravelMinutes(haversineKm(current,s),transport);
    current=s;
    return {...s,_route:{...(s._route||{}),travelMinutesFromPrev:travelMinutes}};
  });
}
function applyTimesRoute(stops,dayStart,dayEnd){
  let cursor=dayStart;
  return stops.map(s=>{
    const travel=s?._route?.travelMinutesFromPrev||0; cursor+=travel;
    const duration=parseDurationToMinutes(s.duration);
    const explicitStart=s.locked?toMins(s.time):null;
    const start=explicitStart!=null&&explicitStart>cursor?explicitStart:cursor;
    const end=start+duration;
    const next={...s,time:fmtTime(start),endTime:fmtTime(end),conflict:end>dayEnd,travelMinutesFromPrev:travel,travelLabelFromPrev:travel?`${travel} min`:""};
    cursor=end+20; return next;
  });
}
function buildRouteSegments(stops,startPoint,transport){
  const segments=[]; let prev=startPoint;
  for(const s of stops){
    if(prev?.lat!=null&&prev?.lng!=null&&s?.lat!=null&&s?.lng!=null){
      const km=haversineKm(prev,s),mins=estimateTravelMinutes(km,transport);
      segments.push({from:prev.name||"Start",to:s.name,km:Number(km.toFixed(2)),minutes:mins});
    } else { segments.push({from:prev?.name||"Start",to:s.name,km:null,minutes:null}); }
    prev=s;
  }
  return segments;
}
async function optimizeRouteForDay({day,form,totalDays,destination,hotel,keepUserSequence=false}){
  const rawStops=(day.activities||[]).map((a,idx)=>({...a,_originalIndex:idx}));
  const geocodedStops=await geocodeStops(rawStops,destination);
  let startPoint=null;
  if(hotel){ const hc=await geocodeQuery([hotel,destination].filter(Boolean).join(", ")); startPoint={name:hotel,lat:hc?.lat??null,lng:hc?.lng??null}; }
  const routeBase=startPoint||{name:destination,lat:geocodedStops.find(s=>s.lat!=null)?.lat??null,lng:geocodedStops.find(s=>s.lng!=null)?.lng??null};
  let orderedStops;
  if(keepUserSequence){
    orderedStops=keepUserOrderButRetime(geocodedStops,routeBase,form.transport);
  } else {
    const locked=geocodedStops.filter(s=>s.locked),unlocked=geocodedStops.filter(s=>!s.locked);
    const reorderedUnlocked=nearestNeighborOrder(unlocked,routeBase);
    // Interleave: sort everything by time when available, locked respected, unlocked fills gaps
    const merged=[...locked,...reorderedUnlocked].sort((a,b)=>{
      const at=toMins(a.time)||0, bt=toMins(b.time)||0;
      if(at&&bt) return at-bt;            // both have times → sort by time
      if(at) return -1;                   // a has time → earlier
      if(bt) return 1;                    // b has time → earlier
      return a._originalIndex-b._originalIndex; // neither → original order
    });
    orderedStops=keepUserOrderButRetime(merged,routeBase,form.transport);
  }
  const dayStart=getDayStart(day,form),dayEnd=getDayEnd(day,form,totalDays);
  const timedStops=applyTimesRoute(orderedStops,dayStart,dayEnd);
  const segments=buildRouteSegments(timedStops,routeBase,form.transport);
  return {...day,activities:timedStops.map(s=>({...s,lat:s.lat,lng:s.lng})),routeMeta:{optimizedAt:new Date().toISOString(),keepUserSequence,startPoint:routeBase.name,segments}};
}
async function retimeAfterManualReorder({day,form,totalDays,destination,hotel}){
  return optimizeRouteForDay({day,form,totalDays,destination,hotel,keepUserSequence:true});
}
function reorderActivitiesLocally(activities,fromIndex,toIndex){
  const next=[...activities]; const [moved]=next.splice(fromIndex,1); next.splice(toIndex,0,moved); return next;
}

// ── AI Travel Concierge ────────────────────────────────────────────────────────
const weatherIsRainy=weatherLooksRainy; // alias — same logic, one source of truth
function summarizeDay(day){
  return{day:day?.day??null,theme:day?.theme||"",neighborhood:day?.neighborhood||"",weatherForecast:day?.weatherForecast||"",timeWindow:day?.timeWindow||"",
    activities:(day?.activities||[]).map(a=>({id:a._id||a.name,name:a.name||"",type:a.type||"",time:a.time||"",duration:a.duration||"",price:a.price||"",address:a.address||"",desc:a.desc||"",isFree:!!a.isFree})),
    lunch:day?.lunch||null,dinner:day?.dinner||null};
}
function buildConciergePrompt({destination,hotel,currentDay,allDays,activeDayIndex,userMessage,userLoc,travelers,ageGroup,style,interests}){
  const day=summarizeDay(currentDay);
  const rainy=weatherIsRainy(day.weatherForecast);
  return `You are TripMind Concierge, an elite in-trip AI travel assistant.
Reply ONLY with valid JSON. No markdown. No explanation outside JSON.
Your job: answer the user's travel question. Be concrete, useful, action-oriented. If weather is rainy, prioritize indoor options. If the user asks for a swap, provide replacement suggestions.
Return JSON in exactly this shape:
{"answerTitle":"","answerText":"","mode":"advice","quickActions":[{"label":"","type":"tip"}],"suggestions":[{"name":"","type":"","desc":"","reason":"","time":"","duration":"","price":"","isFree":false,"address":"","tip":"","transport":"","bookingUrl":"","imgQuery":""}]}
Constraints: suggestions 0-4, quickActions 0-4.
Trip context: destination:${JSON.stringify(destination||"")} hotel:${JSON.stringify(hotel||"")} travelers:${JSON.stringify(travelers??"")} ageGroup:${JSON.stringify(ageGroup||"")} style:${JSON.stringify(style||"")} interests:${JSON.stringify(interests||[])} activeDayIndex:${JSON.stringify(activeDayIndex)} currentDay:${JSON.stringify(day)} allDaysSummary:${JSON.stringify((allDays||[]).map(d=>({day:d.day,theme:d.theme||"",weatherForecast:d.weatherForecast||""})))} userLocation:${JSON.stringify(userLoc||null)} rainyContext:${JSON.stringify(rainy)}
User request: ${JSON.stringify(userMessage||"")}`.trim();
}
// ── Concierge API call — uses /api/chat (server-side key, never in browser) ────
async function callConciergeAPI(prompt,maxTok=1200,attempt=0){
  try{
    const res=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:[{role:"user",content:prompt}],max_tokens:maxTok})
    });
    if(!res.ok){
      const t=await res.text().catch(()=>"");
      if((res.status>=500)&&attempt<2){
        await new Promise(r=>setTimeout(r,1500*(attempt+1)));
        return callConciergeAPI(prompt,maxTok,attempt+1);
      }
      throw new Error("Concierge API "+res.status+(t?": "+t.slice(0,120):""));
    }
    const data=await res.json();
    if(data.error) throw new Error(data.error||"AI error");
    const raw=(data.content||[]).map(b=>b.text||"").join("");
    if(!raw.trim()) throw new Error("Empty concierge response");
    return repairJSON(raw);
  }catch(err){
    if((err.name==="TypeError"||/fetch|network/i.test(err.message))&&attempt<2){
      await new Promise(r=>setTimeout(r,1500*(attempt+1)));
      return callConciergeAPI(prompt,maxTok,attempt+1);
    }
    throw err;
  }
}

async function askTravelConcierge({destination,hotel,currentDay,allDays,activeDayIndex,userMessage,userLoc,travelers,ageGroup,style,interests}){
  if(!userMessage?.trim()) throw new Error("Message is empty");
  const prompt=buildConciergePrompt({destination,hotel,currentDay,allDays,activeDayIndex,userMessage,userLoc,travelers,ageGroup,style,interests});
  const data=await callConciergeAPI(prompt,1200);
  return{
    answerTitle:data.answerTitle||"TripMind Concierge",
    answerText:data.answerText||"",
    mode:data.mode||"advice",
    quickActions:Array.isArray(data.quickActions)?data.quickActions.slice(0,4):[],
    suggestions:Array.isArray(data.suggestions)?data.suggestions.slice(0,4).map(s=>({_id:uid(),name:s.name||"Suggested stop",type:s.type||"Activity",desc:s.desc||"",reason:s.reason||"",time:s.time||"",duration:s.duration||"1h 30m",price:s.price||"Free",isFree:!!s.isFree,address:s.address||"",tip:s.tip||"",transport:s.transport||"",bookingUrl:s.bookingUrl||"",imgQuery:s.imgQuery||s.name||"travel",source:"concierge"})):[]
  };
}
function buildQuickPrompt(label){
  return{"Next 2 hours":"What should I do for the next 2 hours?","Rain backup":"It is raining. What should I swap out today?","Dinner now":"Find me a good dinner option for tonight.","Near me now":"What is worth doing near me right now?"}[label]||label;
}

// ── Google Places search ───────────────────────────────────────────────────────
async function searchPlaces({ query, destination }) {
  const textQuery = `${query} in ${destination}`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.websiteUri,places.regularOpeningHours,places.location"
    },
    body: JSON.stringify({ textQuery, pageSize: 5 })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API error: ${res.status} ${text}`);
  }
  const data = await res.json();
  return (data.places || []).map(p => ({
    _id: uid(),
    name: p.displayName?.text || "Unknown place",
    type: "Place",
    desc: `Rating: ${p.rating || "n/a"} · Price: ${p.priceLevel || "n/a"}`,
    address: p.formattedAddress || "",
    duration: "1h 30m",
    price: "Free",
    isFree: true,
    openHours: p.regularOpeningHours?.weekdayDescriptions?.join(" | ") || "",
    websiteUrl: p.websiteUri || "",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    time: "14:00"
  }));
}

// ── Leaflet loader (singleton, cdnjs) ─────────────────────────────────────────
let _lState="idle";
const _lCbs=[];
function loadLeaflet(cb){
  if(_lState==="ready"){cb();return;}
  if(_lState==="error") return;
  _lCbs.push(cb);
  if(_lState==="loading") return;
  _lState="loading";
  const lnk=document.createElement("link");lnk.rel="stylesheet";lnk.href=LEAFLET_CSS;document.head.appendChild(lnk);
  const sc=document.createElement("script");sc.src=LEAFLET_JS;
  sc.onload=()=>{_lState="ready";_lCbs.splice(0).forEach(f=>f());};
  sc.onerror=()=>{_lState="error";console.error("Leaflet failed to load from cdnjs");};
  document.head.appendChild(sc);
}

// ── DayMap ─────────────────────────────────────────────────────────────────────
function DayMap({acts,destination,hotel,isFirstDay,isLastDay,userLoc,onRequestLocation,visible,onReady,zoomToActId}){
  const elRef=useRef(null);
  const mapRef=useRef(null);
  const initedRef=useRef(false);
  const markerLayersRef=useRef({});// actId → {marker,lat,lng}
  const [lReady,setLReady]=useState(false);
  const [plotting,setPlotting]=useState(false);
  const [mapError,setMapError]=useState(false);

  useEffect(()=>{ loadLeaflet(()=>setLReady(true)); },[]);

  // Init map container exactly once
  useEffect(()=>{
    if(!lReady||!elRef.current||initedRef.current) return;
    if(!window.L){setMapError(true);return;}
    initedRef.current=true;
    const L=window.L;
    try{
      const m=L.map(elRef.current,{zoomControl:true,attributionControl:false,tap:false,scrollWheelZoom:false});
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(m);
      mapRef.current=m;
      // Try corrected destination name first, then first word as typo fallback
      // Never fall back to a hardcoded city — show no default view instead
      const geoTry=(q)=>fetch("https://nominatim.openstreetmap.org/search?format=json&limit=3&q="+encodeURIComponent(q)).then(r=>r.json()).catch(()=>[]);
      geoTry(destination).then(d=>{
        if(d&&d[0]){m.setView([+d[0].lat,+d[0].lon],12);return;}
        // typo fallback: strip to first comma-word (e.g. "Mykkonos" -> Mykonos via first token)
        const tok=destination.split(/[\s,]+/).filter(Boolean);
        if(tok.length>1) return geoTry(tok[0]).then(d2=>{if(d2&&d2[0])m.setView([+d2[0].lat,+d2[0].lon],12);});
      }).finally(()=>setTimeout(()=>{try{m.invalidateSize();}catch(_){}},120));
    }catch(e){setMapError(true);}
  },[lReady,destination]);

  // Rebuild all markers + route whenever relevant props change
  // cancelRef lets us abort in-flight geocoding when this effect re-fires
  const geoAbortRef=useRef({cancelled:false});
  useEffect(()=>{
    if(!mapRef.current||!lReady) return;
    // Cancel any previous in-flight geocoding run
    geoAbortRef.current.cancelled=true;
    const token={cancelled:false};
    geoAbortRef.current=token;

    const L=window.L; const map=mapRef.current;
    map.eachLayer(l=>{if(!(l instanceof L.TileLayer))map.removeLayer(l);});
    markerLayersRef.current={};
    setPlotting(true);

    const allPoints=[];
    const geo=(q)=>fetch("https://nominatim.openstreetmap.org/search?format=json&limit=3&q="+encodeURIComponent(q)).then(r=>r.json()).catch(()=>[]);
    const sleep=(ms)=>new Promise(res=>setTimeout(res,ms));

    function renderMarkers(){
      if(token.cancelled) return;
      setPlotting(false);
      if(!allPoints.length){ setTimeout(()=>{try{map.invalidateSize();}catch(_){}},80); return; }

      try{
        map.fitBounds(L.latLngBounds(allPoints.map(p=>[p.lat,p.lng])),{padding:[44,44],maxZoom:15});
      }catch(_){}

      const hotelPt=allPoints.find(p=>p.kind==="hotel");
      const airportPt=allPoints.find(p=>p.kind==="airport");
      const actPts=[...allPoints.filter(p=>p.kind==="act")].sort((a,b)=>a.idx-b.idx);

      const routePts=[];
      if(hotelPt) routePts.push([hotelPt.lat,hotelPt.lng]);
      actPts.forEach(p=>routePts.push([p.lat,p.lng]));
      if(airportPt) routePts.push([airportPt.lat,airportPt.lng]);
      if(routePts.length>1) L.polyline(routePts,{color:"#2F4156",weight:3,dashArray:"8,5",opacity:.85}).addTo(map);

      if(hotelPt){
        const icon=L.divIcon({className:"",html:`<div style="width:42px;height:42px;border-radius:10px;background:#567C8D;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,.35);border:2.5px solid #fff;"><span style="font-size:18px;line-height:1">🏨</span><span style="font-size:6px;color:#fff;font-weight:900;letter-spacing:.03em;margin-top:1px">HOTEL</span></div>`,iconSize:[42,42],iconAnchor:[21,42],popupAnchor:[0,-44]});
        L.marker([hotelPt.lat,hotelPt.lng],{icon,zIndexOffset:1000}).addTo(map).bindPopup(`<div style="font-family:sans-serif;font-size:13px"><b>🏨 ${hotel}</b><div style="font-size:11px;color:#567C8D;margin-top:3px">Your hotel — day starts here</div></div>`);
      }

      actPts.forEach(p=>{
        const act=p.act; const em=typeEmoji(act.type); const num=p.idx+1;
        const icon=L.divIcon({className:"",html:`<div style="position:relative;width:46px;height:46px;border-radius:50%;background:#fff;border:2.5px solid #2F4156;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.25);"><span style="font-size:24px;line-height:1">${em}</span><div style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;background:#2F4156;border:2px solid #fff;display:flex;align-items:center;justify-content:center;"><span style="font-size:9px;font-weight:900;color:#fff;line-height:1">${num}</span></div></div>`,iconSize:[46,46],iconAnchor:[23,46],popupAnchor:[0,-48]});
        const gyg="https://www.getyourguide.com/s/?q="+encodeURIComponent(act.name+" "+destination);
        const popup=`<div style="font-family:sans-serif;min-width:150px;max-width:200px"><div style="font-size:18px;margin-bottom:3px">${em}</div><b style="font-size:13px;color:#2C365A">${act.name}</b><div style="font-size:11px;color:#567C8D;margin-top:3px">${act.time||""}${act.duration?" · "+act.duration:""}</div>${act.address?`<div style="font-size:10px;color:#8A9CAA;margin-top:2px">📍 ${act.address}</div>`:""}<div style="font-size:11px;margin-top:3px;font-weight:600;color:${act.isFree?"#567C8D":"#2F4156"}">${act.isFree?"Free":(act.price||"")}</div>${act.transport?`<div style="font-size:10px;color:#567C8D;margin-top:3px">🚌 ${act.transport}</div>`:""}${!act.isFree?`<a href="${gyg}" target="_blank" style="display:inline-block;margin-top:6px;padding:3px 10px;background:#dc2626;border-radius:4px;color:#fff;font-size:11px;font-weight:700">Book</a>`:""}</div>`;
        const mk=L.marker([p.lat,p.lng],{icon}).addTo(map).bindPopup(popup);
        markerLayersRef.current[act._id||act.name]={marker:mk,lat:p.lat,lng:p.lng};
      });

      if(onReady) onReady({zoomTo:(actId)=>{
        const entry=markerLayersRef.current[actId];
        if(entry&&mapRef.current){mapRef.current.setView([entry.lat,entry.lng],16,{animate:true});entry.marker.openPopup();}
      }});

      if(airportPt){
        const icon=L.divIcon({className:"",html:`<div style="width:42px;height:42px;border-radius:10px;background:#2F4156;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(0,0,0,.35);border:2.5px solid #fff;"><span style="font-size:18px;line-height:1">✈️</span><span style="font-size:6px;color:#C8D9E6;font-weight:900;letter-spacing:.03em;margin-top:1px">AIRPORT</span></div>`,iconSize:[42,42],iconAnchor:[21,42],popupAnchor:[0,-44]});
        L.marker([airportPt.lat,airportPt.lng],{icon,zIndexOffset:999}).addTo(map).bindPopup(`<div style="font-family:sans-serif;font-size:13px"><b>✈️ ${isFirstDay&&isLastDay?"Arrival & Departure Airport":isFirstDay?"Arrival Airport":"Departure Airport"}</b></div>`);
      }

      if(userLoc){
        const ui=L.divIcon({className:"",html:'<div style="width:14px;height:14px;border-radius:50%;background:#2F4156;border:3px solid #fff;box-shadow:0 0 0 3px rgba(47,65,86,.3)"></div>',iconSize:[14,14],iconAnchor:[7,7]});
        L.marker([userLoc.lat,userLoc.lng],{icon:ui}).addTo(map).bindPopup("You are here");
      }

      setTimeout(()=>{try{map.invalidateSize();}catch(_){}},120);
    }

    async function runAllGeocode(){
      // Step 1: get city center + build viewbox to constrain all searches to this region
      const cityData=await geo(destination);
      if(token.cancelled) return;
      let cityCenter=null;
      if(cityData&&cityData[0]) cityCenter={lat:+cityData[0].lat,lng:+cityData[0].lon};

      // viewbox ±0.15° ≈ ±15 km — keeps results inside the right city
      const vb=cityCenter
        ?`${cityCenter.lng-0.15},${cityCenter.lat+0.15},${cityCenter.lng+0.15},${cityCenter.lat-0.15}`
        :null;
      // geocode within city bounds; fall back to global if nothing found
      const geoLocal=async(q)=>{
        if(vb){
          const url=`https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}&viewbox=${vb}&bounded=1`;
          const d=await fetch(url).then(r=>r.json()).catch(()=>[]);
          if(d&&d[0]) return d;
        }
        return geo(q);
      };

      // Step 2: hotel
      if(!token.cancelled&&hotel){
        const d=await geoLocal(hotel+", "+destination);
        if(!token.cancelled&&d&&d[0]) allPoints.push({lat:+d[0].lat,lng:+d[0].lon,kind:"hotel"});
        await sleep(300);
      }

      // Step 3: airport (global search — airports often outside city viewbox)
      if(!token.cancelled&&(isFirstDay||isLastDay)){
        const d=await geo("international airport "+destination);
        if(!token.cancelled&&d&&d[0]) allPoints.push({lat:+d[0].lat,lng:+d[0].lon,kind:"airport"});
        await sleep(300);
      }

      // Step 4: activities
      if(!token.cancelled&&acts&&acts.length>0){
        for(let i=0;i<acts.length;i++){
          if(token.cancelled) return;
          const act=acts[i];

          // Use pre-stored coords if they look plausible (within ~55 km of city center)
          if(act.lat&&act.lng){
            const plausible=!cityCenter||
              (Math.abs(act.lat-cityCenter.lat)<0.5&&Math.abs(act.lng-cityCenter.lng)<0.5);
            if(plausible){
              allPoints.push({lat:act.lat,lng:act.lng,kind:"act",act,idx:i});
              continue;
            }
          }

          // Name-first query is most accurate; include address as additional context only when present
          const q=act.name+(act.address?", "+act.address:"")+", "+destination;
          const d=await geoLocal(q);
          if(token.cancelled) return;

          if(d&&d[0]){
            allPoints.push({lat:+d[0].lat,lng:+d[0].lon,kind:"act",act,idx:i});
          }
          // No city-center-offset fallback — a missing pin is better than a wrong one

          if(i<acts.length-1) await sleep(300);
        }
      }

      if(!token.cancelled) renderMarkers();
    }

    runAllGeocode();

    return()=>{ token.cancelled=true; };
  },[lReady,acts,destination,hotel,isFirstDay,isLastDay,userLoc]);

  // Zoom to a specific activity when requested from outside
  useEffect(()=>{
    if(!zoomToActId||!markerLayersRef.current) return;
    const entry=markerLayersRef.current[zoomToActId];
    if(entry&&mapRef.current){ mapRef.current.setView([entry.lat,entry.lng],16,{animate:true}); entry.marker.openPopup(); }
  },[zoomToActId]);

  // Invalidate when becoming visible
  useEffect(()=>{
    if(visible&&mapRef.current){
      setTimeout(()=>{try{mapRef.current.invalidateSize();}catch(_){}},50);
      setTimeout(()=>{try{mapRef.current.invalidateSize();}catch(_){}},300);
    }
  },[visible]);

  const navUrl=()=>{
    if(!acts?.length&&!hotel) return "#";
    const stops=(acts||[]).map(a=>encodeURIComponent((a.name||"")+" "+destination));
    const orig=hotel?encodeURIComponent(hotel+", "+destination):(stops[0]||"");
    if(stops.length===0) return "https://www.google.com/maps/search/"+encodeURIComponent(hotel+", "+destination);
    return "https://www.google.com/maps/dir/"+orig+"/"+stops.join("/");
  };

  const showAirport=isFirstDay||isLastDay;

  return(
    <div style={{display:visible?"block":"none"}}>
      <div style={{position:"relative",borderRadius:13,overflow:"hidden",border:"1px solid #C8D9E6",background:"#C8D9E6",marginBottom:10}}>
        <div ref={elRef} style={{height:280,width:"100%"}}/>
        {!lReady&&!mapError&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,background:"rgba(240,244,248,.95)"}}>
            <Spin size={26}/><div style={{fontSize:".78rem",color:"#567C8D"}}>Loading map…</div>
          </div>
        )}
        {mapError&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#fef2f2",color:"#dc2626",fontSize:".82rem",textAlign:"center",padding:16}}>
            Map unavailable – check connection
          </div>
        )}
        {lReady&&plotting&&(
          <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",background:"rgba(47,65,86,.92)",color:"#fff",fontSize:".7rem",padding:"4px 12px",borderRadius:50,whiteSpace:"nowrap",pointerEvents:"none"}}>
            Plotting stops…
          </div>
        )}
        {/* Legend overlay */}
        {lReady&&!plotting&&(
          <div style={{position:"absolute",top:10,right:10,display:"flex",flexDirection:"column",gap:4,pointerEvents:"none"}}>
            {hotel&&<div style={{background:"rgba(255,255,255,.92)",borderRadius:6,padding:"3px 8px",fontSize:".62rem",fontWeight:700,color:"#567C8D",display:"flex",alignItems:"center",gap:4}}>🏨 Hotel</div>}
            {showAirport&&<div style={{background:"rgba(255,255,255,.92)",borderRadius:6,padding:"3px 8px",fontSize:".62rem",fontWeight:700,color:"#2F4156",display:"flex",alignItems:"center",gap:4}}>✈️ {isFirstDay&&isLastDay?"Airport":isFirstDay?"Arrival":"Departure"}</div>}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {!userLoc
          ?<button onClick={onRequestLocation} style={{padding:"10px 15px",borderRadius:9,background:"#2F4156",border:"none",color:"#fff",fontSize:".82rem",fontWeight:700,fontFamily:"inherit",minHeight:44}}>📍 My Location</button>
          :<span style={{padding:"9px 13px",borderRadius:9,background:"#dceaf3",border:"1px solid #A8C3D3",fontSize:".8rem",color:"#567C8D",fontWeight:600}}>📍 Active</span>
        }
        <a href={navUrl()} target="_blank" rel="noreferrer" style={{padding:"10px 15px",borderRadius:9,background:"#2F4156",border:"none",color:"#fff",fontSize:".82rem",fontWeight:700,display:"flex",alignItems:"center",gap:5,minHeight:44}}>🧭 Navigate Day</a>
      </div>
    </div>
  );
}

// ── Hero Activity Card (magazine first-card) ──────────────────────────────────
function HeroActCard({act,onRemove,onZoom}){
  const [imgOk,setImgOk]=useState(true);
  const [open,setOpen]=useState(false);
  const src=imgOk?actImg(act.imgQuery||act.name):null;
  const em=typeEmoji(act.type);
  const bookUrl="https://www.getyourguide.com/s/?q="+encodeURIComponent((act.name||"")+" "+(act.address||""));
  return(
    <div className="fu" style={{borderRadius:18,overflow:"hidden",marginBottom:14,position:"relative",boxShadow:"0 8px 32px rgba(47,65,86,.18)"}}>
      <div style={{height:240,position:"relative",background:"#2C365A"}}>
        {src&&<img src={src} alt={act.name} loading="lazy" onError={()=>setImgOk(false)} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(20,30,50,.92) 0%,rgba(20,30,50,.4) 50%,rgba(0,0,0,.1) 100%)"}}/>
        <button onClick={()=>onRemove(act._id||act.name)} style={{position:"absolute",top:12,right:12,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"1.5px solid rgba(255,255,255,.3)",color:"#fff",fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>x</button>
        {act.isHidden&&<span style={{position:"absolute",top:12,left:12,fontSize:".62rem",padding:"3px 9px",background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.3)",borderRadius:50,color:"#fff",fontWeight:600}}>Hidden gem</span>}
        {act.conflict&&<span style={{position:"absolute",top:12,left:act.isHidden?120:12,fontSize:".62rem",padding:"3px 9px",background:"rgba(220,38,38,.7)",border:"1px solid rgba(255,255,255,.3)",borderRadius:50,color:"#fff",fontWeight:700}}>⚠ Time conflict</span>}
        {act.weatherWarning&&<span style={{position:"absolute",top:act.conflict?40:12,left:act.isHidden?120:12,fontSize:".62rem",padding:"3px 9px",background:"rgba(86,124,141,.85)",border:"1px solid rgba(255,255,255,.3)",borderRadius:50,color:"#fff",fontWeight:700}}>🌧 Rain risk</span>}
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"18px 16px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
            <span style={{background:"rgba(255,255,255,.18)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",borderRadius:50,padding:"3px 11px",fontSize:".72rem",fontWeight:700}}>{act.time||"--:--"}</span>
            <span style={{background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.2)",color:"#fff",borderRadius:50,padding:"3px 10px",fontSize:".72rem"}}>{em} {act.type||"Activity"}</span>
            {act.isFree
              ?<span style={{background:"rgba(86,124,141,.7)",borderRadius:50,padding:"3px 10px",fontSize:".72rem",color:"#fff",fontWeight:700}}>Free</span>
              :<span style={{background:"rgba(255,255,255,.15)",borderRadius:50,padding:"3px 10px",fontSize:".72rem",color:"#fff"}}>{act.price}</span>}
          </div>
          <h3 style={{fontSize:"1.45rem",fontWeight:900,color:"#fff",letterSpacing:"-.02em",lineHeight:1.15,marginBottom:4,textShadow:"0 2px 8px rgba(0,0,0,.4)"}}>{act.name}</h3>
          {act.desc&&<p style={{fontSize:".82rem",color:"rgba(255,255,255,.82)",lineHeight:1.5,margin:0}}>{act.desc}</p>}
        </div>
      </div>
      <div style={{background:"#fff",padding:"12px 14px",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        {act.duration&&<span style={{fontSize:".72rem",color:"#567C8D"}}>&#x23F1; {act.duration}</span>}
        {act.openHours&&<span style={{fontSize:".72rem",color:"#567C8D"}}>&#x1F550; {act.openHours}</span>}
        <div style={{flex:1}}/>
        {!act.isFree&&<a href={bookUrl} target="_blank" rel="noreferrer" style={{padding:"8px 14px",background:"#dc2626",borderRadius:8,color:"#fff",fontSize:".78rem",fontWeight:700}}>Book</a>}
        <button onClick={()=>setOpen(x=>!x)} style={{padding:"8px 14px",background:"#EEE8DF",border:"none",borderRadius:8,color:"#2F4156",fontSize:".78rem",fontFamily:"inherit",fontWeight:600}}>{open?"Less":"More"}</button>
        {onZoom&&<button onClick={onZoom} style={{padding:"8px 12px",background:"#dceaf3",border:"1px solid #C8D9E6",borderRadius:8,color:"#2F4156",fontSize:".78rem",fontFamily:"inherit",fontWeight:600}}>🎯 Focus</button>}
        <a href={"https://www.google.com/maps/search/"+encodeURIComponent(act.name)} target="_blank" rel="noreferrer" style={{padding:"8px 12px",background:"#567C8D",borderRadius:8,color:"#fff",fontSize:".78rem"}}>Map</a>
      </div>
      {open&&<div style={{background:"#F5EFEB",padding:"12px 14px",borderTop:"1px solid #C8D9E6",display:"flex",flexDirection:"column",gap:8}}>
        {act.address&&<div style={{fontSize:".76rem",color:"#567C8D"}}>&#x1F4CD; {act.address}</div>}
        {act.transport&&<div style={{padding:"9px 12px",background:"#dceaf3",border:"1px solid #C8D9E6",borderRadius:8,fontSize:".76rem",color:"#2F4156"}}><b>Getting there:</b> {act.transport}</div>}
        {act.tip&&<div style={{padding:"9px 12px",background:"#fff",border:"1px solid #C8D9E6",borderRadius:8,fontSize:".76rem",color:"#567C8D"}}><b>Insider tip:</b> {act.tip}</div>}
      </div>}
    </div>
  );
}

// ── Story Activity Card (horizontal swipeable) ─────────────────────────────────
function StoryActCard({act,onRemove,onZoom}){
  const [imgOk,setImgOk]=useState(true);
  const [open,setOpen]=useState(false);
  const src=imgOk?actImg(act.imgQuery||act.name):null;
  const em=typeEmoji(act.type);
  const bookUrl="https://www.getyourguide.com/s/?q="+encodeURIComponent((act.name||"")+" "+(act.address||""));
  return(
    <div style={{flexShrink:0,width:200,borderRadius:16,overflow:"hidden",background:"#fff",boxShadow:"0 4px 20px rgba(47,65,86,.13)",border:"1px solid #C8D9E6",display:"flex",flexDirection:"column",scrollSnapAlign:"start"}}>
      <div style={{height:140,position:"relative",background:"#2C365A",flexShrink:0}}>
        {src&&<img src={src} alt={act.name} loading="lazy" onError={()=>setImgOk(false)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(20,30,50,.85) 0%,transparent 55%)"}}/>
        <button onClick={()=>onRemove(act._id||act.name)} style={{position:"absolute",top:8,right:8,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.3)",color:"#fff",fontSize:".85rem",display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
        <div style={{position:"absolute",bottom:8,left:10,right:10}}>
          <div style={{fontSize:".6rem",fontWeight:700,color:"rgba(255,255,255,.75)",marginBottom:2}}>{em} {act.type}</div>
          <div style={{fontSize:".9rem",fontWeight:800,color:"#fff",lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{act.name}</div>
        </div>
      </div>
      <div style={{padding:"10px 11px",flex:1,display:"flex",flexDirection:"column",gap:5}}>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{background:act.conflict?"#dc2626":"#2F4156",borderRadius:5,padding:"2px 7px",fontSize:".65rem",fontWeight:800,color:"#fff"}}>{act.time||"--:--"}</span>
          {act.duration&&<span style={{fontSize:".65rem",color:"#8A9CAA"}}>{act.duration}</span>}
          {act.conflict&&<span style={{fontSize:".6rem",color:"#dc2626",fontWeight:700}}>⚠</span>}
          {act.weatherWarning&&<span style={{fontSize:".6rem",color:"#567C8D",fontWeight:700}}>🌧</span>}
        </div>
        {act.desc&&<p style={{fontSize:".74rem",color:"#567C8D",lineHeight:1.45,margin:0,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{act.desc}</p>}
        {act.isFree?<span style={{fontSize:".68rem",fontWeight:700,color:"#567C8D"}}>Free</span>:<span style={{fontSize:".68rem",fontWeight:700,color:"#2F4156"}}>{act.price}</span>}
        <div style={{marginTop:"auto",display:"flex",gap:6,paddingTop:4}}>
          {!act.isFree&&<a href={bookUrl} target="_blank" rel="noreferrer" style={{flex:1,padding:"6px 0",textAlign:"center",background:"#dc2626",borderRadius:7,color:"#fff",fontSize:".7rem",fontWeight:700}}>Book</a>}
          <button onClick={()=>setOpen(x=>!x)} style={{flex:1,padding:"6px 0",background:"#EEE8DF",border:"none",borderRadius:7,color:"#2F4156",fontSize:".7rem",fontFamily:"inherit",fontWeight:600}}>{open?"Less":"Info"}</button>
          {onZoom&&<button onClick={onZoom} style={{padding:"6px 9px",background:"#dceaf3",border:"1px solid #C8D9E6",borderRadius:7,color:"#2F4156",fontSize:".7rem",fontFamily:"inherit"}}>🎯</button>}
          <a href={"https://www.google.com/maps/search/"+encodeURIComponent(act.name)} target="_blank" rel="noreferrer" style={{padding:"6px 9px",background:"#567C8D",borderRadius:7,color:"#fff",fontSize:".7rem"}}>Map</a>
        </div>
        {open&&<div style={{paddingTop:6,borderTop:"1px solid #EEE8DF",display:"flex",flexDirection:"column",gap:4}}>
          {act.address&&<div style={{fontSize:".68rem",color:"#8A9CAA"}}>&#x1F4CD; {act.address}</div>}
          {act.transport&&<div style={{fontSize:".68rem",color:"#567C8D"}}>Bus: {act.transport}</div>}
          {act.tip&&<div style={{fontSize:".68rem",color:"#567C8D"}}>Tip: {act.tip}</div>}
          {act.openHours&&<div style={{fontSize:".68rem",color:"#8A9CAA"}}>{act.openHours}</div>}
        </div>}
      </div>
    </div>
  );
}

// ── Dining Row (editorial menu-style) ─────────────────────────────────────────
function DiningRow({lunch,dinner}){
  const [lOk,setLOk]=useState(true);
  const [dOk,setDOk]=useState(true);
  function MealEntry({meal,src,onErr,side}){
    if(!meal) return null;
    const restUrl="https://www.google.com/search?q="+encodeURIComponent(meal.name+" reserve table");
    return(
      <div style={{flex:1,display:"flex",gap:10,alignItems:"center",padding:"11px 12px",background:"#fff",borderRadius:12,border:"1px solid #C8D9E6"}}>
        {src?<div style={{width:52,height:52,borderRadius:10,overflow:"hidden",flexShrink:0}}><img src={src} alt={meal.name} loading="lazy" onError={onErr} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>
          :<div style={{width:52,height:52,borderRadius:10,background:"#EEE8DF",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem"}}>{side==="lunch"?"☀️":"🌙"}</div>}
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:".58rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"#8A9CAA",marginBottom:1}}>{side}</div>
          <div style={{fontSize:".85rem",fontWeight:700,color:"#2C365A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{meal.name}</div>
          <div style={{fontSize:".7rem",color:"#567C8D",marginBottom:5}}>{meal.cuisine}{meal.price?" · "+meal.price:""}</div>
          <a href={restUrl} target="_blank" rel="noreferrer" style={{fontSize:".65rem",fontWeight:700,padding:"3px 9px",background:"#dc2626",borderRadius:5,color:"#fff"}}>Reserve</a>
        </div>
      </div>
    );
  }
  const lSrc=lOk&&lunch?actImg(lunch.imgQuery||lunch.name):null;
  const dSrc=dOk&&dinner?actImg(dinner.imgQuery||dinner.name):null;
  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{flex:1,height:1,background:"#C8D9E6"}}/>
        <span style={{fontSize:".65rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#8A9CAA",padding:"0 4px"}}>Today's Dining</span>
        <div style={{flex:1,height:1,background:"#C8D9E6"}}/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <MealEntry meal={lunch} src={lSrc} onErr={()=>setLOk(false)} side="lunch"/>
        <MealEntry meal={dinner} src={dSrc} onErr={()=>setDOk(false)} side="dinner"/>
      </div>
    </div>
  );
}

// ── Add Modal ──────────────────────────────────────────────────────────────────
function AddModal({onClose,onAdd,destination,placesQuery,setPlacesQuery,placesResults,placesLoading,onRunPlacesSearch,onAddPlace}){
  const [mode,setMode]=useState("ai");
  const [actType,setActType]=useState("");
  const [loading,setLoading]=useState(false);
  const [name,setName]=useState(""); const [addr,setAddr]=useState("");
  const [time,setTime]=useState("10:00"); const [price,setPrice]=useState(""); const [desc,setDesc]=useState("");
  async function genAI(){
    if(!actType.trim()) return; setLoading(true);
    try{
      const p=`One ${actType} activity in ${destination}. Reply ONLY JSON no markdown no apostrophes: {"name":"","type":"","desc":"","address":"","duration":"","price":"","isFree":false,"isHidden":false,"bookingUrl":"","tip":"","transport":"","imgQuery":"","time":"10:00","openHours":""}`;
      const a=await callAI(p,400); onAdd({_id:uid(),...a}); onClose();
    }catch(e){ alert("Could not generate: "+e.message); } finally{ setLoading(false); }
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:"18px 18px 0 0",padding:"20px 18px 32px",width:"100%",maxWidth:600,maxHeight:"88vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{fontSize:"1rem",fontWeight:800}}>Add Activity</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.4rem",color:"#8A9CAA"}}>×</button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["ai","AI Generate"],["places","📍 Search Places"],["manual","Manual"]].map(([id,l])=>(
            <button key={id} onClick={()=>setMode(id)} style={{flex:1,padding:"10px",borderRadius:9,fontFamily:"inherit",fontSize:".82rem",fontWeight:700,background:mode===id?"#2F4156":"#EEE8DF",border:"1.5px solid "+(mode===id?"#2F4156":"#C8D9E6"),color:mode===id?"#fff":"#2F4156",minHeight:44}}>{l}</button>
          ))}
        </div>
        {mode==="ai"&&<>
          <Lbl c="Type of activity"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>
            {["Museum","Restaurant","Bar","Park","Viewpoint","Market","Beach","Castle","Nightclub","Cafe"].map(t=><Chip key={t} label={t} on={actType===t} onClick={()=>setActType(actType===t?"":t)}/>)}
          </div>
          <TIn value={actType} onChange={e=>setActType(e.target.value)} placeholder="Or describe: rooftop bar…" style={{marginBottom:14}}/>
          <Btn full onClick={genAI} disabled={!actType.trim()||loading} color="#2F4156">
            {loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><Spin size={18}/> Generating…</span>:"Generate Activity"}
          </Btn>
        </>}
        {mode==="places"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
          <Lbl c="Search for a place"/>
          <div style={{display:"flex",gap:8}}>
            <input value={placesQuery} onChange={e=>setPlacesQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onRunPlacesSearch()} placeholder="cafe, museum, park…" style={{flex:1,padding:"12px 13px",background:"#EEE8DF",border:"1.5px solid #C8D9E6",borderRadius:9,color:"#2F4156",fontFamily:"inherit",fontSize:"16px"}}/>
            <button onClick={onRunPlacesSearch} disabled={placesLoading||!placesQuery.trim()} style={{padding:"12px 16px",borderRadius:9,background:"#2F4156",color:"#fff",border:"none",fontWeight:700,fontSize:".85rem",fontFamily:"inherit",minHeight:44,opacity:placesLoading||!placesQuery.trim()?.5:1}}>
              {placesLoading?<Spin size={16}/>:"Search"}
            </button>
          </div>
          {placesResults.length>0&&<div style={{display:"flex",flexDirection:"column",gap:9}}>
            {placesResults.map(p=>(
              <div key={p._id} style={{padding:"12px 14px",background:"#F5EFEB",border:"1px solid #C8D9E6",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontWeight:700,fontSize:".9rem",color:"#2F4156",marginBottom:2}}>{p.name}</div>
                  {p.address&&<div style={{fontSize:".72rem",color:"#8A9CAA",marginBottom:3}}>📍 {p.address}</div>}
                  <div style={{fontSize:".72rem",color:"#567C8D"}}>{p.desc}</div>
                  {p.openHours&&<div style={{fontSize:".68rem",color:"#8A9CAA",marginTop:3}}>🕐 {p.openHours.split("|")[0]}</div>}
                </div>
                <button onClick={()=>{onAddPlace(p);onClose();}} style={{flexShrink:0,padding:"8px 14px",borderRadius:9,background:"#567C8D",color:"#fff",border:"none",fontWeight:700,fontSize:".78rem",fontFamily:"inherit",minHeight:36}}>+ Add</button>
              </div>
            ))}
          </div>}
          {!placesLoading&&placesResults.length===0&&placesQuery&&<div style={{textAlign:"center",fontSize:".8rem",color:"#8A9CAA",padding:"16px 0"}}>No results yet — press Search</div>}
        </div>}
        {mode==="manual"&&<div style={{display:"flex",flexDirection:"column",gap:11}}>
          <div><Lbl c="Name *"/><TIn value={name} onChange={e=>setName(e.target.value)} placeholder="Eiffel Tower"/></div>
          <div><Lbl c="Type"/><TIn value={actType} onChange={e=>setActType(e.target.value)} placeholder="Museum, Bar…"/></div>
          <div><Lbl c="Address"/><TIn value={addr} onChange={e=>setAddr(e.target.value)}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><Lbl c="Time"/><TIn type="time" value={time} onChange={e=>setTime(e.target.value)}/></div>
            <div><Lbl c="Price"/><TIn value={price} onChange={e=>setPrice(e.target.value)} placeholder="Free / 15 EUR"/></div>
          </div>
          <div><Lbl c="Notes"/><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{width:"100%",padding:"12px",background:"#EEE8DF",border:"1.5px solid #C8D9E6",borderRadius:9,fontFamily:"inherit"}}/></div>
          <Btn full onClick={()=>{ if(!name.trim()) return; onAdd({_id:uid(),name,type:actType||"Custom",desc,address:addr,time,price:price||"Free",isFree:!price||price.toLowerCase()==="free",duration:"",transport:"",bookingUrl:"",tip:"",isHidden:false,imgQuery:name+" "+destination}); onClose(); }} disabled={!name.trim()} color="#2F4156">Add to Plan</Btn>
        </div>}
      </div>
    </div>
  );
}


// ── Export Modal ───────────────────────────────────────────────────────────────
function ExportModal({onClose,data,form,days}){
  const [copying,setCopying]=useState(false);
  async function handleCopy(){
    setCopying(true);
    try{ await navigator.clipboard.writeText(buildTripText(data,form,days)); alert("Copied to clipboard!"); }
    catch(_){ alert("Could not copy."); }
    finally{ setCopying(false); }
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:"18px 18px 0 0",padding:"20px 18px 32px",width:"100%",maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{fontSize:"1rem",fontWeight:800,color:"#2F4156"}}>Export Trip</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.4rem",color:"#8A9CAA"}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={()=>{ downloadTextFile(`${data.destination.replace(/\s+/g,"-")}-tripmind.txt`, buildTripText(data,form,days)); onClose(); }}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid #C8D9E6",background:"#F5EFEB",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <span style={{fontSize:"1.6rem"}}>📄</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"#2F4156"}}>Download .txt</div><div style={{fontSize:".73rem",color:"#8A9CAA",marginTop:2}}>Save your itinerary as a plain text file</div></div>
          </button>
          <button onClick={()=>{ exportTripAsPrintableHTML(data,form,days); onClose(); }}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid #C8D9E6",background:"#F5EFEB",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <span style={{fontSize:"1.6rem"}}>🖨️</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"#2F4156"}}>Print / Save as PDF</div><div style={{fontSize:".73rem",color:"#8A9CAA",marginTop:2}}>Opens a print-ready page in a new tab</div></div>
          </button>
          <button onClick={handleCopy} disabled={copying}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid #C8D9E6",background:"#F5EFEB",textAlign:"left",cursor:"pointer",fontFamily:"inherit",opacity:copying?.6:1}}>
            <span style={{fontSize:"1.6rem"}}>📋</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"#2F4156"}}>Copy as Text</div><div style={{fontSize:".73rem",color:"#8A9CAA",marginTop:2}}>Copy the full itinerary to clipboard</div></div>
          </button>
          <button onClick={async()=>{ try{ await shareTripText(data,form,days); onClose(); }catch(_){} }}
            style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:12,border:"1.5px solid #C8D9E6",background:"#F5EFEB",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
            <span style={{fontSize:"1.6rem"}}>📤</span>
            <div><div style={{fontWeight:700,fontSize:".9rem",color:"#2F4156"}}>Share via App</div><div style={{fontSize:".73rem",color:"#8A9CAA",marginTop:2}}>Use your phone's share sheet (iOS/Android)</div></div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── API Key Card (own component — required by Rules of Hooks) ──────────────────
function ApiKeyCard(){
  const [k,setK]=useState(()=>{try{return localStorage.getItem("tm_api_key")||"";}catch(_){return "";}});
  const save=(val)=>{setK(val);try{localStorage.setItem("tm_api_key",val);}catch(_){}};
  return(
    <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
      <div style={{fontWeight:800,fontSize:".88rem",marginBottom:6}}>🔑 Claude API Key</div>
      <div style={{fontSize:".72rem",color:"#8A9CAA",marginBottom:8}}>Required to generate trips. Get yours at console.anthropic.com</div>
      <input type="password" value={k} onChange={e=>save(e.target.value)} placeholder="sk-ant-…" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:`1.5px solid ${k?"#567C8D":"#C8D9E6"}`,fontSize:".78rem",background:"#EEE8DF",fontFamily:"inherit"}}/>
      {k&&<div style={{fontSize:".65rem",color:"#567C8D",marginTop:5}}>✓ Key saved — stored only in this browser</div>}
    </div>
  );
}

// ── Settings Card (Supabase sync only — API key lives on server, not here) ─────
function SbConfigCard(){
  const [open,setOpen]=useState(false);
  const [url,setUrl]=useState(()=>{ try{ return localStorage.getItem("tm_sb_url")||""; }catch(_){ return ""; } });
  const [sbKey,setSbKey]=useState(()=>{ try{ return localStorage.getItem("tm_sb_key")||""; }catch(_){ return ""; } });
  const [saved,setSaved]=useState(false);
  const connected=!!(url&&sbKey);
  function save(){
    try{
      localStorage.setItem("tm_sb_url",url.trim());
      localStorage.setItem("tm_sb_key",sbKey.trim());
    }catch(_){}
    setSaved(true);
    setTimeout(()=>setSaved(false),2500);
    setOpen(false);
  }
  function clear(){
    try{ localStorage.removeItem("tm_sb_url"); localStorage.removeItem("tm_sb_key"); }catch(_){}
    setUrl(""); setSbKey("");
  }
  return(
    <div style={{marginBottom:12,border:"1px solid #C8D9E6",borderRadius:14,overflow:"hidden",background:"#fff"}}>
      <button onClick={()=>setOpen(x=>!x)} style={{width:"100%",padding:"13px 16px",background:"none",border:"none",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontFamily:"inherit"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#567C8D",flexShrink:0}}/>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:".82rem",fontWeight:700,color:"#2F4156"}}>⚙️ Settings</div>
            <div style={{fontSize:".67rem",color:"#8A9CAA",marginTop:1}}>
              {connected?"Real-time sync active":"Optional: enable real-time sync with companions"}
            </div>
          </div>
        </div>
        <span style={{fontSize:".75rem",color:"#8A9CAA",transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
      </button>
      {open&&<div style={{padding:"0 16px 16px",borderTop:"1px solid #EEE8DF",display:"flex",flexDirection:"column",gap:10}}>
        <div style={{paddingTop:10}}>
          <div style={{fontSize:".7rem",fontWeight:700,color:"#2F4156",marginBottom:6}}>☁️ Real-time Sync (optional)</div>
          <div style={{fontSize:".72rem",color:"#567C8D",lineHeight:1.5,marginBottom:8}}>
            Create a free project at <b>supabase.com</b>, add a <code>trips</code> table with <code>id</code> (text), <code>days</code> (jsonb), <code>updated_at</code> (timestamp) to sync your plan with travel companions in real time.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #C8D9E6",fontSize:".78rem",background:"#EEE8DF",fontFamily:"inherit"}}/>
            <input value={sbKey} onChange={e=>setSbKey(e.target.value)} type="password" placeholder="Supabase anon key (eyJhb…)" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1.5px solid #C8D9E6",fontSize:".78rem",background:"#EEE8DF",fontFamily:"inherit"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={save} style={{flex:1,padding:"9px",borderRadius:9,background:"#2F4156",color:"#fff",border:"none",fontSize:".78rem",fontWeight:700,fontFamily:"inherit"}}>
            {saved?"✓ Saved!":"Save"}
          </button>
          {connected&&<button onClick={clear} style={{padding:"9px 13px",borderRadius:9,background:"#EEE8DF",color:"#8A9CAA",border:"1px solid #C8D9E6",fontSize:".78rem",fontFamily:"inherit"}}>Clear Sync</button>}
        </div>
      </div>}
    </div>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────────
function Setup({onGenerate,savedTrips,setSavedTrips,onLoadTrip}){
  const [form,setForm]=useState({destination:"",hotel:"",startDate:"",endDate:"",arrivalTime:"",departureTime:"",travelers:2,ageGroup:"26-40",style:"medium",transport:"mixed",interests:[],notes:""});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggleI=i=>set("interests",form.interests.includes(i)?form.interests.filter(x=>x!==i):[...form.interests,i]);
  const days=getDays(form.startDate,form.endDate);
  return(
    <div style={{minHeight:"100vh",background:"#F5EFEB",color:"#2C365A",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <style>{CSS}</style>
      <div style={{background:"linear-gradient(135deg,#2C365A,#2F4156)",padding:"32px 18px 26px",textAlign:"center"}}>
        <div style={{fontSize:".67rem",letterSpacing:".16em",textTransform:"uppercase",color:"rgba(255,255,255,.75)",fontWeight:600,marginBottom:10}}>AI-Powered Travel Planning</div>
        <h1 style={{fontSize:"clamp(2rem,6vw,2.8rem)",fontWeight:900,letterSpacing:"-.03em",color:"#fff",marginBottom:8}}>TripMind AI</h1>
        <p style={{color:"rgba(255,255,255,.82)",fontSize:".93rem",maxWidth:340,margin:"0 auto"}}>Smart itineraries for trips up to 3 weeks</p>
      </div>
      <div style={{maxWidth:600,margin:"0 auto",padding:"16px 14px 80px"}}>
        <Crd>
          <Lbl c="Destination *"/><TIn value={form.destination} onChange={e=>set("destination",e.target.value)} placeholder="Paris, Tokyo, Bali…"/>
          <div style={{height:13}}/>
          <Lbl c="Hotel / Accommodation"/>
          <TIn value={form.hotel} onChange={e=>set("hotel",e.target.value)} placeholder="Hotel name or area - used on map"/>
          <div style={{marginTop:8,fontSize:".74rem",color:"#8A9CAA"}}>Activities will be suggested within 30-40 min of your hotel.</div>
        </Crd>
        <Crd>
          <Lbl c="Travel Dates"/>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><div style={{fontSize:".74rem",color:"#8A9CAA",marginBottom:6}}>Arrival date</div><TIn type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)}/></div>
            <div><div style={{fontSize:".74rem",color:"#8A9CAA",marginBottom:6}}>Departure date</div><TIn type="date" value={form.endDate} onChange={e=>set("endDate",e.target.value)}/></div>
          </div>
          {days>0&&<div style={{marginTop:10,padding:"9px 13px",background:"#dceaf3",border:"1px solid #C8D9E6",borderRadius:9,fontSize:".84rem",color:"#2F4156",fontWeight:600}}>{days} day{days!==1?"s":""} · {fmtDate(form.startDate)} → {fmtDate(form.endDate)}{days>7?" (long trip - generated in weekly batches)":""}</div>}
        </Crd>
        <Crd>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <span style={{fontSize:"1.4rem"}}>✈️</span>
            <div>
              <div style={{fontWeight:700,fontSize:".9rem"}}>Flight Times</div>
              <div style={{fontSize:".75rem",color:"#567C8D",marginTop:2}}>Adjusts how many activities are planned on travel days</div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div><div style={{fontSize:".74rem",color:"#8A9CAA",marginBottom:6}}>🛬 Arrival time (local)</div><TIn type="time" value={form.arrivalTime} onChange={e=>set("arrivalTime",e.target.value)}/></div>
            <div><div style={{fontSize:".74rem",color:"#8A9CAA",marginBottom:6}}>🛫 Departure time (local)</div><TIn type="time" value={form.departureTime} onChange={e=>set("departureTime",e.target.value)}/></div>
          </div>
          {form.arrivalTime&&<div style={{marginTop:8,padding:"7px 11px",background:"#dceaf3",border:"1px solid #A8C3D3",borderRadius:8,fontSize:".78rem",color:"#567C8D"}}>Day 1: activities from {form.arrivalTime} onwards</div>}
          {form.departureTime&&<div style={{marginTop:6,padding:"7px 11px",background:"#EEE8DF",border:"1px solid #C8D9E6",borderRadius:8,fontSize:".78rem",color:"#5C7A8A"}}>Last day: activities end by {fmtTime((toMins(form.departureTime)||0)-120)}</div>}
        </Crd>
        <Crd>
          <Lbl c="Travelers"/>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:14}}>
            <button onClick={()=>set("travelers",Math.max(1,form.travelers-1))} style={{width:44,height:44,borderRadius:10,background:"#EEE8DF",border:"1px solid #C8D9E6",color:"#2F4156",fontSize:"1.3rem",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
            <span style={{fontSize:"1.5rem",fontWeight:900,color:"#2F4156",minWidth:32,textAlign:"center"}}>{form.travelers}</span>
            <button onClick={()=>set("travelers",Math.min(30,form.travelers+1))} style={{width:44,height:44,borderRadius:10,background:"#EEE8DF",border:"1px solid #C8D9E6",color:"#2F4156",fontSize:"1.3rem",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          </div>
          <Lbl c="Age Group"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{AGE_GROUPS.map(a=><Chip key={a} label={a} on={form.ageGroup===a} onClick={()=>set("ageGroup",a)}/>)}</div>
        </Crd>
        <Crd>
          <Lbl c="Travel Style"/>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {[{id:"budget",l:"🎒 Budget",s:"Hostels, street food, free sights"},{id:"medium",l:"🏨 Comfort",s:"Mid-range hotels, mix of dining"},{id:"luxury",l:"✨ Luxury",s:"5-star hotels, fine dining, VIP"}].map(x=>(
              <button key={x.id} onClick={()=>set("style",x.id)} style={{padding:"13px 15px",borderRadius:11,fontFamily:"inherit",textAlign:"left",background:form.style===x.id?"#dceaf3":"#F5EFEB",border:"1.5px solid "+(form.style===x.id?"#2F4156":"#C8D9E6"),minHeight:54}}>
                <div style={{fontSize:".9rem",fontWeight:700,color:form.style===x.id?"#2F4156":"#2C365A"}}>{x.l}</div>
                <div style={{fontSize:".75rem",color:"#567C8D",marginTop:2}}>{x.s}</div>
              </button>
            ))}
          </div>
        </Crd>
        <Crd>
          <Lbl c="Transport"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {[{id:"public",l:"🚌 Public"},{id:"car",l:"🚗 Car"},{id:"walking",l:"🚶 Walk"},{id:"mixed",l:"🔀 Mixed"}].map(t=><Chip key={t.id} label={t.l} on={form.transport===t.id} onClick={()=>set("transport",t.id)}/>)}
          </div>
        </Crd>
        <Crd>
          <Lbl c="Interests"/>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{INTERESTS.map(i=><Chip key={i} label={i} on={form.interests.includes(i)} onClick={()=>toggleI(i)}/>)}</div>
        </Crd>
        <Crd>
          <Lbl c="Notes"/>
          <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3} placeholder="Dietary needs, must-see places…" style={{width:"100%",padding:"12px",background:"#EEE8DF",border:"1.5px solid #C8D9E6",borderRadius:10,fontFamily:"inherit"}}/>
        </Crd>
        <Btn full onClick={()=>form.destination.trim()&&onGenerate(form)} disabled={!form.destination.trim()} color="#2F4156">
          {form.destination.trim()?"✈️ Itinerary generieren":"Ziel eingeben um zu starten"}
        </Btn>
      </div>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────
function Loading({msg,pct}){
  // Parse "Days ready: X / Y" for the grid if present
  const gridMatch=msg&&msg.match(/Days ready:\s*(\d+)\s*\/\s*(\d+)/);
  const doneDays=gridMatch?parseInt(gridMatch[1]):null;
  const totalDaysLoading=gridMatch?parseInt(gridMatch[2]):null;
  return(
    <div style={{minHeight:"100vh",background:"#2C365A",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",gap:20,padding:28}}>
      <style>{CSS}</style>
      <div style={{fontSize:"3.2rem",animation:"pulse 2s infinite"}}>✈️</div>
      <div style={{fontSize:"1.25rem",fontWeight:900,textAlign:"center",color:"#fff",letterSpacing:"-.01em"}}>Building Your Trip</div>
      <div style={{fontSize:".84rem",color:"#C8D9E6",maxWidth:300,textAlign:"center",lineHeight:1.6,minHeight:38}}>{msg}</div>
      {/* Progress bar */}
      <div style={{width:"100%",maxWidth:300}}>
        <div style={{background:"rgba(200,217,230,.2)",borderRadius:50,height:6,overflow:"hidden"}}>
          <div style={{height:"100%",background:"#C8D9E6",borderRadius:50,width:pct+"%",transition:"width .35s ease"}}/>
        </div>
        <div style={{textAlign:"center",fontSize:".72rem",color:"#8A9CAA",marginTop:5}}>{Math.round(pct)}%</div>
      </div>
      {/* Per-day grid — shows once parallel generation starts */}
      {totalDaysLoading&&<div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",maxWidth:320}}>
        {Array.from({length:totalDaysLoading},(_,i)=>{
          const done=i<doneDays;
          return(
            <div key={i} style={{width:36,height:36,borderRadius:10,background:done?"#567C8D":"rgba(200,217,230,.12)",border:"1.5px solid "+(done?"#C8D9E6":"rgba(200,217,230,.2)"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:".65rem",fontWeight:700,color:done?"#fff":"rgba(200,217,230,.35)",transition:"all .3s"}}>
              {done?"✓":"D"+(i+1)}
            </div>
          );
        })}
      </div>}
      {!totalDaysLoading&&<Spin size={26}/>}
    </div>
  );
}


// ── Dynamic Trip Engine (inlined) ─────────────────────────────────────────────
function optimizeDayPlan(day,form,totalDays){
  const dayStart=getDayStart(day,form);
  const dayEnd=getDayEnd(day,form,totalDays);
  const normalized=(day.activities||[]).map(normalizeActivity);
  const prioritized=prioritizeActivities(normalized,day.weatherForecast,dayStart,dayEnd);
  const timed=assignTimes(prioritized,dayStart,dayEnd);
  return{
    ...day,
    activities:timed.map(({_engine,...rest})=>rest),
    engineMeta:{optimizedAt:new Date().toISOString(),weatherMode:weatherLooksRainy(day.weatherForecast)?"rain-adjusted":"normal",dayStart:fmtTime(dayStart),dayEnd:fmtTime(dayEnd)}
  };
}
function optimizeWholeTrip(days,form){
  return (days||[]).map(day=>optimizeDayPlan(day,form,days.length));
}
function replaceOutdoorForRain(day,indoorFallbacks=[]){
  if(!weatherLooksRainy(day?.weatherForecast)) return day;
  let fi=0;
  return{...day,activities:(day.activities||[]).map(act=>{
    if(!isOutdoorActivity(act)||act.locked) return act;
    const rep=indoorFallbacks[fi++];
    if(!rep) return{...act,weatherWarning:"Outdoor activity on rainy day"};
    return{...rep,_id:act._id,replacedOriginal:act.name,weatherReplacement:true};
  })};
}
function markActivityLocked(day,activityId,locked=true){
  return{...day,activities:(day.activities||[]).map(a=>(a._id||a.name)===activityId?{...a,locked}:a)};
}


// ── Group Planning Engine v2 (inlined — uid() from global scope, no exports) ───
function safeName(name){ return String(name||"").trim(); }
function scoreVotes(votes={}){ return Object.values(votes).reduce((sum,v)=>sum+Number(v||0),0); }
function voterStats(votes={}){ const arr=Object.values(votes); return{up:arr.filter(v=>Number(v)===1).length,down:arr.filter(v=>Number(v)===-1).length,score:scoreVotes(votes)}; }

function createInitialGroupState(initialMembers=[]){
  return{
    members:initialMembers.length>0
      ?initialMembers.map(m=>({id:m.id||uid(),name:safeName(m.name)||"Traveler",role:m.role||"member"}))
      :[{id:"u1",name:"Laura",role:"owner"}],
    suggestionsByDay:{},
    commentsBySuggestionId:{},
    activityVotesByDay:{}
  };
}
function addGroupMember(state,memberName,role="member"){
  const name=safeName(memberName); if(!name) return state;
  const exists=state.members.some(m=>m.name.toLowerCase()===name.toLowerCase());
  if(exists) return state;
  return{...state,members:[...state.members,{id:uid(),name,role}]};
}
function removeGroupMember(state,memberId){
  return{...state,members:state.members.filter(m=>m.id!==memberId)};
}
function createSuggestion({dayNumber,createdBy,title,type,notes,activityData}){
  return{id:uid(),dayNumber,createdBy,title:safeName(title)||"Suggestion",type:safeName(type)||"Activity",notes:String(notes||"").trim(),status:"pending",votes:{},createdAt:new Date().toISOString(),activityData:activityData||null};
}
function addSuggestion(state,payload){
  const suggestion=createSuggestion(payload);
  const dayKey=String(payload.dayNumber);
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:[...(state.suggestionsByDay[dayKey]||[]),suggestion]}};
}
function updateSuggestionVote(state,dayNumber,suggestionId,memberId,value){
  const dayKey=String(dayNumber); const normalized=value===-1?-1:1;
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>s.id!==suggestionId?s:{...s,votes:{...s.votes,[memberId]:normalized}})}};
}
function clearSuggestionVote(state,dayNumber,suggestionId,memberId){
  const dayKey=String(dayNumber);
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>{
    if(s.id!==suggestionId) return s;
    const nv={...s.votes}; delete nv[memberId]; return{...s,votes:nv};
  })}};
}
function setSuggestionStatus(state,dayNumber,suggestionId,status){
  const dayKey=String(dayNumber);
  const nextStatus=["approved","rejected","pending"].includes(status)?status:"pending";
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>s.id!==suggestionId?s:{...s,status:nextStatus})}};
}
function deleteSuggestion(state,dayNumber,suggestionId){
  const dayKey=String(dayNumber);
  const nextComments={...state.commentsBySuggestionId}; delete nextComments[suggestionId];
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).filter(s=>s.id!==suggestionId)},commentsBySuggestionId:nextComments};
}
function addSuggestionComment(state,suggestionId,memberId,text){
  const clean=String(text||"").trim(); if(!clean) return state;
  return{...state,commentsBySuggestionId:{...state.commentsBySuggestionId,[suggestionId]:[...(state.commentsBySuggestionId[suggestionId]||[]),{id:uid(),memberId,text:clean,createdAt:new Date().toISOString()}]}};
}
function voteOnExistingActivity(state,dayNumber,activityId,memberId,value){
  const dayKey=String(dayNumber); const normalized=value===-1?-1:1;
  return{...state,activityVotesByDay:{...state.activityVotesByDay,[dayKey]:{...(state.activityVotesByDay[dayKey]||{}),[activityId]:{...((state.activityVotesByDay[dayKey]||{})[activityId]||{}),[memberId]:normalized}}}};
}
function getSuggestionsForDay(state,dayNumber){
  const dayKey=String(dayNumber);
  return [...(state.suggestionsByDay[dayKey]||[])].sort((a,b)=>{
    const sr={approved:3,pending:2,rejected:1};
    if(sr[b.status]!==sr[a.status]) return sr[b.status]-sr[a.status];
    const as=voterStats(a.votes).score, bs=voterStats(b.votes).score;
    if(bs!==as) return bs-as;
    return new Date(a.createdAt)-new Date(b.createdAt);
  });
}
function getApprovedSuggestionsForDay(state,dayNumber){
  return getSuggestionsForDay(state,dayNumber).filter(s=>s.status==="approved");
}
function getTopSuggestedActivities(state,dayNumber,minScore=1){
  return getSuggestionsForDay(state,dayNumber).filter(s=>voterStats(s.votes).score>=minScore);
}
function mergeApprovedSuggestionsIntoActivities(day,state){
  const approved=getApprovedSuggestionsForDay(state,day.day).filter(s=>s.activityData).map(s=>({_id:s.id,...s.activityData,groupApproved:true,groupSuggestionTitle:s.title}));
  if(!approved.length) return day;
  return{...day,activities:[...(day.activities||[]),...approved]};
}
function autoApproveTopSuggestions(state,dayNumber,threshold=2){
  const dayKey=String(dayNumber);
  return{...state,suggestionsByDay:{...state.suggestionsByDay,[dayKey]:(state.suggestionsByDay[dayKey]||[]).map(s=>{
    const stats=voterStats(s.votes);
    return stats.score>=threshold&&s.status==="pending"?{...s,status:"approved"}:s;
  })}};
}
function buildSuggestionActivityData({title,type,notes,destination}){
  return{name:title,type:type||"Activity",desc:notes||"",duration:"1h 30m",time:"18:00",price:"Free",isFree:true,address:"",transport:"",tip:"",imgQuery:(title+" "+(destination||"")).trim()};
}
function getMemberName(state,memberId){
  return (state.members.find(m=>m.id===memberId)||{}).name||"Unknown";
}
function getActivityVoteScore(state,dayNumber,activityId){
  const dayVotes=(state.activityVotesByDay[String(dayNumber)]||{});
  return scoreVotes(dayVotes[activityId]||{});
}


// ── Supabase config (user-configurable via localStorage) ──────────────────────
// Set SUPABASE_URL + SUPABASE_KEY in localStorage under "tm_sb_url" / "tm_sb_key"
// to enable real-time sync. App works fully offline without these.
function getSbConfig(){
  try{
    return{
      url:localStorage.getItem("tm_sb_url")||"",
      key:localStorage.getItem("tm_sb_key")||""
    };
  }catch(_){ return{url:"",key:""}; }
}
function sbHeaders(key){ return{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"return=minimal"}; }

// ── useTripSync: optimistic local + cloud sync + real-time subscription ───────
function useTripSync(tripId,initialDays){
  const [days,setDays]=useState(initialDays);
  const [syncStatus,setSyncStatus]=useState("idle"); // idle|syncing|synced|error|offline
  const [syncError,setSyncError]=useState("");
  const realtimeRef=useRef(null);
  const {url:sbUrl,key:sbKey}=getSbConfig();
  const cloudEnabled=!!(sbUrl&&sbKey&&tripId);

  // ── push full days array to Supabase ──────────────────────────────────────
  async function pushToCloud(newDays){
    if(!cloudEnabled){setSyncStatus("offline");return;}
    setSyncStatus("syncing");
    try{
      const res=await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}`,{
        method:"PATCH",
        headers:sbHeaders(sbKey),
        body:JSON.stringify({days:newDays,updated_at:new Date().toISOString()})
      });
      if(!res.ok) throw new Error("HTTP "+res.status);
      setSyncStatus("synced");
      setTimeout(()=>setSyncStatus("idle"),2500);
    }catch(e){
      setSyncStatus("error");
      setSyncError(e.message);
      setTimeout(()=>setSyncStatus("idle"),5000);
    }
  }

  // ── subscribe to real-time changes from Supabase Realtime ────────────────
  useEffect(()=>{
    if(!cloudEnabled) return;
    // Use Supabase Realtime v2 REST-based long-poll (no WS library needed)
    let active=true;
    let etag="";
    async function poll(){
      try{
        const res=await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=days,updated_at`,{
          headers:{...sbHeaders(sbKey),"If-None-Match":etag}
        });
        if(res.status===304){/* no change */}
        else if(res.ok){
          etag=res.headers.get("etag")||"";
          const rows=await res.json();
          if(rows[0]?.days){
            setDays(rows[0].days.map(d=>({...d,activities:(d.activities||[]).map(a=>({_id:a._id||uid(),...a}))})));
          }
        }
      }catch(_){}
      if(active) realtimeRef.current=setTimeout(poll,8000); // poll every 8s
    }
    realtimeRef.current=setTimeout(poll,3000); // first poll after 3s
    return()=>{ active=false; clearTimeout(realtimeRef.current); };
  },[cloudEnabled,tripId]);

  // ── wrapped mutators: optimistic update → push → rollback on fail ─────────
  function mutate(updaterFn){
    setDays(prev=>{
      const next=updaterFn(prev);
      pushToCloud(next).catch(()=>{});
      return next;
    });
  }

  function addActivity(dayIdx,act){
    mutate(prev=>prev.map((d,i)=>i!==dayIdx?d:{...d,activities:[...d.activities,act]}));
  }
  function removeActivity(dayIdx,actId){
    mutate(prev=>prev.map((d,i)=>i!==dayIdx?d:{...d,activities:d.activities.filter(a=>(a._id||a.name)!==actId)}));
  }
  function reorderActivities(dayIdx,fromIdx,toIdx){
    if(fromIdx===toIdx) return;
    mutate(prev=>prev.map((d,i)=>{
      if(i!==dayIdx) return d;
      const arr=[...d.activities];
      const [moved]=arr.splice(fromIdx,1);
      arr.splice(toIdx,0,moved);
      return{...d,activities:arr};
    }));
  }
  function replaceDays(updaterFn){ mutate(updaterFn); }

  // local-only setter — no cloud push, used for ephemeral realtime annotations
  function setDaysLocal(updaterFn){ setDays(updaterFn); }
  return{days,setDays:mutate,setDaysLocal,addActivity,removeActivity,reorderActivities,replaceDays,syncStatus,syncError,cloudEnabled};
}

// ── Realtime Update Engine (inlined — no exports) ─────────────────────────────
function getNowMinutes(date=new Date()){ return date.getHours()*60+date.getMinutes(); }
function withComputedTiming(act){ const start=toMins(act.time),duration=parseDurationToMinutes(act.duration),end=start!=null?start+duration:null; return{...act,_rt:{start,end,duration}}; }
function getActivityStatus(act,nowMins){
  const start=act?._rt?.start,end=act?._rt?.end;
  if(start==null||end==null) return"unscheduled";
  if(nowMins<start-20) return"upcoming";
  if(nowMins>=start-20&&nowMins<start) return"soon";
  if(nowMins>=start&&nowMins<=end) return"live";
  if(nowMins>end&&nowMins<=end+30) return"just_finished";
  if(nowMins>end+30) return"missed_or_done";
  return"upcoming";
}
function buildActivityLiveMeta(act,nowMins,weatherForecast){
  const status=getActivityStatus(act,nowMins);
  const rainy=weatherLooksRainy(weatherForecast),outdoor=isOutdoorActivity(act);
  let warning="";
  if(rainy&&outdoor&&(status==="soon"||status==="upcoming"||status==="live")) warning="Rain may affect this outdoor activity.";
  let urgency="low";
  if(status==="soon") urgency="medium";
  if(status==="live") urgency="high";
  if(warning) urgency="high";
  return{...act,liveStatus:status,liveWarning:warning,liveUrgency:urgency};
}
function buildGlobalTripStatus(activities,nowMins){
  const live=activities.find(a=>a.liveStatus==="live");
  if(live) return{mode:"in_progress",title:"Current activity in progress",text:`${live.name} is currently happening.`,currentActivityId:live._id||live.name};
  const soon=activities.find(a=>a.liveStatus==="soon");
  if(soon){ const minsLeft=Math.max((soon._rt?.start??nowMins)-nowMins,0); return{mode:"starting_soon",title:"Next activity starts soon",text:`${soon.name} starts in about ${minsLeft} min.`,currentActivityId:soon._id||soon.name}; }
  const next=activities.find(a=>a.liveStatus==="upcoming");
  if(next) return{mode:"waiting",title:"Next planned stop",text:`${next.name} is your next planned activity.`,currentActivityId:next._id||next.name};
  return{mode:"free_time",title:"No active stop right now",text:"You currently have free time in the itinerary.",currentActivityId:null};
}
function buildRealtimeSuggestions(activities,nowMins,weatherForecast){
  const suggestions=[],rainy=weatherLooksRainy(weatherForecast);
  const live=activities.find(a=>a.liveStatus==="live"),soon=activities.find(a=>a.liveStatus==="soon"),upcoming=activities.find(a=>a.liveStatus==="upcoming"),missed=activities.filter(a=>a.liveStatus==="missed_or_done");
  if(live) suggestions.push({id:"focus-live",label:`Continue ${live.name}`,type:"status",text:"This is your current active stop."});
  if(soon) suggestions.push({id:"prep-next",label:`Prepare for ${soon.name}`,type:"next_step",text:"This stop begins soon."});
  if(rainy){ const affected=activities.find(a=>isOutdoorActivity(a)&&(a.liveStatus==="soon"||a.liveStatus==="upcoming")); if(affected) suggestions.push({id:"rain-swap",label:`Rain backup for ${affected.name}`,type:"weather",text:"Consider replacing this outdoor stop with an indoor option."}); }
  if(!live&&!soon&&upcoming) suggestions.push({id:"fill-gap",label:"Use free time smartly",type:"gap",text:"You currently have time before the next activity."});
  if(missed.length>=2) suggestions.push({id:"reoptimize",label:"Re-optimize day",type:"route",text:"The timeline looks out of sync. Re-optimization is recommended."});
  if(!suggestions.length) suggestions.push({id:"all-good",label:"Everything looks on track",type:"status",text:"No urgent itinerary adjustments needed."});
  return suggestions.slice(0,4);
}
function buildRealtimeDayState(day,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  const acts=(day?.activities||[]).map(withComputedTiming);
  const enriched=acts.map(a=>buildActivityLiveMeta(a,nowMins,day?.weatherForecast||""));
  return{nowMins,nowTime:fmtTime(nowMins),tripStatus:buildGlobalTripStatus(enriched,nowMins),activities:enriched.map(({_rt,...rest})=>rest),realtimeSuggestions:buildRealtimeSuggestions(enriched,nowMins,day?.weatherForecast||"")};
}
function applyRealtimeDayState(day,realtimeState){
  const activityMap=new Map((realtimeState.activities||[]).map(a=>[a._id||a.name,a]));
  return{...day,activities:(day.activities||[]).map(a=>activityMap.get(a._id||a.name)||a),realtime:{nowTime:realtimeState.nowTime,tripStatus:realtimeState.tripStatus,realtimeSuggestions:realtimeState.realtimeSuggestions,updatedAt:new Date().toISOString()}};
}
function updateDayInRealtime(day,nowDate=new Date()){ return applyRealtimeDayState(day,buildRealtimeDayState(day,nowDate)); }
function updateTripInRealtime(days,nowDate=new Date()){ return(days||[]).map(day=>updateDayInRealtime(day,nowDate)); }
function shouldSuggestAutoReoptimize(day){ return(day?.realtime?.realtimeSuggestions||[]).some(s=>s.id==="reoptimize"); }
function buildRealtimeBanner(day){
  const status=day?.realtime?.tripStatus;
  if(!status) return{title:"Live trip status unavailable",text:"No realtime status yet."};
  return{title:status.title||"Live update",text:status.text||""};
}

// ── useRealtimeTripUpdates hook ────────────────────────────────────────────────
function useRealtimeTripUpdates({enabled,intervalMs=60000,setDays}){
  const timerRef=useRef(null);
  useEffect(()=>{
    if(!enabled) return;
    function tick(){ setDays(prev=>updateTripInRealtime(prev,new Date())); }
    tick();
    timerRef.current=setInterval(tick,intervalMs);
    return()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[enabled,intervalMs]);
}

// ── RealtimeStatusPanel component ─────────────────────────────────────────────
function RealtimeStatusPanel({day,onReoptimize,onRefreshNow,realtimeEnabled,onToggleRealtime}){
  const banner=buildRealtimeBanner(day);
  const realtimeSuggestions=day?.realtime?.realtimeSuggestions||[];
  const nowTime=day?.realtime?.nowTime||"";
  return(
    <div className="fu" style={{display:"grid",gap:14}}>
      {/* Toggle + status */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
          <button onClick={onToggleRealtime} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #C8D9E6",background:realtimeEnabled?"#2F4156":"#fff",color:realtimeEnabled?"#fff":"#2F4156",fontWeight:700,fontFamily:"inherit"}}>
            {realtimeEnabled?"🟢 Realtime On":"⭕ Realtime Off"}
          </button>
          <span style={{fontSize:".8rem",color:"#567C8D"}}>Updates every minute · Now {nowTime||"—"}</span>
        </div>
        <div style={{fontWeight:800,marginBottom:6}}>{banner.title}</div>
        <div style={{fontSize:".82rem",color:"#567C8D",marginBottom:10}}>{banner.text}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onRefreshNow} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>⟳ Refresh now</button>
          <button onClick={onReoptimize} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>🔀 Re-optimize day</button>
        </div>
      </div>
      {/* Realtime suggestions */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Live suggestions</div>
        <div style={{display:"grid",gap:10}}>
          {realtimeSuggestions.map(s=>(
            <div key={s.id} style={{border:"1px solid #EEE8DF",borderRadius:12,padding:12,background:s.type==="weather"?"#fef9ec":s.type==="route"?"#fef2f2":"#F9F7F5",borderLeft:"3px solid "+(s.type==="weather"?"#b45309":s.type==="route"?"#dc2626":s.type==="next_step"?"#567C8D":"#C8D9E6")}}>
              <div style={{fontWeight:700,fontSize:".88rem"}}>{s.label}</div>
              <div style={{fontSize:".78rem",color:"#567C8D",marginTop:4}}>{s.text}</div>
            </div>
          ))}
          {!realtimeSuggestions.length&&<div style={{color:"#567C8D",fontSize:".82rem"}}>No live suggestions right now.</div>}
        </div>
      </div>
      {/* Live timeline */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Today's live timeline</div>
        <div style={{display:"grid",gap:8}}>
          {(day?.activities||[]).map(a=>{
            const isLive=a.liveStatus==="live",isSoon=a.liveStatus==="soon",isDone=a.liveStatus==="missed_or_done"||a.liveStatus==="just_finished";
            return(
              <div key={a._id||a.name} style={{padding:"10px 12px",borderRadius:10,background:isLive?"#dceaf3":isSoon?"#fef9ec":"#F9F7F5",border:"1.5px solid "+(isLive?"#567C8D":isSoon?"#d97706":"#EEE8DF"),opacity:isDone?.55:1}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:".86rem"}}>{typeEmoji(a.type)} {a.name}</div>
                    <div style={{fontSize:".73rem",color:"#567C8D",marginTop:2}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
                  </div>
                  <span style={{padding:"3px 9px",borderRadius:999,background:"#fff",border:"1px solid #C8D9E6",fontSize:".68rem",fontWeight:700,height:"fit-content",whiteSpace:"nowrap",color:isLive?"#2F4156":isSoon?"#d97706":isDone?"#8A9CAA":"#567C8D"}}>
                    {isLive?"● Live":isSoon?"⏱ Soon":isDone?"✓ Done":a.liveStatus==="upcoming"?"○ Upcoming":"○ Unscheduled"}
                  </span>
                </div>
                {a.liveWarning&&<div style={{marginTop:7,fontSize:".76rem",color:"#b45309",background:"#fef9ec",padding:"5px 8px",borderRadius:6}}>⚠ {a.liveWarning}</div>}
              </div>
            );
          })}
          {!(day?.activities||[]).length&&<div style={{color:"#8A9CAA",fontSize:".82rem",textAlign:"center",padding:"16px 0"}}>No activities for this day yet.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Live Trip Control Engine (inlined — toMins/fmtTime/parseDurationToMinutes/getNowMinutes/haversineKm/estimateTravelMinutes reuse globals) ──
function enrichActivityTiming(act){ const start=toMins(act.time),duration=parseDurationToMinutes(act.duration),end=start!=null?start+duration:null; return{...act,_live:{start,end,duration}}; }
function getStatus(act,nowMins){
  const start=act?._live?.start,end=act?._live?.end;
  if(start==null||end==null) return"unscheduled";
  if(nowMins<start-20) return"upcoming";
  if(nowMins>=start-20&&nowMins<start) return"soon";
  if(nowMins>=start&&nowMins<=end) return"live";
  if(nowMins>end&&nowMins<=end+30) return"just_finished";
  if(nowMins>end+30) return"past";
  return"upcoming";
}
function getNextPlannedActivity(day,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  const acts=(day?.activities||[]).map(enrichActivityTiming).map(a=>({...a,liveStatus:getStatus(a,nowMins)}));
  return acts.find(a=>a.liveStatus==="live")||acts.find(a=>a.liveStatus==="soon")||acts.find(a=>a.liveStatus==="upcoming")||null;
}
function getDistanceToNextStop(day,userLoc,transport="mixed",nowDate=new Date()){
  const next=getNextPlannedActivity(day,nowDate);
  if(!next||!userLoc||next.lat==null||next.lng==null) return{nextActivity:next||null,km:null,etaMinutes:null,canEstimate:false};
  const km=haversineKm({lat:userLoc.lat,lng:userLoc.lng},{lat:next.lat,lng:next.lng});
  const etaMinutes=estimateTravelMinutes(km,transport);
  return{nextActivity:next,km:km!=null?Number(km.toFixed(2)):null,etaMinutes,canEstimate:km!=null&&etaMinutes!=null};
}
function detectLateRisk(day,userLoc,transport="mixed",nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate),dist=getDistanceToNextStop(day,userLoc,transport,nowDate),next=dist.nextActivity;
  if(!next||!dist.canEstimate) return{isLateRisk:false,level:"unknown",text:"Not enough data to estimate lateness.",nextActivity:next||null};
  const start=toMins(next.time);
  if(start==null) return{isLateRisk:false,level:"unknown",text:"Next activity has no valid start time.",nextActivity:next};
  const margin=start-(nowMins+dist.etaMinutes);
  if(margin>=20) return{isLateRisk:false,level:"safe",text:`You should arrive about ${margin} min early for ${next.name}.`,nextActivity:next,etaMinutes:dist.etaMinutes,km:dist.km,minutesEarly:margin};
  if(margin>=0) return{isLateRisk:true,level:"tight",text:`Timing is tight for ${next.name}. You may arrive just in time.`,nextActivity:next,etaMinutes:dist.etaMinutes,km:dist.km,minutesEarly:margin};
  return{isLateRisk:true,level:"late",text:`You are likely to be late for ${next.name} by about ${Math.abs(margin)} min.`,nextActivity:next,etaMinutes:dist.etaMinutes,km:dist.km,minutesLate:Math.abs(margin)};
}
function delayRemainingActivities(day,delayMinutes,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  return{...day,activities:(day.activities||[]).map(act=>{const start=toMins(act.time);return start!=null&&start>=nowMins?{...act,time:fmtTime(start+delayMinutes)}:act;}),liveAdjustment:{type:"delay",delayMinutes,updatedAt:new Date().toISOString()}};
}
function skipActivity(day,activityId){
  return{...day,activities:(day.activities||[]).filter(a=>(a._id||a.name)!==activityId),liveAdjustment:{type:"skip",skippedActivityId:activityId,updatedAt:new Date().toISOString()}};
}
function rebuildRestOfDay(day,nowDate=new Date()){
  const nowMins=getNowMinutes(nowDate);
  const past=[],future=[];
  for(const act of(day.activities||[])){ const start=toMins(act.time),end=start!=null?start+parseDurationToMinutes(act.duration):null; (end!=null&&end<nowMins?past:future).push(act); }
  let cursor=nowMins+15;
  const rebuiltFuture=future.map(act=>{const duration=parseDurationToMinutes(act.duration),next={...act,time:fmtTime(cursor)};cursor+=duration+20;return next;});
  return{...day,activities:[...past,...rebuiltFuture],liveAdjustment:{type:"rebuild_rest_of_day",updatedAt:new Date().toISOString()}};
}
function getRealtimeControlActions(day,userLoc,transport="mixed",nowDate=new Date()){
  const lateRisk=detectLateRisk(day,userLoc,transport,nowDate),next=lateRisk.nextActivity,actions=[];
  if(!next) return{lateRisk,actions:[{id:"no-next-stop",label:"No next stop detected",type:"info"}]};
  if(lateRisk.level==="tight") actions.push({id:"delay-15",label:"Delay next stops by 15 min",type:"delay",minutes:15},{id:"rebuild",label:"Rebuild rest of day",type:"rebuild"});
  if(lateRisk.level==="late") actions.push({id:"skip-next",label:`Skip ${next.name}`,type:"skip",activityId:next._id||next.name},{id:"delay-30",label:"Delay next stops by 30 min",type:"delay",minutes:30},{id:"rebuild",label:"Rebuild rest of day",type:"rebuild"});
  if(lateRisk.level==="safe") actions.push({id:"all-good",label:"Timing looks good",type:"info"});
  return{lateRisk,actions};
}

// ── LiveTripControlPanel component ────────────────────────────────────────────
function LiveTripControlPanel({day,lateRisk,controlActions,onDelay,onSkipNext,onRebuild,onRefresh}){
  const next=lateRisk?.nextActivity||null;
  const lvl=lateRisk?.level;
  return(
    <div style={{display:"grid",gap:14}}>
      {/* Status card */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:8}}>🗺 Live trip control</div>
        <div style={{padding:"10px 12px",borderRadius:10,background:lvl==="late"?"#fef2f2":lvl==="tight"?"#fff7ed":"#F9F7F5",color:"#2F4156",marginBottom:12,fontSize:".84rem",lineHeight:1.5}}>
          {lateRisk?.text||"No live timing info available."}
        </div>
        {next&&<div style={{border:"1px solid #EEE8DF",borderRadius:10,padding:12,background:"#F9F7F5",marginBottom:12}}>
          <div style={{fontWeight:700}}>{typeEmoji(next.type)} {next.name}</div>
          <div style={{fontSize:".78rem",color:"#567C8D",marginTop:3}}>{next.time||"--:--"} · {next.type||"Activity"}</div>
          {(lateRisk?.km!=null||lateRisk?.etaMinutes!=null)&&<div style={{fontSize:".78rem",color:"#567C8D",marginTop:5}}>
            {lateRisk.km!=null?`${lateRisk.km} km`:""}{lateRisk.km!=null&&lateRisk.etaMinutes!=null?" · ":""}{lateRisk.etaMinutes!=null?`${lateRisk.etaMinutes} min away`:""}
          </div>}
        </div>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onRefresh} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>⟳ Refresh</button>
          <button onClick={()=>onDelay(15)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>+15 min</button>
          <button onClick={()=>onDelay(30)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>+30 min</button>
          <button onClick={()=>onDelay(60)} style={{padding:"9px 12px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>+60 min</button>
          {next&&<button onClick={onSkipNext} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#b91c1c",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>⏭ Skip next stop</button>}
          <button onClick={onRebuild} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>🔀 Rebuild rest of day</button>
        </div>
      </div>
      {/* Suggested actions */}
      {(controlActions||[]).length>0&&<div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Suggested actions</div>
        <div style={{display:"grid",gap:8}}>
          {(controlActions||[]).map(a=>(
            <div key={a.id} style={{padding:"10px 12px",borderRadius:10,background:a.type==="info"?"#F9F7F5":a.type==="skip"?"#fef2f2":a.type==="rebuild"?"#dceaf3":"#fff7ed",border:"1px solid #EEE8DF",borderLeft:"3px solid "+(a.type==="info"?"#C8D9E6":a.type==="skip"?"#dc2626":a.type==="rebuild"?"#567C8D":"#d97706")}}>
              <div style={{fontWeight:700,fontSize:".86rem"}}>{a.label}</div>
              <div style={{fontSize:".73rem",color:"#8A9CAA",marginTop:2,textTransform:"capitalize"}}>{a.type}</div>
            </div>
          ))}
        </div>
      </div>}
      {/* Timeline */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Today's timeline</div>
        <div style={{display:"grid",gap:8}}>
          {(day?.activities||[]).map(a=>(
            <div key={a._id||a.name} style={{padding:"10px 12px",borderRadius:10,background:"#F9F7F5",border:"1px solid #EEE8DF"}}>
              <div style={{fontWeight:700,fontSize:".86rem"}}>{typeEmoji(a.type)} {a.name}</div>
              <div style={{fontSize:".76rem",color:"#567C8D",marginTop:3}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
              {a.liveAdjustment&&<div style={{fontSize:".68rem",color:"#567C8D",marginTop:4,fontStyle:"italic"}}>Adjusted: {a.liveAdjustment?.type}</div>}
            </div>
          ))}
          {!(day?.activities||[]).length&&<div style={{color:"#8A9CAA",fontSize:".82rem",textAlign:"center",padding:"14px 0"}}>No activities scheduled.</div>}
        </div>
      </div>
    </div>
  );
}

// ── Smart Fallback Picker Engine (inlined — uid/hasAny/weatherLooksRainy/weatherLooksHot/parseDurationToMinutes/isDining reuse globals) ──
function textOf(item){ return[item?.name||"",item?.type||"",item?.desc||"",item?.address||"",item?.tip||""].join(" ").toLowerCase(); }
function weatherLooksCold(wf){ const m=String(wf||"").match(/(-?\d+)/),t=m?Number(m[1]):null; return t!=null&&t<=8; }
function isOutdoor(item){ const t=textOf(item); return hasAny(t,["park","garden","beach","viewpoint","lookout","walk","walking","hike","market","boat","outdoor","nature","architecture"]); }
function isIndoor(item){ const t=textOf(item); return hasAny(t,["museum","gallery","cafe","coffee","restaurant","spa","shopping","mall","cathedral","church","cinema","theater","library","indoor","market hall"]); }
function similarityPenalty(candidate,originalActivity){
  if(!originalActivity) return 0;
  const c=textOf(candidate),o=textOf(originalActivity);
  let penalty=0;
  if(isDining(candidate)&&isDining(originalActivity)) penalty+=2;
  if(isIndoor(candidate)&&isIndoor(originalActivity)) penalty+=1;
  if(c.includes("museum")&&o.includes("museum")) penalty+=2;
  if(c.includes("gallery")&&o.includes("gallery")) penalty+=2;
  return penalty;
}
function timeFitAlt(candidate,originalActivity){ return originalActivity?.time?4:0; }
function durationFit(candidate,originalActivity){
  if(!originalActivity) return 0;
  const diff=Math.abs(parseDurationToMinutes(candidate.duration)-parseDurationToMinutes(originalActivity.duration));
  return diff<=20?6:diff<=45?3:0;
}
function interestFit(candidate,interests=[]){
  const t=textOf(candidate);
  const map={"Food & Dining":["restaurant","cafe","bakery","food","wine","bar"],Culture:["museum","gallery","culture","theater","history"],History:["history","historic","cathedral","church","palace","castle"],Nightlife:["bar","cocktail","club","pub","live music"],Nature:["park","garden","beach","hike","lake","river"],Art:["art","gallery","museum","atelier"],Shopping:["shopping","boutique","market","vintage","design store"],"Hidden Spots":["hidden gem","local favorite","quiet","off the beaten path"],Architecture:["architecture","cathedral","palace","tower"],Wellness:["spa","wellness","sauna","yoga"],Photography:["viewpoint","sunset","lookout","scenic"]};
  return interests.reduce((score,interest)=>score+(hasAny(t,map[interest]||[])?4:0),0);
}
function weatherScore(candidate,weatherForecast,originalActivity){
  let score=0;
  const rainy=weatherLooksRainy(weatherForecast),cold=weatherLooksCold(weatherForecast),hot=weatherLooksHot(weatherForecast);
  if(rainy){ if(isIndoor(candidate)) score+=14; if(isOutdoor(candidate)) score-=18; }
  if(cold){ if(isIndoor(candidate)) score+=8; if(isOutdoor(candidate)) score-=8; }
  if(hot){ if(isIndoor(candidate)) score+=6; if(isOutdoor(candidate)) score-=4; }
  if(rainy&&originalActivity&&isOutdoor(originalActivity)&&isIndoor(candidate)) score+=8;
  return score;
}
function buildFallbackReason(weatherForecast,originalActivity,candidate){
  const rainy=weatherLooksRainy(weatherForecast),cold=weatherLooksCold(weatherForecast),hot=weatherLooksHot(weatherForecast);
  if(rainy&&originalActivity&&isOutdoor(originalActivity)&&isIndoor(candidate)) return `Good weather alternative because ${originalActivity.name} is outdoors and rain may affect it.`;
  if(rainy) return "Good weather alternative for a rainy day.";
  if(cold) return "Good weather alternative for colder conditions.";
  if(hot) return "Good weather alternative when it is very hot.";
  return "Good fallback option for current conditions.";
}
function scoreCandidate(candidate,context){
  return weatherScore(candidate,context.weatherForecast,context.originalActivity)+durationFit(candidate,context.originalActivity)+timeFitAlt(candidate,context.originalActivity)+interestFit(candidate,context.interests||[])-similarityPenalty(candidate,context.originalActivity);
}
function buildWeatherFallbackOptions({originalActivity,candidatePlaces=[],weatherForecast,interests=[],maxResults=4}){
  const badWeather=weatherLooksRainy(weatherForecast)||weatherLooksCold(weatherForecast)||weatherLooksHot(weatherForecast);
  if(!badWeather||!originalActivity) return[];
  return[...candidatePlaces]
    .map((p,idx)=>({...p,fallbackScore:scoreCandidate(p,{originalActivity,weatherForecast,interests}),_idx:idx}))
    .filter(p=>p.fallbackScore>0)
    .sort((a,b)=>b.fallbackScore!==a.fallbackScore?b.fallbackScore-a.fallbackScore:a._idx-b._idx)
    .slice(0,maxResults)
    .map(({_idx,...p})=>({_id:p._id||uid(),name:p.name||"Alternative",type:p.type||"Activity",desc:p.desc||"",address:p.address||"",duration:p.duration||originalActivity.duration||"1h 30m",time:originalActivity.time||p.time||"",price:p.price||"Free",isFree:!!p.isFree||String(p.price||"").toLowerCase().includes("free"),tip:p.tip||"",transport:p.transport||"",imgQuery:p.imgQuery||p.name||"travel",fallbackLabel:"Weather alternative",fallbackReason:buildFallbackReason(weatherForecast,originalActivity,p),replacesActivityId:originalActivity._id||originalActivity.name,weatherFallback:true,fallbackScore:p.fallbackScore}));
}
function addFallbackAsAlternative(day,fallback){ return{...day,weatherAlternatives:[...(day.weatherAlternatives||[]),fallback]}; }
function replaceActivityWithFallback(day,fallback){
  const targetId=fallback.replacesActivityId;
  return{...day,activities:(day.activities||[]).map(a=>(a._id||a.name)===targetId?{...fallback,_id:a._id||fallback._id,replacedOriginalName:a.name}:a)};
}
function dismissFallback(day,fallbackId){ return{...day,weatherAlternatives:(day.weatherAlternatives||[]).filter(f=>(f._id||f.name)!==fallbackId)}; }

// ── WeatherFallbackPanel component ────────────────────────────────────────────
function WeatherFallbackPanel({weatherForecast,selectedActivity,fallbackOptions,onAddAlternative,onReplaceWithFallback,onDismiss}){
  if(!selectedActivity) return(
    <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
      <div style={{fontWeight:800,marginBottom:6}}>🌦 Weather fallback</div>
      <div style={{fontSize:".82rem",color:"#567C8D"}}>Select an activity first to see weather-based alternatives.</div>
    </div>
  );
  const rainy=weatherLooksRainy(weatherForecast),cold=weatherLooksCold(weatherForecast),hot=weatherLooksHot(weatherForecast);
  const weatherBadge=rainy?"🌧 Rainy":cold?"🥶 Cold":hot?"🌡 Hot":"";
  return(
    <div className="fu" style={{display:"grid",gap:14}}>
      {/* Selected activity + weather context */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:6}}>🌦 Weather fallback options</div>
        <div style={{fontSize:".82rem",color:"#567C8D",marginBottom:10}}>
          Current weather: <b>{weatherForecast||"unknown"}</b>{weatherBadge?" · "+weatherBadge:""}
        </div>
        <div style={{padding:"10px 12px",borderRadius:10,background:"#F9F7F5",border:"1px solid #EEE8DF"}}>
          <div style={{fontWeight:700}}>{typeEmoji(selectedActivity.type)} {selectedActivity.name}</div>
          <div style={{fontSize:".78rem",color:"#567C8D",marginTop:3}}>{selectedActivity.time||"--:--"} · {selectedActivity.type||"Activity"}</div>
        </div>
      </div>
      {/* Alternatives */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Suggested weather alternatives</div>
        {!fallbackOptions.length&&<div style={{color:"#567C8D",fontSize:".82rem"}}>No strong weather alternatives found right now.</div>}
        <div style={{display:"grid",gap:10}}>
          {fallbackOptions.map(f=>(
            <div key={f._id} style={{border:"1px solid #EEE8DF",borderRadius:12,padding:12,background:"#F9F7F5",borderLeft:"3px solid #567C8D"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                <div>
                  <div style={{fontWeight:800}}>{typeEmoji(f.type)} {f.name}</div>
                  <div style={{fontSize:".76rem",color:"#567C8D",marginTop:3}}>{f.type}{f.time?` · ${f.time}`:""}{f.duration?` · ${f.duration}`:""}</div>
                </div>
                <span style={{padding:"3px 9px",borderRadius:50,background:"#dceaf3",color:"#2F4156",fontWeight:700,fontSize:".68rem",flexShrink:0,height:"fit-content"}}>Weather alt</span>
              </div>
              {f.desc&&<div style={{fontSize:".8rem",color:"#2F4156",lineHeight:1.45,marginBottom:6}}>{f.desc}</div>}
              {f.fallbackReason&&<div style={{fontSize:".76rem",color:"#567C8D",marginBottom:6}}><b>Why this fits:</b> {f.fallbackReason}</div>}
              {f.address&&<div style={{fontSize:".75rem",color:"#8A9CAA",marginBottom:8}}>📍 {f.address}</div>}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button onClick={()=>onAddAlternative(f)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>+ Add as alternative</button>
                <button onClick={()=>onReplaceWithFallback(f)} style={{padding:"8px 12px",borderRadius:8,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Replace current activity</button>
                <button onClick={()=>onDismiss(f._id)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #C8D9E6",background:"#fff",color:"#8A9CAA",fontWeight:700,fontFamily:"inherit"}}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── GroupPlanningPanel v2 component ───────────────────────────────────────────
function GroupPlanningPanel({groupState,currentDay,currentUserId,destination,onAddMember,onRemoveMember,onAddSuggestion,onVoteSuggestion,onClearSuggestionVote,onSetSuggestionStatus,onDeleteSuggestion,onAddComment,onMergeApproved,onVoteActivity}){
  const [memberName,setMemberName]=useState("");
  const [title,setTitle]=useState("");
  const [type,setType]=useState("Restaurant");
  const [notes,setNotes]=useState("");
  const [commentDrafts,setCommentDrafts]=useState({});
  const dayNumber=currentDay?.day;
  const suggestions=getSuggestionsForDay(groupState,dayNumber);
  const approvedCount=suggestions.filter(s=>s.status==="approved").length;

  function submitSuggestion(){
    if(!title.trim()) return;
    onAddSuggestion({dayNumber,title,type,notes,destination});
    setTitle("");setType("Restaurant");setNotes("");
  }
  function submitComment(suggestionId){
    const text=commentDrafts[suggestionId]||""; if(!text.trim()) return;
    onAddComment(suggestionId,text);
    setCommentDrafts(p=>({...p,[suggestionId]:""}));
  }

  return(
    <div className="fu" style={{display:"grid",gap:14}}>
      {/* Header */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:6}}>👥 Group Planning — Day {dayNumber}</div>
        <div style={{fontSize:".8rem",color:"#567C8D"}}>Suggest places, vote, discuss, and add approved ideas into the itinerary.</div>
      </div>
      {/* Members */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Travel Group</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {groupState.members.map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:999,background:m.id===currentUserId?"#dceaf3":"#EEE8DF",border:"1px solid #C8D9E6"}}>
              <span style={{fontSize:".78rem",fontWeight:700}}>{m.id===currentUserId?"✓ ":""}{m.name}{m.role==="owner"?" · owner":""}</span>
              {m.role!=="owner"&&<button onClick={()=>onRemoveMember(m.id)} style={{border:"none",background:"transparent",color:"#8A9CAA",cursor:"pointer",fontWeight:700,fontSize:".85rem",lineHeight:1}}>×</button>}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={memberName} onChange={e=>setMemberName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&memberName.trim()){onAddMember(memberName);setMemberName("");}}} placeholder="Add traveler name…" style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:"16px"}}/>
          <button onClick={()=>{if(memberName.trim()){onAddMember(memberName);setMemberName("");}}} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",minHeight:44}}>Add</button>
        </div>
      </div>
      {/* Suggest form */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Suggest something for Day {dayNumber}</div>
        <div style={{display:"grid",gap:8}}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Rooftop bar, museum, brunch place…" style={{padding:"10px 12px",borderRadius:10,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:"16px"}}/>
          <select value={type} onChange={e=>setType(e.target.value)} style={{padding:"10px 12px",borderRadius:10,border:"1px solid #C8D9E6",fontFamily:"inherit"}}>
            {["Restaurant","Cafe","Bar","Museum","Viewpoint","Shopping","Wellness","Activity"].map(t=><option key={t}>{t}</option>)}
          </select>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Why does this fit the group?" style={{padding:"10px 12px",borderRadius:10,border:"1px solid #C8D9E6",fontFamily:"inherit",resize:"none"}}/>
          <button onClick={submitSuggestion} disabled={!title.trim()} style={{padding:"11px 14px",borderRadius:10,border:"none",background:title.trim()?"#567C8D":"#C8D9E6",color:"#fff",fontWeight:700,fontFamily:"inherit",minHeight:44}}>Submit suggestion</button>
        </div>
      </div>
      {/* Suggestions list */}
      <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontWeight:800}}>Group Suggestions</div>
            <div style={{fontSize:".75rem",color:"#567C8D",marginTop:3}}>{suggestions.length} total · {approvedCount} approved</div>
          </div>
          {approvedCount>0&&<button onClick={onMergeApproved} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>Add approved to itinerary</button>}
        </div>
        {!suggestions.length&&<div style={{textAlign:"center",padding:"20px 0",fontSize:".82rem",color:"#8A9CAA"}}>No suggestions yet. Be the first!</div>}
        <div style={{display:"grid",gap:12}}>
          {suggestions.map(s=>{
            const myVote=s.votes?.[currentUserId]||0;
            const score=scoreVotes(s.votes);
            const isApproved=s.status==="approved";
            const isRejected=s.status==="rejected";
            const comments=groupState.commentsBySuggestionId[s.id]||[];
            return(
              <div key={s.id} style={{border:"1.5px solid "+(isApproved?"#567C8D":isRejected?"#fecaca":"#C8D9E6"),borderRadius:12,padding:12,background:isApproved?"#f0f9ff":isRejected?"#fef2f2":"#F9F7F5",position:"relative",opacity:isRejected?.6:1}}>
                {isApproved&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,borderRadius:"12px 12px 0 0",background:"#567C8D"}}/>}
                <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:".9rem"}}>{typeEmoji(s.type)} {s.title}</div>
                    <div style={{fontSize:".7rem",color:"#8A9CAA",marginTop:2}}>{s.type} · by {getMemberName(groupState,s.createdBy)} · {new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span style={{padding:"3px 9px",borderRadius:50,fontSize:".68rem",fontWeight:700,flexShrink:0,background:isApproved?"#dceaf3":isRejected?"#fef2f2":"#EEE8DF",color:isApproved?"#2F4156":isRejected?"#dc2626":"#567C8D",border:"1px solid "+(isApproved?"#C8D9E6":isRejected?"#fecaca":"#C8D9E6"),height:"fit-content"}}>
                    {isApproved?"✓ Approved":isRejected?"✗ Rejected":"Pending"}
                  </span>
                </div>
                {s.notes&&<p style={{fontSize:".78rem",color:"#567C8D",lineHeight:1.5,margin:"0 0 8px"}}>{s.notes}</p>}
                {/* Vote row */}
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                  <button onClick={()=>myVote===1?onClearSuggestionVote(s.id):onVoteSuggestion(s.id,1)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(myVote===1?"#2F4156":"#C8D9E6"),background:myVote===1?"#dceaf3":"#fff",fontWeight:700,fontFamily:"inherit"}}>👍</button>
                  <span style={{fontSize:".85rem",fontWeight:900,color:score>0?"#2F4156":score<0?"#dc2626":"#8A9CAA",minWidth:22,textAlign:"center"}}>{score>0?"+":""}{score}</span>
                  <button onClick={()=>myVote===-1?onClearSuggestionVote(s.id):onVoteSuggestion(s.id,-1)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(myVote===-1?"#dc2626":"#C8D9E6"),background:myVote===-1?"#fef2f2":"#fff",fontWeight:700,fontFamily:"inherit"}}>👎</button>
                  <div style={{flex:1}}/>
                  {!isApproved&&<button onClick={()=>onSetSuggestionStatus(s.id,"approved")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#567C8D",color:"#fff",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>✓ Approve</button>}
                  {!isRejected&&<button onClick={()=>onSetSuggestionStatus(s.id,"rejected")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#EEE8DF",color:"#8A9CAA",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>✗ Reject</button>}
                  {(isApproved||isRejected)&&<button onClick={()=>onSetSuggestionStatus(s.id,"pending")} style={{padding:"5px 8px",borderRadius:7,border:"1px solid #C8D9E6",background:"#fff",color:"#567C8D",fontSize:".72rem",fontFamily:"inherit"}}>↺ Reset</button>}
                  <button onClick={()=>onDeleteSuggestion(s.id)} style={{padding:"5px 8px",borderRadius:7,border:"1px solid #C8D9E6",background:"#fff",color:"#8A9CAA",fontSize:".72rem",fontFamily:"inherit"}}>🗑</button>
                </div>
                {/* Voter summary */}
                {Object.keys(s.votes||{}).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                  {Object.entries(s.votes).filter(([,v])=>v!==0).map(([mid,v])=>(
                    <span key={mid} style={{fontSize:".62rem",padding:"1px 7px",borderRadius:50,background:v===1?"#dceaf3":"#fef2f2",color:v===1?"#2F4156":"#dc2626",border:"1px solid "+(v===1?"#C8D9E6":"#fecaca"),fontWeight:600}}>{v===1?"▲":"▼"} {getMemberName(groupState,mid)}</span>
                  ))}
                </div>}
                {/* Comments */}
                {comments.length>0&&<div style={{marginBottom:8,display:"flex",flexDirection:"column",gap:4}}>
                  {comments.map(c=>(
                    <div key={c.id} style={{fontSize:".74rem",color:"#567C8D",padding:"5px 9px",background:"#EEE8DF",borderRadius:7}}>
                      <b>{getMemberName(groupState,c.memberId)}</b>: {c.text}
                    </div>
                  ))}
                </div>}
                <div style={{display:"flex",gap:7}}>
                  <input value={commentDrafts[s.id]||""} onChange={e=>setCommentDrafts(p=>({...p,[s.id]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&(commentDrafts[s.id]||"").trim()) submitComment(s.id);}} placeholder="Add a comment…" style={{flex:1,padding:"6px 9px",borderRadius:8,border:"1px solid #C8D9E6",fontSize:".75rem",fontFamily:"inherit"}}/>
                  <button onClick={()=>submitComment(s.id)} style={{padding:"6px 10px",borderRadius:8,border:"none",background:"#2F4156",color:"#fff",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>Send</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Vote on current itinerary */}
      {(currentDay?.activities||[]).length>0&&<div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Vote on today's itinerary</div>
        <div style={{display:"grid",gap:8}}>
          {(currentDay.activities||[]).map(a=>{
            const actId=a._id||a.name;
            const actScore=getActivityVoteScore(groupState,dayNumber,actId);
            return(
              <div key={actId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"#F9F7F5",border:"1px solid #EEE8DF"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:".84rem"}}>{typeEmoji(a.type)} {a.name}</div>
                  <div style={{fontSize:".73rem",color:"#567C8D"}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>onVoteActivity(actId,1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #C8D9E6",background:"#fff",fontFamily:"inherit"}}>👍</button>
                  <span style={{fontSize:".8rem",fontWeight:700,color:actScore>0?"#2F4156":actScore<0?"#dc2626":"#8A9CAA",minWidth:18,textAlign:"center"}}>{actScore>0?"+":""}{actScore}</span>
                  <button onClick={()=>onVoteActivity(actId,-1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #C8D9E6",background:"#fff",fontFamily:"inherit"}}>👎</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}

// ── Time Conflict Detector ────────────────────────────────────────────────────
function detectTimeConflicts(activities){
  const out=[];
  for(let i=0;i<activities.length-1;i++){
    const a=activities[i];
    const b=activities[i+1];
    const aStart=toMins(a.time);
    const aDur=parseDurationToMinutes(a.duration);
    const bStart=toMins(b.time);
    if(aStart!=null&&aDur>0&&bStart!=null){
      const aEnd=aStart+aDur+(a.travelMinsToNext||0);
      if(bStart<aEnd) out.push({indexA:i,indexB:i+1,nameA:a.name,nameB:b.name,overlapMins:aEnd-bStart});
    }
  }
  return out;
}

// ── Packing List Generator ────────────────────────────────────────────────────
function generatePackingList(days,form){
  const totalDays=days.length;
  const allActs=days.flatMap(d=>d.activities||[]);
  const actText=allActs.map(a=>((a.type||"")+" "+(a.name||"")).toLowerCase()).join(" ");
  const hasRain=days.some(d=>weatherLooksRainy(d.weatherForecast||""));
  const hasHot=days.some(d=>weatherLooksHot(d.weatherForecast||""));
  const hasCold=days.some(d=>{const t=(d.weatherForecast||"").match(/\d+/g);return t&&Math.min(...t.map(Number))<10;});
  const hasBeach=actText.includes("beach")||actText.includes("swim");
  const hasHike=actText.includes("hike")||actText.includes("hiking")||actText.includes("trekk")||actText.includes("trail");
  const hasDining=allActs.some(a=>isDining(a.type||""));
  const hasMuseum=actText.includes("museum")||actText.includes("gallery")||actText.includes("exhibition");
  const hasSki=actText.includes("ski")||actText.includes("snowboard");
  const travelers=Number(form?.travelers)||1;

  const essentials=["Passport / ID","Phone + charger","Power bank","Travel adapter","Earphones / earbuds","Cash + card","Travel insurance docs","Emergency contact list"];
  const clothing=[`${totalDays} day outfits`,"Underwear x"+(totalDays+2),"Comfortable walking shoes","Pyjamas / loungewear","Socks x"+(totalDays+1)];
  const gear=["Day backpack","Reusable water bottle","Sunscreen SPF50+","Camera / phone lens"];
  const toiletries=["Toothbrush + toothpaste","Deodorant","Shampoo + conditioner","Moisturiser / face cream","Pain relief","Blister plasters","Hair ties"];

  if(hasRain){clothing.push("Waterproof rain jacket");gear.push("Compact umbrella");}
  if(hasHot){clothing.push("Sunglasses","Sun hat / cap","Light breathable tops");}
  if(hasCold){clothing.push("Warm jacket / down coat","Thermal layer","Gloves","Scarf / neck warmer","Warm socks x2");}
  if(hasBeach){clothing.push("Swimsuit x2","Flip flops","Quick-dry beach towel","Rash guard / cover-up");toiletries.push("After-sun lotion");}
  if(hasDining){clothing.push("Smart-casual outfit for restaurants");}
  if(hasHike){clothing.push("Hiking / trail shoes","Moisture-wicking socks");gear.push("Trail snacks + energy bars","Compact first-aid kit","Offline maps downloaded");}
  if(hasMuseum){gear.push("Reusable tote bag","Notebook + pen");}
  if(hasSki){clothing.push("Ski jacket + pants","Thermal base layer","Ski socks");gear.push("Goggles","Helmet (or rent on-site)","Hand warmers");}
  if(travelers>1){essentials.push("Printed group itinerary");}

  return{essentials,clothing,gear,toiletries};
}

// ── Trip Screen ────────────────────────────────────────────────────────────────

// ── Transit URL helpers (Live Mode) ────────────────────────────────────────────
const TRANSIT_SITES={
  paris:"https://www.ratp.fr/en/plan-your-journey",
  london:"https://tfl.gov.uk/plan-a-journey/",
  berlin:"https://www.bvg.de/en",
  amsterdam:"https://9292.nl/en",
  vienna:"https://www.wienerlinien.at/en",
  rome:"https://www.atac.roma.it/en",
  barcelona:"https://www.tmb.cat/en/home",
  madrid:"https://www.crtm.es/en/",
  lisbon:"https://www.carris.pt/en/",
  prague:"https://www.dpp.cz/en",
  budapest:"https://bkk.hu/en/",
  copenhagen:"https://www.rejseplanen.dk/en/",
  stockholm:"https://sl.se/en",
  oslo:"https://ruter.no/en/",
  zurich:"https://www.zvv.ch/en/",
  munich:"https://www.mvv-muenchen.de/en/",
  hamburg:"https://www.hvv.de/en",
  tokyo:"https://www.tokyometro.jp/en/",
  osaka:"https://www.osakametro.co.jp/en/",
  "new york":"https://www.mta.info/",
  "san francisco":"https://www.bart.gov/",
  chicago:"https://www.transitchicago.com/",
  singapore:"https://www.transitlink.com.sg/",
  "hong kong":"https://www.mtr.com.hk/en/",
  seoul:"https://www.seoulmetro.co.kr/en/",
  sydney:"https://transportnsw.info/",
  melbourne:"https://www.ptv.vic.gov.au/",
};
function getLocalTransitUrl(destination){
  if(!destination) return null;
  const d=destination.toLowerCase();
  for(const [city,url] of Object.entries(TRANSIT_SITES)){
    if(d.includes(city)) return url;
  }
  return null;
}
function buildTransitUrl(userLoc,toAct,destination){
  if(!toAct) return null;
  const destStr=toAct.address?`${toAct.name}, ${toAct.address}`:`${toAct.name}, ${destination||""}`;
  const destEnc=encodeURIComponent(destStr);
  if(userLoc?.lat&&userLoc?.lng){
    const origin=encodeURIComponent(`${userLoc.lat},${userLoc.lng}`);
    return`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destEnc}&travelmode=transit`;
  }
  return`https://www.google.com/maps/dir/?api=1&destination=${destEnc}&travelmode=transit`;
}

// ── Suggestion inline form (own component to keep hooks at top level) ──────────
function SuggestionInlineForm({dayNum,destination,onSubmit}){
  const [open,setOpen]=useState(false);
  const [stitle,setStitle]=useState("");
  const [snotes,setSnotes]=useState("");
  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:"1.5px dashed #C8D9E6",background:"#fff",color:"#567C8D",fontWeight:700,fontFamily:"inherit",marginTop:4,cursor:"pointer"}}>
      + Eigenen Vorschlag einreichen
    </button>
  );
  return(
    <div style={{border:"1px solid #C8D9E6",borderRadius:12,padding:14,background:"#fff",marginTop:8}}>
      <div style={{fontWeight:700,fontSize:".82rem",marginBottom:8,color:"#2F4156"}}>Vorschlag einreichen</div>
      <input value={stitle} onChange={e=>setStitle(e.target.value)} placeholder="Name des Orts / Aktivität" style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:".84rem",marginBottom:8,boxSizing:"border-box"}}/>
      <textarea value={snotes} onChange={e=>setSnotes(e.target.value)} placeholder="Warum empfiehlst du das? (optional)" rows={2} style={{width:"100%",padding:"9px 11px",borderRadius:8,border:"1px solid #C8D9E6",fontFamily:"inherit",resize:"none",fontSize:".82rem",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>{if(!stitle.trim())return;onSubmit({dayNumber:dayNum,title:stitle.trim(),type:"Activity",notes:snotes.trim(),destination});setStitle("");setSnotes("");setOpen(false);}}
          style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Einreichen</button>
        <button onClick={()=>setOpen(false)} style={{padding:"9px 13px",borderRadius:9,border:"1px solid #C8D9E6",background:"#fff",color:"#567C8D",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Abbrechen</button>
      </div>
    </div>
  );
}

// ── Personality-based single-day regen prompt ─────────────────────────────────
function buildPersonalityRegenPrompt(dayNum,totalDays,destination,form,personalityId){
  const p=TRIP_PERSONALITIES[personalityId]||TRIP_PERSONALITIES.explorer;
  const interests=(form?.interests||[]).join(", ")||"general sightseeing";
  const travelers=form?.travelers||1;
  const travelerStr=travelers>1?`Group of ${travelers} travellers`:`Solo traveller`;
  const travelStyle=form?.style||"medium";
  const hotel=form?.hotel||"";
  const hotelLine=hotel?`Hotel: ${hotel}.`:"";
  // Transit constraints
  const isFirst=dayNum===1,isLast=dayNum===totalDays;
  const parts=[];
  if(isFirst&&form?.arrivalTime) parts.push(`Arrival at ${form.arrivalTime}. Only start activities at least 1h after arrival.`);
  if(isLast&&form?.departureTime) parts.push(`Departure at ${form.departureTime}. Last activity must end 2h before departure.`);
  const tc=parts.join(" ");
  const numActs=isFirst||isLast?3:5;
  // ── Safety rule ──
  const safetyRule="SAFETY RULE — MANDATORY: Never suggest adult entertainment, strip clubs, brothels, erotic or sexual services, sex shops, peep shows, or red-light district venues. All suggestions must be family-safe and culturally respectful. Relaxed or Luxury personalities mean wellness spa, yoga, nature walks, fine dining — never adult venues. This rule overrides everything else.";
  return "You are a travel expert. Respond ONLY with a single JSON object — no markdown, no extra text.\n"
    +safetyRule+"\n"
    +`Plan day ${dayNum} of ${totalDays} in ${destination}. ${travelerStr}. Style: ${travelStyle}. Interests: ${interests}. ${hotelLine} ${tc}\n`
    +`PERSONALITY: ${p.label} — ${p.description} Pace: ${p.pace}. Dining: ${p.diningStyle}. Activity focus: ${p.activityBias.join(", ")}.\n`
    +"Only include activities open at scheduled time (museums 09-18, bars 20+, restaurants: lunch 12-15, dinner 19-23).\n"
    +`Include exactly ${numActs} activities. Make them specific, authentic, and personality-appropriate.\n`
    +"Return exactly:\n"
    +'{"day":'+dayNum+',"theme":"short 3-word theme","neighborhood":"area name",'
    +'"weatherForecast":"Sunny 22C","timeWindow":"09:00-22:00",'
    +'"budget":{"budget":"50 EUR","medium":"100 EUR","luxury":"200 EUR"},'
    +'"evening":"one sentence evening suggestion",'
    +'"lunch":{"name":"place","cuisine":"type","price":"15 EUR","desc":"short","imgQuery":"food keyword"},'
    +'"dinner":{"name":"place","cuisine":"type","price":"25 EUR","desc":"short","imgQuery":"food keyword"},'
    +'"activities":[{"time":"09:00","name":"place name","type":"Museum","desc":"very short desc",'
    +'"address":"street, city","duration":"2h","price":"12 EUR","isFree":false,"isHidden":false,'
    +'"openHours":"09:00-18:00","tip":"short insider tip","transport":"Metro line X","imgQuery":"3 words"}]}';
}

function Trip({data,form,onBack,onSave,onShare}){
  const tripId=data.id||data._tripId||null;
  const {days,setDays,setDaysLocal,addActivity,removeActivity,reorderActivities,replaceDays,syncStatus,syncError,cloudEnabled}=useTripSync(
    tripId,
    (data.days||[]).map(d=>({...d,activities:(d.activities||[]).map(a=>({_id:uid(),...a}))}))
  );
  const [activeDay,setActiveDay]=useState(0);
  const [tab,setTab]=useState("plan");
  const [userLoc,setUserLoc]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [showExport,setShowExport]=useState(false);
  const [dragIndex,setDragIndex]=useState(null);
  const [placesLoading,setPlacesLoading]=useState(false);
  const [placesResults,setPlacesResults]=useState([]);
  const [placesQuery,setPlacesQuery]=useState("");
  const [altMode,setAltMode]=useState("budget");
  const [conciergeMsg,setConciergeMsg]=useState("");
  const [conciergeReply,setConciergeReply]=useState(null);
  const [conciergeLoading,setConciergeLoading]=useState(false);
  // conciergeApiKey removed — API key lives on the server via /api/chat, never in the browser
  const [gemsMode,setGemsMode]=useState(false);
  const [routeOptLoading,setRouteOptLoading]=useState(false);
  const [hiddenGemResults,setHiddenGemResults]=useState([]);
  const [personalityId,setPersonalityId]=useState(()=>{try{return localStorage.getItem("tm_personality")||getDefaultPersonalityFromForm(form);}catch(_){return getDefaultPersonalityFromForm(form);}});
  function savePersonality(id){setPersonalityId(id);try{localStorage.setItem("tm_personality",id);}catch(_){}}

  // ── Reactive personality: save + immediately regenerate active day via AI ──
  async function handlePersonalityChange(newId){
    if(regenLoading) return; // ignore double-clicks while generating
    savePersonality(newId);
    setRegenLoading(true);
    const dest=data.destination;
    const dayNum=activeDay+1;
    const total=days.length;
    const prompt=buildPersonalityRegenPrompt(dayNum,total,dest,form,newId);
    try{
      const dayData=await callAI(prompt,950);
      if(!dayData||!Array.isArray(dayData.activities)) throw new Error("No activities");
      const newActs=(dayData.activities||[]).map(a=>({_id:uid(),...a}));
      const dIdx=activeDay;
      replaceDays(prev=>prev.map((d,i)=>i!==dIdx?d:{
        ...d,
        activities:newActs,
        ...(dayData.theme?{theme:dayData.theme}:{}),
        ...(dayData.neighborhood?{neighborhood:dayData.neighborhood}:{}),
        ...(dayData.evening?{evening:dayData.evening}:{}),
        ...(dayData.lunch?{lunch:dayData.lunch}:{}),
        ...(dayData.dinner?{dinner:dayData.dinner}:{}),
      }));
      // Geocode new activities in background so map updates with real coords
      (async()=>{
        const geoR=(q)=>fetch("https://nominatim.openstreetmap.org/search?format=json&limit=3&q="+encodeURIComponent(q)).then(r=>r.json()).catch(()=>[]);
        const sleep=(ms)=>new Promise(res=>setTimeout(res,ms));
        const cityData=await geoR(dest);
        let viewbox=null;
        if(cityData&&cityData[0]){
          const c={lat:+cityData[0].lat,lng:+cityData[0].lon};
          viewbox=`${c.lng-0.15},${c.lat+0.15},${c.lng+0.15},${c.lat-0.15}`;
        }
        const geoLocal=async(q)=>{
          if(viewbox){
            const url=`https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}&viewbox=${viewbox}&bounded=1`;
            const d=await fetch(url).then(r=>r.json()).catch(()=>[]);
            if(d&&d[0]) return d;
          }
          return geoR(q);
        };
        await sleep(300);
        for(let ai=0;ai<newActs.length;ai++){
          const act=newActs[ai];
          const q=act.name+(act.address?", "+act.address:"")+", "+dest;
          const d=await geoLocal(q);
          if(d&&d[0]){
            const lat=+d[0].lat,lng=+d[0].lon,actId=act._id;
            replaceDays(prev=>prev.map((dd,i)=>i!==dIdx?dd:{
              ...dd,activities:dd.activities.map(a=>a._id===actId?{...a,lat,lng}:a)
            }));
          }
          if(ai<newActs.length-1) await sleep(300);
        }
      })();
    }catch(err){
      console.error("Personality regen failed:",err);
    }
    setRegenLoading(false);
  }
  // ── Inline editor ──────────────────────────────────────────────────────────
  const [editingActId,setEditingActId]=useState(null);
  const [editDraft,setEditDraft]=useState({});
  // ── Undo stack ─────────────────────────────────────────────────────────────
  const undoStackRef=useRef([]);
  const [undoCount,setUndoCount]=useState(0);
  // ── Push notifications ─────────────────────────────────────────────────────
  const [notifEnabled,setNotifEnabled]=useState(()=>{try{return localStorage.getItem("tm_notif")==="1";}catch(_){return false;}});
  // ── Budget limit ───────────────────────────────────────────────────────────
  const [budgetLimit,setBudgetLimit]=useState(()=>{try{const v=localStorage.getItem("tm_budget_limit");return v?Number(v):null;}catch(_){return null;}});
  const [showBudgetInput,setShowBudgetInput]=useState(false);
  // ── Personality regen ──────────────────────────────────────────────────────
  const [regenLoading,setRegenLoading]=useState(false);
  // ── Packing list ───────────────────────────────────────────────────────────
  const [packingChecked,setPackingChecked]=useState({});
  const day=days[activeDay]||{};
  const acts=day.activities||[];
  const totalDays=days.length;

  // ── Background geocoding: store accurate lat/lng in every activity after trip loads ──
  const bgGeoRunRef=useRef(false);
  useEffect(()=>{
    if(bgGeoRunRef.current) return;
    bgGeoRunRef.current=true;
    const dest=data.destination;
    if(!dest) return;
    const sleep=(ms)=>new Promise(res=>setTimeout(res,ms));
    const geo=(q)=>fetch("https://nominatim.openstreetmap.org/search?format=json&limit=3&q="+encodeURIComponent(q)).then(r=>r.json()).catch(()=>[]);
    let cancelled=false;
    async function run(){
      await sleep(800); // let map finish initial render first
      // Geocode city to build a viewbox — keeps all results inside the right city
      const cityData=await geo(dest);
      if(cancelled) return;
      let cityCenter=null;
      let viewbox=null;
      if(cityData&&cityData[0]){
        cityCenter={lat:+cityData[0].lat,lng:+cityData[0].lon};
        viewbox=`${cityCenter.lng-0.15},${cityCenter.lat+0.15},${cityCenter.lng+0.15},${cityCenter.lat-0.15}`;
      }
      const geoLocal=async(q)=>{
        if(viewbox){
          const url=`https://nominatim.openstreetmap.org/search?format=json&limit=3&q=${encodeURIComponent(q)}&viewbox=${viewbox}&bounded=1`;
          const d=await fetch(url).then(r=>r.json()).catch(()=>[]);
          if(d&&d[0]) return d;
        }
        return geo(q); // fallback: unbounded global search
      };
      await sleep(300);
      for(let di=0;di<days.length;di++){
        const dayActs=(days[di].activities||[]);
        for(let ai=0;ai<dayActs.length;ai++){
          if(cancelled) return;
          const act=dayActs[ai];
          if(act.lat&&act.lng){continue;} // already geocoded — skip
          // Name-first query is most accurate for Nominatim
          const q=act.name+(act.address?", "+act.address:"")+", "+dest;
          const d=await geoLocal(q);
          if(cancelled) return;
          if(d&&d[0]){
            const lat=+d[0].lat,lng=+d[0].lon;
            const actId=act._id||act.name;
            const dIdx=di;
            replaceDays(prev=>prev.map((dd,i)=>i!==dIdx?dd:{
              ...dd,
              activities:dd.activities.map(a=>(a._id||a.name)===actId?{...a,lat,lng}:a)
            }));
          }
          // No city-center-offset fallback — wrong pin is worse than missing pin
          await sleep(300);
        }
      }
    }
    run();
    return()=>{cancelled=true;};
  },[]); // runs once on mount

  function removeAct(id){ removeActivity(activeDay,id); }
  function addAct(a){ addActivity(activeDay,a); }
  function lockActivity(id){
    replaceDays(prev=>prev.map((d,i)=>{
      if(i!==activeDay) return d;
      const cur=d.activities.find(a=>(a._id||a.name)===id);
      return markActivityLocked(d,id,!(cur?.locked));
    }));
  }
  function requestLoc(){ if(!navigator.geolocation){alert("Geolocation not supported");return;} navigator.geolocation.getCurrentPosition(p=>setUserLoc({lat:p.coords.latitude,lng:p.coords.longitude}),()=>alert("Could not get location")); }
  function optimizeCurrentDay(){ replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimizeDayPlan(d,form,p.length))); }
  function optimizeAllDays(){ replaceDays(p=>optimizeWholeTrip(p,form)); }
  function rainProof(){ replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimizeDayPlan(replaceOutdoorForRain(d),form,p.length))); }
  function applyAlternativePlan(){ replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimizeDayPlan(buildAlternativePlan(d,altMode),form,p.length))); }
  function onDragStart(index){ setDragIndex(index); }
  async function onDropAt(index){
    if(dragIndex==null||dragIndex===index) return;
    const reordered=reorderActivitiesLocally(days[activeDay]?.activities||[],dragIndex,index);
    setDragIndex(null);
    await retimeCurrentDayAfterManualReorder(reordered);
  }
  function onDragEnd(){ setDragIndex(null); }
  async function retimeCurrentDayAfterManualReorder(updatedActivities){
    setRouteOptLoading(true);
    try{
      const dayDraft={...days[activeDay],activities:updatedActivities};
      const nextDay=await retimeAfterManualReorder({day:dayDraft,form,totalDays,destination:data.destination,hotel:form.hotel});
      replaceDays(prev=>prev.map((d,i)=>i===activeDay?nextDay:d));
    }catch(err){
      // fallback: apply reorder without timing on geocode failure
      replaceDays(prev=>prev.map((d,i)=>i===activeDay?{...d,activities:updatedActivities}:d));
    }finally{setRouteOptLoading(false);}
  }
  async function runPlacesSearch(){
    if(!placesQuery.trim()) return;
    setPlacesLoading(true);
    try{ const r=await searchPlaces({query:placesQuery,destination:data.destination}); setPlacesResults(r); }
    catch(err){ alert(err.message||"Places search failed"); }
    finally{ setPlacesLoading(false); }
  }
  function addPlaceResultToDay(place){ addActivity(activeDay,place); }
  function exportPDFLike(){ exportTripAsPrintableHTML(data,form,days); }
  async function shareCurrentTrip(){ try{ await shareTripText(data,form,days); }catch(err){ alert(err.message||"Share failed"); } }
  async function runConcierge(msg){
    const q=(msg||conciergeMsg).trim(); if(!q) return;
    setConciergeLoading(true); setConciergeReply(null);
    try{
      const reply=await askTravelConcierge({destination:data.destination,hotel:form.hotel,currentDay:day,allDays:days,activeDayIndex:activeDay,userMessage:q,userLoc,travelers:form.travelers,ageGroup:form.ageGroup,style:form.style,interests:form.interests});
      setConciergeReply(reply);
    }catch(e){alert(e.message||"Concierge failed");}
    finally{setConciergeLoading(false);}
  }
  async function optimizeRoute(keepSeq=false){
    setRouteOptLoading(true);
    try{
      const optimized=await optimizeRouteForDay({day,form,totalDays,destination:data.destination,hotel:form.hotel,keepUserSequence:keepSeq});
      replaceDays(p=>p.map((d,i)=>i!==activeDay?d:optimized));
    }catch(err){alert(err.message||"Route optimize failed");}
    finally{setRouteOptLoading(false);}
  }
  const routeLoading=routeOptLoading;
  function optimizeCurrentDayRoute(){ return optimizeRoute(false); }
  function addHiddenGemToDay(gem){ addActivity(activeDay,{...gem,_id:uid()}); setHiddenGemResults(prev=>prev.filter(g=>g._id!==gem._id&&g.name!==gem.name)); }
  function applyPersonalityToCurrentDay(){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:applyTripPersonalityToDay(d,form,personalityId||"explorer",prev.length)));
  }
  function applyPersonalityToWholeTrip(){
    replaceDays(prev=>applyTripPersonalityToTrip(prev,form,personalityId||"explorer"));
  }
  // ── Group Planning state v2 ────────────────────────────────────────────────
  const [groupState,setGroupState]=useState(()=>{
    if(tripId){try{const s=localStorage.getItem("tm_gs_"+tripId);if(s){const p=JSON.parse(s);if(p?.members) return p;}}catch(_){}}
    return createInitialGroupState([{id:"u1",name:form?.travelers>1?"Organiser":"You",role:"owner"}]);
  });
  // ── currentUser: read from localStorage (set by join flow) or default to owner ─
  const [currentUser]=useState(()=>{
    try{
      const stored=localStorage.getItem("tm_user_"+tripId);
      if(stored) return JSON.parse(stored);
    }catch(_){}
    // Owner default — first member in groupState
    const owner=groupState.members?.[0];
    return{id:owner?.id||"u1",name:owner?.name||"You",avatar:(owner?.name||"Y")[0].toUpperCase()};
  });
  const currentUserId=currentUser.id;
  // Group features are only shown once at least one other person has joined
  const isGroupTrip=groupState.members.length>=2;
  // Auto-persist groupState whenever it changes
  useEffect(()=>{ if(tripId){try{localStorage.setItem("tm_gs_"+tripId,JSON.stringify(groupState));}catch(_){}} },[groupState,tripId]);
  const planMapRef=useRef(null); // {zoomTo} from DayMap onReady
  const [zoomActId,setZoomActId]=useState(null);
  // ── Live Mode refs & derived state ────────────────────────────────────────
  const actCardRefs=useRef({});
  const isLiveModeDay=(()=>{
    if(!form?.startDate) return false;
    try{
      const tripStart=new Date(form.startDate+"T00:00:00");
      const dayDate=new Date(tripStart.getTime()+activeDay*86400000);
      const today=new Date();
      return dayDate.getFullYear()===today.getFullYear()&&dayDate.getMonth()===today.getMonth()&&dayDate.getDate()===today.getDate();
    }catch(_){return false;}
  })();
  const nextStopAct=isLiveModeDay?(acts.find(a=>a.liveStatus==="live")||acts.find(a=>a.liveStatus==="soon")||null):null;
  const nextStopId=nextStopAct?(nextStopAct._id||nextStopAct.name):null;
  function handleAddMember(memberName){ setGroupState(prev=>addGroupMember(prev,memberName)); }
  function handleRemoveMember(memberId){ setGroupState(prev=>removeGroupMember(prev,memberId)); }
  function handleAddSuggestion({dayNumber,title,type,notes,destination:dest}){
    setGroupState(prev=>addSuggestion(prev,{dayNumber,createdBy:currentUserId,title,type,notes,activityData:buildSuggestionActivityData({title,type,notes,destination:dest})}));
  }
  function handleVoteSuggestion(suggestionId,value){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>autoApproveTopSuggestions(updateSuggestionVote(prev,dayNumber,suggestionId,currentUserId,value),dayNumber,2));
  }
  function handleClearSuggestionVote(suggestionId){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>clearSuggestionVote(prev,dayNumber,suggestionId,currentUserId));
  }
  function handleSetSuggestionStatus(suggestionId,status){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>setSuggestionStatus(prev,dayNumber,suggestionId,status));
  }
  function handleDeleteSuggestion(suggestionId){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>deleteSuggestion(prev,dayNumber,suggestionId));
  }
  function handleAddComment(suggestionId,text){ setGroupState(prev=>addSuggestionComment(prev,suggestionId,currentUserId,text)); }
  function handleMergeApprovedSuggestions(){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:mergeApprovedSuggestionsIntoActivities(d,groupState)));
  }
  function handleVoteExistingActivity(activityId,value){
    const dayNumber=days[activeDay]?.day;
    setGroupState(prev=>voteOnExistingActivity(prev,dayNumber,activityId,currentUserId,value));
  }
  // ── Undo stack ─────────────────────────────────────────────────────────────
  function pushUndo(){ undoStackRef.current=[...undoStackRef.current.slice(-19),days]; setUndoCount(undoStackRef.current.length); }
  function replaceDaysUndoable(updater){ pushUndo(); replaceDays(updater); }
  useEffect(()=>{
    function onKey(e){
      if((e.ctrlKey||e.metaKey)&&e.key==="z"&&!e.shiftKey&&undoStackRef.current.length>0){
        e.preventDefault();
        const prev=undoStackRef.current[undoStackRef.current.length-1];
        undoStackRef.current=undoStackRef.current.slice(0,-1);
        setUndoCount(undoStackRef.current.length);
        replaceDays(()=>prev);
      }
    }
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // ── Live mode: auto-scroll to next stop when day is live ──────────────────
  useEffect(()=>{
    if(!isLiveModeDay||!nextStopId||tab!=="plan") return;
    const el=actCardRefs.current[nextStopId];
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isLiveModeDay,nextStopId,tab]);
  // ── Live mode: auto-zoom map to next stop ─────────────────────────────────
  useEffect(()=>{
    if(!isLiveModeDay||!nextStopAct||tab!=="plan") return;
    if(nextStopAct.lat&&nextStopAct.lng&&planMapRef.current?.zoomTo){
      planMapRef.current.zoomTo(nextStopAct._id||nextStopAct.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isLiveModeDay,nextStopId,tab]);
  // ── Inline activity editor ─────────────────────────────────────────────────
  function startEditAct(a){
    setEditingActId(a._id||a.name);
    setEditDraft({name:a.name||"",time:a.time||"",duration:a.duration||"",type:a.type||"",price:a.price||"",desc:a.desc||""});
  }
  function saveEditAct(){
    if(!editingActId) return;
    pushUndo();
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===editingActId?{...a,...editDraft}:a)}));
    setEditingActId(null);
  }
  // ── Visited / Rating / Note ────────────────────────────────────────────────
  function toggleVisited(actId){
    pushUndo();
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===actId?{...a,_visited:!a._visited}:a)}));
  }
  function setRating(actId,rating){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===actId?{...a,_rating:rating}:a)}));
  }
  function setActNote(actId,note){
    replaceDays(prev=>prev.map((d,i)=>i!==activeDay?d:{...d,activities:d.activities.map(a=>(a._id||a.name)===actId?{...a,_note:note}:a)}));
  }
  // ── Push notifications ─────────────────────────────────────────────────────
  async function requestNotifications(){
    if(!("Notification" in window)){alert("This browser does not support notifications");return;}
    const perm=await Notification.requestPermission();
    const on=perm==="granted";
    setNotifEnabled(on);
    try{localStorage.setItem("tm_notif",on?"1":"0");}catch(_){}
    if(on) scheduleNotifs(days[activeDay]?.activities||[]);
  }
  function scheduleNotifs(activities){
    const nowMins=new Date().getHours()*60+new Date().getMinutes();
    activities.forEach(a=>{
      const t=toMins(a.time);
      if(t==null||a._visited) return;
      const fireAt=t-15;
      if(fireAt>nowMins){
        const ms=(fireAt-nowMins)*60000;
        setTimeout(()=>{try{new Notification("Coming up: "+a.name,{body:"Starting in ~15 min · "+a.time});}catch(_){}},ms);
      }
    });
  }
  useEffect(()=>{if(notifEnabled) scheduleNotifs(days[activeDay]?.activities||[]);},[activeDay,notifEnabled]);
  // ── Budget limit persist ───────────────────────────────────────────────────
  function saveBudgetLimit(v){ const n=Number(v); setBudgetLimit(isNaN(n)||n<=0?null:n); try{localStorage.setItem("tm_budget_limit",String(n));}catch(_){} }
  // ── Group Supabase sync ────────────────────────────────────────────────────
  const groupSyncTimer=useRef(null);
  useEffect(()=>{
    if(!cloudEnabled||!tripId) return;
    const {url:sbUrl,key:sbKey}=getSbConfig();
    clearTimeout(groupSyncTimer.current);
    groupSyncTimer.current=setTimeout(async()=>{
      try{await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}`,{method:"PATCH",headers:sbHeaders(sbKey),body:JSON.stringify({group_state:groupState,updated_at:new Date().toISOString()})});}catch(_){}
    },1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[JSON.stringify(groupState),cloudEnabled,tripId]);
  useEffect(()=>{
    if(!cloudEnabled||!tripId) return;
    const {url:sbUrl,key:sbKey}=getSbConfig();
    let active=true; let etag="";
    async function pollGroup(){
      try{
        const res=await fetch(`${sbUrl}/rest/v1/trips?id=eq.${encodeURIComponent(tripId)}&select=group_state`,{headers:{...sbHeaders(sbKey),"If-None-Match":etag}});
        if(res.ok){etag=res.headers.get("etag")||"";const rows=await res.json();if(rows[0]?.group_state?.members){setGroupState(gs=>{const incoming=rows[0].group_state;return JSON.stringify(gs)===JSON.stringify(incoming)?gs:incoming;});}}
      }catch(_){}
      if(active) setTimeout(pollGroup,10000);
    }
    setTimeout(pollGroup,5000);
    return()=>{active=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cloudEnabled,tripId]);
  // ── Realtime state ─────────────────────────────────────────────────────────
  const [realtimeEnabled,setRealtimeEnabled]=useState(true);
  useRealtimeTripUpdates({enabled:realtimeEnabled,intervalMs:60000,setDays:setDaysLocal});
  function refreshRealtimeNow(){
    setDaysLocal(prev=>prev.map((d,i)=>i===activeDay?updateDayInRealtime(d,new Date()):d));
  }
  // ── Live trip control ──────────────────────────────────────────────────────
  const lateRisk=detectLateRisk(days[activeDay],userLoc,form.transport||"mixed");
  const {actions:controlActions}=getRealtimeControlActions(days[activeDay],userLoc,form.transport||"mixed");
  function refreshLiveControl(){ setDaysLocal(prev=>[...prev]); }
  function handleDelayRemaining(delayMinutes){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?delayRemainingActivities(d,delayMinutes):d));
  }
  function handleSkipNextStop(){
    const next=lateRisk?.nextActivity; if(!next) return;
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?skipActivity(d,next._id||next.name):d));
  }
  function handleRebuildRestOfDay(){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?rebuildRestOfDay(d):d));
  }
  // ── Weather fallback state ─────────────────────────────────────────────────
  const [selectedWeatherActivityId,setSelectedWeatherActivityId]=useState(null);
  const [weatherFallbackOptions,setWeatherFallbackOptions]=useState([]);
  const selectedWeatherActivity=(days[activeDay]?.activities||[]).find(a=>(a._id||a.name)===selectedWeatherActivityId)||null;
  const fallbackCandidatePool=[...(hiddenGemResults||[]),...(placesResults||[]),...((conciergeReply?.suggestions||[]).map(s=>({...s,_id:s._id||s.name})))];
  function generateWeatherFallbacksForSelectedActivity(){
    if(!selectedWeatherActivity) return;
    setWeatherFallbackOptions(buildWeatherFallbackOptions({originalActivity:selectedWeatherActivity,candidatePlaces:fallbackCandidatePool,weatherForecast:days[activeDay]?.weatherForecast||"",interests:form.interests||[],maxResults:4}));
  }
  function handleAddWeatherAlternative(fallback){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?addFallbackAsAlternative(d,fallback):d));
  }
  function handleReplaceWithWeatherFallback(fallback){
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?replaceActivityWithFallback(d,fallback):d));
    setWeatherFallbackOptions(prev=>prev.filter(f=>(f._id||f.name)!==(fallback._id||fallback.name)));
  }
  function handleDismissWeatherFallback(fallbackId){
    setWeatherFallbackOptions(prev=>prev.filter(f=>(f._id||f.name)!==fallbackId));
    replaceDays(prev=>prev.map((d,i)=>i===activeDay?dismissFallback(d,fallbackId):d));
  }
  // Auto rain-proof days that have real rainy weather data
  useEffect(()=>{
    replaceDays(prev=>prev.map(d=>{
      if(!d._realWeather?.rain) return d;
      return optimizeDayPlan(replaceOutdoorForRain(d),form,prev.length);
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const ws=weatherStyle(day.weatherForecast);

  return(
    <div style={{minHeight:"100vh",background:"#F5EFEB",color:"#2C365A",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <style>{CSS}</style>
      {showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={addAct} destination={data.destination} placesQuery={placesQuery} setPlacesQuery={setPlacesQuery} placesResults={placesResults} placesLoading={placesLoading} onRunPlacesSearch={runPlacesSearch} onAddPlace={addPlaceResultToDay}/>}
      {showExport&&<ExportModal onClose={()=>setShowExport(false)} data={data} form={form} days={days}/>}
      {/* Nav */}
      <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(255,255,255,.97)",backdropFilter:"blur(10px)",borderBottom:"1px solid #C8D9E6"}}>
        <div style={{maxWidth:740,margin:"0 auto",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"0 14px"}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:"#2F4156",fontSize:".9rem",fontFamily:"inherit",padding:"8px 4px",minWidth:56}}>← Back</button>
          <div style={{fontWeight:900,fontSize:".92rem",color:"#2F4156",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200}}>{data.destination}</div>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {/* Sync status indicator */}
            {syncStatus==="syncing"&&<span style={{fontSize:".62rem",color:"#567C8D",display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}><Spin size={10}/> Saving…</span>}
            {syncStatus==="synced"&&<span style={{fontSize:".62rem",color:"#567C8D",whiteSpace:"nowrap"}}>✓ Synced</span>}
            {syncStatus==="error"&&<span title={syncError} style={{fontSize:".62rem",color:"#dc2626",whiteSpace:"nowrap"}}>⚠ Sync error</span>}
            {syncStatus==="offline"&&!cloudEnabled&&<span style={{fontSize:".62rem",color:"#8A9CAA",whiteSpace:"nowrap"}}>📴 Local</span>}
            {undoCount>0&&<button title="Undo (Ctrl+Z)" onClick={()=>{const prev=undoStackRef.current[undoStackRef.current.length-1];if(!prev)return;undoStackRef.current=undoStackRef.current.slice(0,-1);setUndoCount(undoStackRef.current.length);replaceDays(()=>prev);}} style={{padding:"5px 8px",borderRadius:7,border:"1px solid #C8D9E6",background:"#fff",color:"#567C8D",fontSize:".72rem",fontFamily:"inherit",fontWeight:700,minHeight:30}}>↩ {undoCount}</button>}
            <button onClick={()=>onSave({days,groupState})} style={{padding:"6px 11px",borderRadius:8,background:"#dceaf3",border:"1px solid #C8D9E6",color:"#2F4156",fontSize:".77rem",fontFamily:"inherit",fontWeight:700,minHeight:34}}>💾 Save</button>
            <button onClick={()=>onShare({days,groupState})} style={{padding:"6px 11px",borderRadius:8,background:"#2F4156",border:"none",color:"#fff",fontSize:".77rem",fontFamily:"inherit",fontWeight:700,minHeight:34}}>🔗 Share</button>
            <button onClick={()=>setShowExport(true)} style={{padding:"6px 11px",borderRadius:8,background:"#567C8D",border:"none",color:"#fff",fontSize:".77rem",fontFamily:"inherit",fontWeight:700,minHeight:34}}>📤 Export</button>
          </div>
        </div>
      </div>
      {/* Hero - picsum gives a real photo */}
      <div style={{position:"relative",height:220,overflow:"hidden",backgroundImage:`url(${heroImg(data.destination)})`,backgroundSize:"cover",backgroundPosition:"center",backgroundColor:"#2C365A"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,.08),rgba(0,0,0,.62))"}}/>
        <div style={{position:"absolute",bottom:16,left:18,right:18,color:"#fff"}}>
          <h2 style={{fontSize:"clamp(1.5rem,4vw,2.2rem)",fontWeight:900,letterSpacing:"-.02em",textShadow:"0 2px 10px rgba(0,0,0,.5)"}}>{data.destination}</h2>
          <p style={{fontSize:".88rem",opacity:.88,textShadow:"0 1px 4px rgba(0,0,0,.6)",marginTop:4,marginBottom:10}}>{data.tagline}</p>
          {/* ── Traveller avatars strip ── */}
          {(data.members?.length>0)&&<div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{display:"flex"}}>
              {(data.members||[]).slice(0,6).map((m,idx)=>(
                <div key={idx} title={m.name} style={{width:28,height:28,borderRadius:"50%",background:"#2F4156",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".7rem",fontWeight:700,border:"2px solid rgba(255,255,255,.8)",marginLeft:idx>0?-8:0,zIndex:10-idx,boxShadow:"0 1px 4px rgba(0,0,0,.3)",flexShrink:0}}>
                  {m.avatar||(m.name||"?")[0].toUpperCase()}
                </div>
              ))}
              {/* + invite button */}
              <button onClick={()=>{
                const url=window.location.origin+window.location.pathname+"?joinTrip="+(data.id||Date.now());
                localStorage.setItem("tm_invite_"+(data.id||Date.now()),JSON.stringify({...data,id:data.id||Date.now()}));
                navigator.clipboard?.writeText(url).then(()=>alert("Invite link copied!")).catch(()=>prompt("Copy this link:",url));
              }} title="Invite a friend" style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,.18)",border:"2px dashed rgba(255,255,255,.6)",marginLeft:-8,color:"#fff",fontSize:"1rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",backdropFilter:"blur(4px)"}}>+</button>
            </div>
            <span style={{fontSize:".68rem",color:"rgba(255,255,255,.8)",fontWeight:600,textShadow:"0 1px 3px rgba(0,0,0,.4)"}}>{data.members.length} in the group</span>
          </div>}
        </div>
      </div>
      <div style={{maxWidth:740,margin:"0 auto",padding:"14px 14px 60px"}}>
        {/* Info */}
        <Crd>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {data.currency&&<span style={{fontSize:".7rem",padding:"2px 8px",background:"#EEE8DF",border:"1px solid #C8D9E6",borderRadius:5,color:"#2F4156"}}>{data.currency}</span>}
            {data.language&&<span style={{fontSize:".7rem",padding:"2px 8px",background:"#EEE8DF",border:"1px solid #C8D9E6",borderRadius:5,color:"#2F4156"}}>Lang: {data.language}</span>}
            {data.emergency&&<span style={{fontSize:".7rem",padding:"2px 8px",background:"#fef2f2",border:"1px solid #C8D9E6",borderRadius:5,color:"#dc2626"}}>SOS: {data.emergency}</span>}
            <span style={{fontSize:".7rem",padding:"2px 8px",background:"#dceaf3",border:"1px solid #C8D9E6",borderRadius:5,color:"#2F4156"}}>{totalDays} days</span>
          </div>
          {data.weatherNote&&<div style={{padding:"8px 11px",background:"#dceaf3",border:"1px solid #C8D9E6",borderRadius:8,fontSize:".79rem",color:"#2F4156",marginBottom:8}}>{data.weatherNote}</div>}
          {data.transportInfo&&<div style={{padding:"12px 14px",background:"#2C365A",border:"1px solid #2F4156",borderRadius:11}}>
            <div style={{fontWeight:700,fontSize:".8rem",color:"#C8D9E6",marginBottom:5}}>Getting Around</div>
            <p style={{fontSize:".77rem",color:"#8A9CAA",lineHeight:1.5,marginBottom:data.transportInfo.officialSite?8:0}}>{data.transportInfo.description}</p>
            {data.transportInfo.officialSite?.startsWith("http")&&!data.transportInfo.officialSite.includes("example")&&<a href={data.transportInfo.officialSite} target="_blank" rel="noreferrer" style={{padding:"4px 10px",background:"#2F4156",border:"1px solid #567C8D",borderRadius:6,color:"#C8D9E6",fontSize:".7rem",fontWeight:700,display:"inline-block"}}>Official Site</a>}
          </div>}
        </Crd>
        {/* Day tabs - card style */}
        <div className="sx" style={{gap:8,paddingBottom:10,marginBottom:4}}>
          {days.map((d,i)=>{
            const isAct=activeDay===i;
            const dws=weatherStyle(d.weatherForecast);
            return(
              <button key={i} onClick={()=>{setActiveDay(i);setTab("plan");}} style={{flexShrink:0,minWidth:88,padding:"10px 12px",borderRadius:14,fontFamily:"inherit",background:isAct?"#2F4156":"#fff",border:"1.5px solid "+(isAct?"#2F4156":"#C8D9E6"),textAlign:"left",cursor:"pointer",scrollSnapAlign:"start",boxShadow:isAct?"0 4px 14px rgba(47,65,86,.25)":"none",transition:"all .15s"}}>
                <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:isAct?"#C8D9E6":"#8A9CAA",marginBottom:3}}>Day {d.day}</div>
                <div style={{fontSize:".78rem",fontWeight:800,color:isAct?"#fff":"#2F4156",lineHeight:1.2,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:100}}>{d.theme||"—"}</div>
                {d.weatherForecast&&<div style={{fontSize:".62rem",padding:"1px 6px",borderRadius:50,background:isAct?"rgba(200,217,230,.2)":dws.bg,color:isAct?"#C8D9E6":dws.c,border:"1px solid "+(isAct?"rgba(200,217,230,.3)":dws.bd),display:"inline-block",whiteSpace:"nowrap"}}>{d.weatherForecast}</div>}
              </button>
            );
          })}
        </div>
        {/* Sub-tabs + Invite button */}
        <div style={{display:"flex",alignItems:"center",borderBottom:"2px solid #EEE8DF",marginBottom:14}}>
          <div style={{display:"flex",overflowX:"auto",flex:1}}>
            {[["plan","📋 Plan"],["map","🗺️ Map"],["ai","✨ Concierge"],...(isGroupTrip?[["group","👥 Gruppe"]]:[]),["live","🔴 Live"],["fallbacks","🌦 Wetter"],["packing","🎒 Koffer"],["tips","💡 Tipps"]].map(([id,l])=>(
              <button key={id} onClick={()=>setTab(id)} style={{padding:"11px 14px",minHeight:44,flexShrink:0,background:"none",border:"none",borderBottom:tab===id?"2.5px solid #2F4156":"2.5px solid transparent",marginBottom:"-2px",color:tab===id?"#2F4156":"#567C8D",fontSize:".84rem",fontFamily:"inherit",fontWeight:tab===id?700:400,whiteSpace:"nowrap",position:"relative"}}>
                {l}
                {id==="group"&&getSuggestionsForDay(groupState,day.day||activeDay+1).filter(s=>s.status==="pending").length>0&&<span style={{position:"absolute",top:8,right:4,width:8,height:8,borderRadius:"50%",background:"#dc2626"}}/>}
              </button>
            ))}
          </div>
          {/* ── Invite Friends button — always visible ── */}
          <button
            onClick={()=>{
              const tripId2=data.id||("trip_"+Date.now());
              const tripToShare={...data,id:tripId2,members:[...(data.members||[{id:currentUser.id,name:currentUser.name,avatar:currentUser.avatar}])]};
              const url=window.location.origin+window.location.pathname+"?joinTrip="+tripId2;
              try{localStorage.setItem("tm_invite_"+tripId2,JSON.stringify(tripToShare));}catch(_){}
              navigator.clipboard?.writeText(url)
                .then(()=>alert("✅ Invite-Link kopiert! Sende ihn an deine Freunde:\n\n"+url))
                .catch(()=>prompt("Kopiere diesen Link:",url));
            }}
            style={{flexShrink:0,marginLeft:8,marginBottom:2,padding:"7px 13px",borderRadius:20,border:"1.5px solid #2F4156",background:"#2F4156",color:"#fff",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            👥 Einladen
          </button>
        </div>
        {/* Plan */}
        {tab==="plan"&&<div className="fu">
          {/* ── Day header: magazine-style banner ── */}
          <div style={{position:"relative",borderRadius:16,overflow:"hidden",marginBottom:16,background:"#2C365A",minHeight:90}}>
            <div style={{position:"absolute",inset:0,backgroundImage:`url(${heroImg(data.destination)})`,backgroundSize:"cover",backgroundPosition:"center",opacity:.18}}/>
            <div style={{position:"relative",padding:"16px 16px 14px",display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:".65rem",fontWeight:900,letterSpacing:".12em",textTransform:"uppercase",color:"#C8D9E6",opacity:.8}}>Day {day.day}</span>
                {day.weatherForecast&&<span style={{fontSize:".72rem",padding:"2px 10px",borderRadius:50,background:ws.bg,border:"1px solid "+ws.bd,color:ws.c,fontWeight:700}}>{day.weatherForecast}</span>}
                {day.budget&&<span style={{fontSize:".7rem",padding:"2px 9px",borderRadius:50,background:"rgba(255,255,255,.12)",color:"#C8D9E6",border:"1px solid rgba(200,217,230,.25)"}}>{day.budget[form.style||"medium"]}</span>}
                {day.timeWindow&&<span style={{fontSize:".7rem",padding:"2px 9px",borderRadius:50,background:"rgba(255,255,255,.1)",color:"#C8D9E6",border:"1px solid rgba(200,217,230,.2)"}}>⏰ {day.timeWindow}</span>}
              </div>
              <h3 style={{fontSize:"1.3rem",fontWeight:900,color:"#fff",letterSpacing:"-.02em",lineHeight:1.1,textShadow:"0 2px 8px rgba(0,0,0,.3)"}}>{day.theme||"Day "+day.day}</h3>
              {day.neighborhood&&<span style={{fontSize:".76rem",color:"#C8D9E6",opacity:.85}}>📍 {day.neighborhood}</span>}
              {day._realWeather&&<span style={{fontSize:".62rem",padding:"1px 8px",borderRadius:50,background:"rgba(255,255,255,.12)",color:"#C8D9E6",border:"1px solid rgba(200,217,230,.2)"}}>🌡 Live forecast</span>}
            </div>
          </div>

          {/* ── Live Mode status bar (shown on today's trip day) ── */}
          {isLiveModeDay&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,background:"#dcfce7",border:"1.5px solid #86efac",marginBottom:14,flexWrap:"wrap"}}>
            <span style={{display:"inline-block",width:9,height:9,borderRadius:"50%",background:"#22c55e",animation:"pulse 1.2s infinite",flexShrink:0}}/>
            <span style={{fontWeight:800,fontSize:".84rem",color:"#15803d"}}>Live-Modus aktiv</span>
            <span style={{fontSize:".76rem",color:"#166534",opacity:.8}}>— Die App zeigt dir Echtzeit-Updates für heute.</span>
            {nextStopAct&&<span style={{marginLeft:"auto",fontSize:".74rem",fontWeight:700,background:"#fff",border:"1px solid #86efac",color:"#15803d",borderRadius:20,padding:"2px 10px",whiteSpace:"nowrap"}}>
              {nextStopAct.liveStatus==="live"?"● Jetzt: ":"⏭ Nächstes: "}{nextStopAct.name}
            </span>}
          </div>}
          {/* ── Trip Personality picker ── */}
          <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:18,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontWeight:800}}>Trip Personality</span>
              {regenLoading&&<span style={{fontSize:".72rem",fontWeight:700,color:"#567C8D",background:"#dceaf3",borderRadius:20,padding:"3px 10px",animation:"pulse 1.2s ease-in-out infinite"}}>✨ Generating…</span>}
            </div>
            <div style={{fontSize:".82rem",color:"#567C8D",marginBottom:12}}>Switch personality to instantly regenerate today's activities with a new vibe.</div>
            <div style={{display:"grid",gap:10}}>
              {Object.values(TRIP_PERSONALITIES).map(p=>(
                <button key={p.id}
                  onClick={()=>handlePersonalityChange(p.id)}
                  disabled={regenLoading}
                  style={{textAlign:"left",padding:"14px 15px",borderRadius:12,
                    border:personalityId===p.id?"1.5px solid #2F4156":"1.5px solid #C8D9E6",
                    background:personalityId===p.id?"#dceaf3":"#F9F7F5",
                    color:"#2F4156",fontFamily:"inherit",
                    cursor:regenLoading?"not-allowed":"pointer",
                    opacity:regenLoading&&personalityId!==p.id?.55:1,
                    transition:"opacity .2s,background .2s,border .2s"}}>
                  <div style={{fontWeight:800}}>{p.label}{personalityId===p.id&&regenLoading?" ⟳":""}</div>
                  <div style={{fontSize:".78rem",color:"#567C8D",marginTop:4}}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Controls toolbar ── */}
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
            <button onClick={optimizeCurrentDay} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Re-Optimize</button>
            <select value={altMode} onChange={e=>setAltMode(e.target.value)} style={{padding:"10px 12px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",fontFamily:"inherit"}}>
              <option value="budget">Budget Plan</option>
              <option value="relaxed">Relaxed Plan</option>
              <option value="fast">Fast Plan</option>
              <option value="rainy">Rainy Plan</option>
            </select>
            <button onClick={applyAlternativePlan} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #C8D9E6",background:"#EEE8DF",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>Apply Alternative</button>
            <button onClick={applyPersonalityToCurrentDay} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Apply Personality to Day</button>
            <button onClick={applyPersonalityToWholeTrip} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>Apply Personality to Trip</button>
            <button onClick={exportPDFLike} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>Export PDF</button>
            <button onClick={shareCurrentTrip} style={{padding:"10px 14px",borderRadius:10,border:"1px solid #C8D9E6",background:"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit"}}>Share Trip</button>
          </div>
          {/* ── Budget tracker ── */}
          {(()=>{
            const dayBudget=computeDayBudget(day);
            const tripBudget=computeTripBudget(days);
            const usedPct=budgetLimit?Math.min(100,Math.round(tripBudget.total/budgetLimit*100)):null;
            const overBudget=budgetLimit&&tripBudget.total>budgetLimit;
            return(
              <div style={{background:"#fff",border:"1px solid "+(overBudget?"#fca5a5":"#C8D9E6"),borderRadius:12,padding:14,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontWeight:800,fontSize:".85rem"}}>💰 Budget Tracker</div>
                  <button onClick={()=>setShowBudgetInput(v=>!v)} style={{padding:"4px 9px",borderRadius:7,border:"1px solid #C8D9E6",background:"#EEE8DF",color:"#567C8D",fontSize:".72rem",fontFamily:"inherit"}}>
                    {budgetLimit?`Limit: €${budgetLimit}`:"Set limit"}
                  </button>
                </div>
                {showBudgetInput&&<div style={{display:"flex",gap:6,marginBottom:10}}>
                  <input type="number" defaultValue={budgetLimit||""} onBlur={e=>saveBudgetLimit(e.target.value)} placeholder="Total trip budget (€)" style={{flex:1,padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:".82rem"}}/>
                  <button onClick={()=>setShowBudgetInput(false)} style={{padding:"8px 11px",borderRadius:9,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".82rem"}}>OK</button>
                </div>}
                {budgetLimit&&<div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".72rem",color:overBudget?"#dc2626":"#567C8D",marginBottom:4}}>
                    <span>€{tripBudget.total.toFixed(0)} spent</span>
                    <span>{overBudget?"⚠ Over budget!":""} €{budgetLimit} limit</span>
                  </div>
                  <div style={{height:8,borderRadius:99,background:"#EEE8DF",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:99,width:usedPct+"%",background:overBudget?"#dc2626":usedPct>80?"#f59e0b":"#22c55e",transition:"width .3s"}}/>
                  </div>
                </div>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div style={{background:"#F9F7F5",border:"1px solid #EEE8DF",borderRadius:10,padding:12}}>
                    <div style={{fontWeight:700,fontSize:".78rem",color:"#567C8D",marginBottom:6}}>Today · Day {day.day}</div>
                    <div style={{fontSize:".78rem",color:"#8A9CAA"}}>Activities: €{dayBudget.activities.toFixed(2)}</div>
                    {dayBudget.lunch>0&&<div style={{fontSize:".78rem",color:"#8A9CAA"}}>Lunch: €{dayBudget.lunch.toFixed(2)}</div>}
                    {dayBudget.dinner>0&&<div style={{fontSize:".78rem",color:"#8A9CAA"}}>Dinner: €{dayBudget.dinner.toFixed(2)}</div>}
                    <div style={{fontWeight:900,marginTop:8,fontSize:".88rem"}}>€{dayBudget.total.toFixed(2)}</div>
                  </div>
                  <div style={{background:"#F9F7F5",border:"1px solid #EEE8DF",borderRadius:10,padding:12}}>
                    <div style={{fontWeight:700,fontSize:".78rem",color:"#567C8D",marginBottom:6}}>Full trip · {days.length} days</div>
                    <div style={{fontSize:".78rem",color:"#8A9CAA"}}>Activities: €{tripBudget.activities.toFixed(2)}</div>
                    {tripBudget.lunch>0&&<div style={{fontSize:".78rem",color:"#8A9CAA"}}>Lunch: €{tripBudget.lunch.toFixed(2)}</div>}
                    {tripBudget.dinner>0&&<div style={{fontSize:".78rem",color:"#8A9CAA"}}>Dinner: €{tripBudget.dinner.toFixed(2)}</div>}
                    <div style={{fontWeight:900,marginTop:8,fontSize:".88rem",color:overBudget?"#dc2626":"#2F4156"}}>€{tripBudget.total.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Add Real Places ── */}
          {(()=>{
            const gemContext={interests:form.interests,style:form.style,period:"afternoon",weatherForecast:day.weatherForecast,existingActivities:acts};
            const displayResults=gemsMode&&placesResults.length>0?selectTopHiddenGems(placesResults,gemContext,6):placesResults;
            return(
            <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:12,padding:14,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontWeight:800}}>Add Real Places</div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setGemsMode(g=>!g)} style={{padding:"5px 11px",borderRadius:20,border:"1.5px solid",borderColor:gemsMode?"#C97B3A":"#C8D9E6",background:gemsMode?"#FFF4EB":"#F5F5F5",color:gemsMode?"#C97B3A":"#567C8D",fontWeight:700,fontFamily:"inherit",fontSize:".78rem"}}>
                    {gemsMode?"✨ Gems ON":"🔮 Hidden Gems"}
                  </button>
                  {placesResults.length>0&&<button onClick={()=>setHiddenGemResults(selectTopHiddenGems(placesResults,gemContext,8))} style={{padding:"5px 11px",borderRadius:20,border:"1.5px solid #C8D9E6",background:"#dceaf3",color:"#2F4156",fontWeight:700,fontFamily:"inherit",fontSize:".78rem"}}>Save Gems</button>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <input value={placesQuery} onChange={e=>setPlacesQuery(e.target.value)} placeholder="museum, rooftop bar, brunch, spa..." style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:"16px"}}/>
                <button onClick={runPlacesSearch} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#567C8D",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>{placesLoading?"Searching...":"Search"}</button>
              </div>
              {gemsMode&&placesResults.length>0&&<div style={{fontSize:".75rem",color:"#C97B3A",marginBottom:8,fontWeight:600}}>✨ Showing top hidden gems scored for your style & interests</div>}
              <div style={{display:"grid",gap:8}}>
                {displayResults.map(p=>(
                  <div key={p._id||p.name} style={{border:`1px solid ${p.hiddenGem?"#E8C9A0":"#C8D9E6"}`,borderRadius:10,padding:12,background:p.hiddenGem?"#FFFAF4":"#F9F7F5"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{fontWeight:800,flex:1}}>{p.name}</div>
                      {p.hiddenGem&&<span style={{fontSize:".68rem",fontWeight:800,background:"#C97B3A",color:"#fff",borderRadius:20,padding:"2px 8px"}}>✨ Hidden Gem</span>}
                      {p.hiddenGemScore!=null&&<span style={{fontSize:".68rem",fontWeight:700,color:"#C97B3A"}}>★{p.hiddenGemScore}</span>}
                    </div>
                    <div style={{fontSize:".8rem",color:"#567C8D",marginTop:4}}>{p.address}</div>
                    {p.tip&&<div style={{fontSize:".75rem",color:"#C97B3A",marginTop:4,fontStyle:"italic"}}>{p.tip}</div>}
                    {p.openHours&&<div style={{fontSize:".75rem",color:"#8A9CAA",marginTop:4}}>{p.openHours}</div>}
                    <button onClick={()=>addPlaceResultToDay(p)} style={{marginTop:8,padding:"8px 12px",borderRadius:8,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Add to day</button>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}

          {/* ── Activities: drag-sortable vertical list with lock ── */}
          {(()=>{
            const conflicts=detectTimeConflicts(acts);
            const conflictAt=new Set(conflicts.map(c=>c.indexB));
            return(
          <div style={{position:"relative"}}>
          {/* Loading overlay while personality regen is running */}
          {regenLoading&&(
            <div style={{position:"absolute",inset:0,zIndex:20,borderRadius:14,background:"rgba(249,247,245,.88)",backdropFilter:"blur(3px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,minHeight:160}}>
              <div style={{width:36,height:36,border:"4px solid #C8D9E6",borderTopColor:"#2F4156",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
              <div style={{fontWeight:700,color:"#2F4156",fontSize:".9rem"}}>Regenerating activities…</div>
              <div style={{fontSize:".78rem",color:"#567C8D"}}>Crafting a {TRIP_PERSONALITIES[personalityId]?.label||""} day for you</div>
            </div>
          )}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <button onClick={optimizeCurrentDayRoute} disabled={routeLoading} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",opacity:routeLoading?.6:1}}>{routeLoading?"Optimizing...":"Optimize Route"}</button>
          </div>
          {acts.map((a,i)=>{
            const actId=a._id||a.name;
            const isEditing=editingActId===actId;
            const conflict=conflicts.find(c=>c.indexB===i);
            const isNextStop=isLiveModeDay&&actId===nextStopId;
            const isLiveNow=isLiveModeDay&&a.liveStatus==="live";
            const isPastAct=isLiveModeDay&&(a.liveStatus==="missed_or_done"||a.liveStatus==="just_finished");
            return(
            <div key={actId} ref={el=>actCardRefs.current[actId]=el}>
              {conflict&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",margin:"4px 0",background:"#fef9c3",border:"1px solid #fde047",borderRadius:8,fontSize:".74rem",color:"#92400e",fontWeight:600}}>
                ⚠ Conflict: {conflict.nameA} runs {conflict.overlapMins} min into {conflict.nameB}
              </div>}
              <div draggable
                onDragStart={()=>onDragStart(i)}
                onDragOver={e=>e.preventDefault()}
                onDrop={()=>onDropAt(i)}
                onDragEnd={onDragEnd}
                style={{marginBottom:10,borderRadius:12,opacity:dragIndex===i?.45:isPastAct?.62:1,filter:isPastAct?"grayscale(25%)":"none",transition:"opacity .15s,filter .15s",cursor:"grab",outline:isLiveNow?"2.5px solid #22c55e":isNextStop?"2.5px solid #d97706":"none",outlineOffset:isLiveNow||isNextStop?2:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}>
                  <div style={{fontSize:".75rem",color:"#567C8D"}}>{a.travelLabelFromPrev?`Travel: ${a.travelLabelFromPrev}`:""}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    {/* Visited toggle */}
                    <button onClick={()=>toggleVisited(actId)} title={a._visited?"Mark as not visited":"Mark as visited"} style={{padding:"5px 8px",borderRadius:8,border:"1.5px solid "+(a._visited?"#22c55e":"#C8D9E6"),background:a._visited?"#dcfce7":"#fff",color:a._visited?"#16a34a":"#8A9CAA",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>
                      {a._visited?"✓ Done":"○ Not done"}
                    </button>
                    {/* Star rating (only when visited) */}
                    {a._visited&&<div style={{display:"flex",gap:1}}>{[1,2,3,4,5].map(s=><button key={s} onClick={()=>setRating(actId,s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:".95rem",color:s<=(a._rating||0)?"#f59e0b":"#C8D9E6",padding:"0 1px",lineHeight:1}}>★</button>)}</div>}
                    <span style={{fontSize:".72rem",color:"#8A9CAA"}}>Drag</span>
                    <button onClick={()=>isEditing?setEditingActId(null):startEditAct(a)} style={{padding:"5px 8px",borderRadius:8,border:"1px solid #C8D9E6",background:isEditing?"#dceaf3":"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>✏️ Edit</button>
                    <button onClick={()=>{setSelectedWeatherActivityId(actId);setWeatherFallbackOptions([]);setTab("fallbacks");}} style={{padding:"5px 8px",borderRadius:8,border:"1px solid #C8D9E6",background:actId===selectedWeatherActivityId?"#dceaf3":"#fff",color:"#2F4156",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>🌦</button>
                    <button onClick={()=>lockActivity(actId)} style={{padding:"5px 8px",borderRadius:8,border:"1px solid #C8D9E6",background:a.locked?"#2F4156":"#fff",color:a.locked?"#fff":"#2F4156",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",minHeight:30}}>
                      {a.locked?"🔒":"🔓"}
                    </button>
                  </div>
                </div>
                {/* ── Live Mode banner ── */}
                {isLiveNow&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",marginBottom:6,borderRadius:8,background:"#dcfce7",border:"1px solid #86efac"}}>
                  <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#22c55e",animation:"pulse 1.2s infinite"}}/>
                  <span style={{fontWeight:800,fontSize:".78rem",color:"#15803d"}}>● Live jetzt</span>
                  {a.time&&<span style={{fontSize:".72rem",color:"#16a34a",marginLeft:"auto"}}>ab {a.time}</span>}
                </div>}
                {isNextStop&&!isLiveNow&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",marginBottom:6,borderRadius:8,background:"#fef9ec",border:"1px solid #fcd34d"}}>
                  <span style={{fontWeight:800,fontSize:".78rem",color:"#b45309"}}>⏭ Nächster Halt</span>
                  {a.time&&<span style={{fontSize:".72rem",color:"#d97706",marginLeft:"auto"}}>um {a.time}</span>}
                </div>}
                {i===0
                  ?<HeroActCard act={a} onRemove={removeAct} onZoom={()=>setZoomActId(actId)}/>
                  :<StoryActCard act={a} onRemove={removeAct} onZoom={()=>setZoomActId(actId)}/>}
                {/* Inline editor */}
                {isEditing&&<div style={{background:"#fff",border:"1.5px solid #2F4156",borderRadius:12,padding:14,marginTop:6,display:"grid",gap:8}}>
                  <div style={{fontWeight:700,fontSize:".82rem",color:"#2F4156",marginBottom:2}}>Edit activity</div>
                  <input value={editDraft.name} onChange={e=>setEditDraft(d=>({...d,name:e.target.value}))} placeholder="Name" style={{padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:".84rem"}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <input value={editDraft.time} onChange={e=>setEditDraft(d=>({...d,time:e.target.value}))} placeholder="Time (HH:MM)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:".84rem"}}/>
                    <input value={editDraft.duration} onChange={e=>setEditDraft(d=>({...d,duration:e.target.value}))} placeholder="Duration (e.g. 2h)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:".84rem"}}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <input value={editDraft.type} onChange={e=>setEditDraft(d=>({...d,type:e.target.value}))} placeholder="Type (Museum, Bar…)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:".84rem"}}/>
                    <input value={editDraft.price} onChange={e=>setEditDraft(d=>({...d,price:e.target.value}))} placeholder="Price (€ or Free)" style={{padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:".84rem"}}/>
                  </div>
                  <textarea value={editDraft.desc} onChange={e=>setEditDraft(d=>({...d,desc:e.target.value}))} placeholder="Description / notes" rows={2} style={{padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",resize:"none",fontSize:".84rem"}}/>
                  {/* Personal travel note */}
                  <textarea value={a._note||""} onChange={e=>setActNote(actId,e.target.value)} placeholder="Your travel note (private)…" rows={2} style={{padding:"8px 10px",borderRadius:9,border:"1px solid #C8D9E6",fontFamily:"inherit",resize:"none",fontSize:".82rem",background:"#fafafa"}}/>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={saveEditAct} style={{flex:1,padding:"10px",borderRadius:9,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Save changes</button>
                    <button onClick={()=>setEditingActId(null)} style={{padding:"10px 14px",borderRadius:9,border:"1px solid #C8D9E6",background:"#fff",color:"#567C8D",fontWeight:700,fontFamily:"inherit"}}>Cancel</button>
                  </div>
                </div>}
                {/* Travel note display (when not editing) */}
                {!isEditing&&a._note&&<div style={{fontSize:".74rem",color:"#567C8D",fontStyle:"italic",marginTop:4,padding:"5px 9px",background:"#EEE8DF",borderRadius:7}}>📝 {a._note}</div>}
                {/* ── Live Vote Bar — shown whenever ≥2 members are in the group ── */}
                {groupState.members.length>=2&&(()=>{
                  const dayNum=day.day||activeDay+1;
                  const voteData=(groupState.activityVotesByDay[String(dayNum)]||{})[actId]||{};
                  const myVote=voteData[currentUserId]||0;
                  const upVoters=Object.entries(voteData).filter(([,v])=>Number(v)>0).map(([mid])=>getMemberName(groupState,mid));
                  const downVoters=Object.entries(voteData).filter(([,v])=>Number(v)<0).map(([mid])=>getMemberName(groupState,mid));
                  const allVoters=[...upVoters,...downVoters];
                  const score=upVoters.length-downVoters.length;
                  return(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid #EEE8DF",flexWrap:"wrap"}}>
                      {/* Upvote */}
                      <button onClick={()=>handleVoteExistingActivity(actId,myVote===1?0:1)}
                        style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid",borderColor:myVote===1?"#2F4156":"#C8D9E6",background:myVote===1?"#dceaf3":"#fff",fontWeight:700,fontSize:".76rem",cursor:"pointer",transition:"all .15s"}}>
                        👍 {upVoters.length>0?upVoters.length:""}
                      </button>
                      {/* Downvote */}
                      <button onClick={()=>handleVoteExistingActivity(actId,myVote===-1?0:-1)}
                        style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid",borderColor:myVote===-1?"#dc2626":"#C8D9E6",background:myVote===-1?"#fee2e2":"#fff",fontWeight:700,fontSize:".76rem",cursor:"pointer",transition:"all .15s"}}>
                        👎 {downVoters.length>0?downVoters.length:""}
                      </button>
                      {/* Avatar row: who voted */}
                      {allVoters.length>0&&<div style={{display:"flex",alignItems:"center",gap:3}}>
                        {allVoters.slice(0,4).map((n,vi)=>(
                          <div key={vi} title={n}
                            style={{width:22,height:22,borderRadius:"50%",background:upVoters.includes(n)?"#dceaf3":"#fee2e2",border:"1.5px solid",borderColor:upVoters.includes(n)?"#567C8D":"#fca5a5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".6rem",fontWeight:900,color:upVoters.includes(n)?"#2F4156":"#dc2626"}}>
                            {n[0].toUpperCase()}
                          </div>
                        ))}
                        {allVoters.length>4&&<span style={{fontSize:".62rem",color:"#8A9CAA"}}>+{allVoters.length-4}</span>}
                        <span style={{fontSize:".7rem",color:"#8A9CAA",marginLeft:2}}>
                          {allVoters.length===1?allVoters[0]:allVoters.length===2?allVoters.join(" & "):allVoters[0]+" & "+(allVoters.length-1)+" weitere"}
                        </span>
                      </div>}
                      {/* Score badge */}
                      {score!==0&&<span style={{marginLeft:"auto",fontSize:".72rem",fontWeight:800,color:score>0?"#16a34a":"#dc2626",background:score>0?"#dcfce7":"#fee2e2",padding:"2px 9px",borderRadius:20}}>
                        {score>0?"+"+score:score}
                      </span>}
                    </div>
                  );
                })()}
              </div>
              {/* ── Live transit routing block ── */}
              {isNextStop&&(()=>{
                const gmUrl=buildTransitUrl(userLoc,a,data.destination);
                const localUrl=getLocalTransitUrl(data.destination);
                return(
                  <div style={{margin:"4px 0 12px 0",padding:"10px 14px",borderRadius:10,background:"#f0f7ff",border:"1.5px solid #C8D9E6",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:".76rem",fontWeight:700,color:"#2F4156",marginRight:4}}>🚌 So kommst du hin:</span>
                    {gmUrl&&<a href={gmUrl} target="_blank" rel="noopener noreferrer"
                      style={{padding:"6px 12px",borderRadius:8,background:"#2F4156",color:"#fff",fontWeight:700,fontSize:".74rem",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                      🗺 Google Maps Transit
                    </a>}
                    {localUrl&&<a href={localUrl} target="_blank" rel="noopener noreferrer"
                      style={{padding:"6px 12px",borderRadius:8,background:"#fff",border:"1px solid #C8D9E6",color:"#567C8D",fontWeight:700,fontSize:".74rem",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:5}}>
                      🚇 Lokaler ÖPNV
                    </a>}
                  </div>
                );
              })()}
            </div>
            );
          })}
          </div>
            );
          })()}
          {/* ── Inline Friend Suggestions — only in group trips ──────────────── */}
          {isGroupTrip&&(()=>{
            const dayNum=day.day||activeDay+1;
            const pending=getSuggestionsForDay(groupState,dayNum).filter(s=>s.status==="pending");
            if(!pending.length) return null;
            return(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:".68rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"#8A9CAA",marginBottom:8}}>👥 Vorschläge der Gruppe</div>
                {pending.map(s=>{
                  const myVote=s.votes?.[currentUserId]||0;
                  const upCount=Object.values(s.votes||{}).filter(v=>Number(v)>0).length;
                  const downCount=Object.values(s.votes||{}).filter(v=>Number(v)<0).length;
                  const suggestorName=getMemberName(groupState,s.createdBy);
                  const isMine=s.createdBy===currentUserId;
                  return(
                    <div key={s.id} style={{border:"1.5px dashed #C8D9E6",borderRadius:12,padding:"12px 14px",marginBottom:8,background:"#F9F7F5",position:"relative"}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                            <span style={{fontWeight:800,fontSize:".88rem",color:"#2F4156"}}>{s.title}</span>
                            {s.type&&<span style={{fontSize:".68rem",padding:"1px 7px",borderRadius:20,background:"#EEE8DF",color:"#567C8D",fontWeight:600}}>{s.type}</span>}
                          </div>
                          <div style={{fontSize:".72rem",color:"#567C8D"}}>
                            💬 Vorgeschlagen von <b>{isMine?"dir":suggestorName}</b>
                          </div>
                          {s.notes&&<div style={{fontSize:".78rem",color:"#2F4156",marginTop:5,lineHeight:1.4}}>{s.notes}</div>}
                        </div>
                        {/* Vote buttons */}
                        <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
                          <button onClick={()=>handleVoteSuggestion(s.id,myVote===1?0:1)}
                            style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:myVote===1?"#2F4156":"#C8D9E6",background:myVote===1?"#dceaf3":"#fff",fontWeight:700,fontSize:".72rem",cursor:"pointer"}}>
                            👍 {upCount||""}
                          </button>
                          <button onClick={()=>handleVoteSuggestion(s.id,myVote===-1?0:-1)}
                            style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid",borderColor:myVote===-1?"#dc2626":"#C8D9E6",background:myVote===-1?"#fee2e2":"#fff",fontWeight:700,fontSize:".72rem",cursor:"pointer"}}>
                            👎 {downCount||""}
                          </button>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7,marginTop:10,flexWrap:"wrap"}}>
                        <button onClick={()=>{addAct({_id:uid(),name:s.title,type:s.type,desc:s.notes,_suggestedBy:suggestorName});handleSetSuggestionStatus(s.id,"approved");}}
                          style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".75rem",cursor:"pointer"}}>
                          ✓ Zum Tag hinzufügen
                        </button>
                        {isMine&&<button onClick={()=>handleDeleteSuggestion(s.id)}
                          style={{padding:"6px 10px",borderRadius:8,border:"1px solid #C8D9E6",background:"#fff",color:"#8A9CAA",fontWeight:700,fontFamily:"inherit",fontSize:".72rem",cursor:"pointer"}}>
                          Löschen
                        </button>}
                      </div>
                    </div>
                  );
                })}
                {/* Submit own suggestion — SuggestionInlineForm handles its own state */}
                <SuggestionInlineForm dayNum={dayNum} destination={data.destination} onSubmit={handleAddSuggestion}/>
              </div>
            );
          })()}

          {hiddenGemResults.length>0&&(
            <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16,marginBottom:14}}>
              <div style={{fontWeight:800,marginBottom:10}}>Hidden Gems</div>
              <div style={{display:"grid",gap:10}}>
                {hiddenGemResults.map(g=>(
                  <div key={g._id||g.name} style={{border:"1px solid #C8D9E6",borderRadius:12,padding:12,background:"#F9F7F5"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
                      <div>
                        <div style={{fontWeight:800}}>{g.name}</div>
                        <div style={{fontSize:".76rem",color:"#567C8D",marginTop:3}}>{g.type} · Score {Math.round(g.hiddenGemScore||0)}</div>
                      </div>
                      <div style={{padding:"4px 8px",borderRadius:999,background:"#dceaf3",color:"#2F4156",fontWeight:700,fontSize:".72rem",whiteSpace:"nowrap",alignSelf:"flex-start"}}>Hidden Gem</div>
                    </div>
                    {g.desc&&<div style={{marginTop:8,color:"#2F4156",lineHeight:1.45,fontSize:".83rem"}}>{g.desc}</div>}
                    {g.tip&&<div style={{marginTop:8,fontSize:".78rem",color:"#567C8D"}}><b>Why chosen:</b> {g.tip}</div>}
                    <button onClick={()=>addHiddenGemToDay(g)} style={{marginTop:10,padding:"8px 12px",borderRadius:8,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>Add to day</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={()=>setShowAdd(true)} style={{width:"100%",padding:"12px",borderRadius:11,border:"2px dashed #C8D9E6",background:"#F5EFEB",color:"#2F4156",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",marginBottom:14,minHeight:46}}>+ Add Activity</button>

          {/* ── Saved weather alternatives ── */}
          {(day.weatherAlternatives||[]).length>0&&<div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16,marginBottom:14}}>
            <div style={{fontWeight:800,marginBottom:10}}>🌦 Saved weather alternatives</div>
            <div style={{display:"grid",gap:8}}>
              {day.weatherAlternatives.map(alt=>(
                <div key={alt._id||alt.name} style={{padding:"10px 12px",borderRadius:10,background:"#f0f9ff",border:"1px solid #C8D9E6",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:".86rem"}}>{typeEmoji(alt.type)} {alt.name}</div>
                    <div style={{fontSize:".75rem",color:"#567C8D",marginTop:2}}>Weather alt{alt.time?` · ${alt.time}`:""}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>addAct({...alt,_id:uid()})} style={{padding:"6px 10px",borderRadius:8,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".72rem"}}>Add to day</button>
                    <button onClick={()=>handleDismissWeatherFallback(alt._id||alt.name)} style={{padding:"6px 8px",borderRadius:8,border:"1px solid #C8D9E6",background:"#fff",color:"#8A9CAA",fontFamily:"inherit",fontSize:".72rem"}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* ── Route Summary ── */}
          {day.routeMeta?.segments?.length>0&&(
            <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16,marginBottom:14}}>
              <div style={{fontWeight:800,marginBottom:10}}>Route Summary</div>
              <div style={{display:"grid",gap:8}}>
                {day.routeMeta.segments.map((seg,i)=>(
                  <div key={i} style={{padding:"10px 12px",borderRadius:10,background:"#F9F7F5",border:"1px solid #EEE8DF"}}>
                    <div style={{fontWeight:700}}>{seg.from} → {seg.to}</div>
                    <div style={{fontSize:".78rem",color:"#567C8D",marginTop:3}}>
                      {seg.minutes!=null?`${seg.minutes} min`:"Travel time unavailable"}
                      {seg.km!=null?` · ${seg.km} km`:""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(day.lunch||day.dinner)&&<DiningRow lunch={day.lunch} dinner={day.dinner}/>}

          {/* ── Evening suggestion ── */}
          {day.evening&&<div style={{display:"flex",gap:12,alignItems:"flex-start",padding:"13px 14px",background:"#2C365A",borderRadius:13,marginBottom:16,boxShadow:"0 2px 12px rgba(47,65,86,.15)"}}>
            <span style={{fontSize:"1.4rem",flexShrink:0,marginTop:1}}>🌙</span>
            <div>
              <div style={{fontSize:".62rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:"#C8D9E6",opacity:.7,marginBottom:3}}>Evening</div>
              <div style={{fontSize:".86rem",color:"#fff",lineHeight:1.5}}>{day.evening}</div>
            </div>
          </div>}

          {/* ── Map ── */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{flex:1,height:1,background:"#C8D9E6"}}/>
            <span style={{fontSize:".65rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#8A9CAA",padding:"0 4px"}}>Today's Route</span>
            <div style={{flex:1,height:1,background:"#C8D9E6"}}/>
          </div>
          <DayMap acts={acts} destination={data.destination} hotel={form.hotel} isFirstDay={activeDay===0} isLastDay={activeDay===totalDays-1} userLoc={userLoc} onRequestLocation={requestLoc} visible={true} onReady={api=>planMapRef.current=api} zoomToActId={zoomActId}/>
        </div>}
        {/* Concierge tab */}
        {tab==="ai"&&<div className="fu" style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:12,padding:14}}>
            <div style={{fontWeight:800,fontSize:".9rem",marginBottom:4,color:"#2F4156"}}>✨ AI Travel Concierge</div>
            <div style={{fontSize:".75rem",color:"#8A9CAA",marginBottom:12}}>Ask anything about your trip — swaps, food, weather, what to do next.</div>
            <div style={{display:"flex",gap:7,marginBottom:10,flexWrap:"wrap"}}>
              {["Next 2 hours","Rain backup","Dinner now","Near me now"].map(l=>(
                <button key={l} onClick={()=>runConcierge(buildQuickPrompt(l))} style={{padding:"7px 12px",borderRadius:8,border:"1px solid #C8D9E6",background:"#F5EFEB",color:"#2F4156",fontSize:".75rem",fontWeight:600,fontFamily:"inherit"}}>{l}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input value={conciergeMsg} onChange={e=>setConciergeMsg(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runConcierge()} placeholder="What should I do if it rains this afternoon?" style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid #C8D9E6",fontFamily:"inherit",fontSize:"16px"}}/>
              <button onClick={()=>runConcierge()} disabled={conciergeLoading||!conciergeMsg.trim()} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",opacity:conciergeLoading||!conciergeMsg.trim()?.5:1}}>
                {conciergeLoading?<Spin size={16}/>:"Ask"}
              </button>
            </div>
          </div>
          {conciergeReply&&<div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontWeight:800,fontSize:".9rem",color:"#2F4156"}}>{conciergeReply.answerTitle}</div>
            <p style={{fontSize:".82rem",color:"#567C8D",lineHeight:1.6,margin:0}}>{conciergeReply.answerText}</p>
            {conciergeReply.quickActions?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {conciergeReply.quickActions.map((qa,i)=>(
                <span key={i} style={{padding:"5px 11px",borderRadius:50,background:"#EEE8DF",border:"1px solid #C8D9E6",fontSize:".72rem",color:"#2F4156",fontWeight:600}}>{qa.label}</span>
              ))}
            </div>}
            {conciergeReply.suggestions?.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:".7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"#8A9CAA"}}>Suggestions</div>
              {conciergeReply.suggestions.map(s=>(
                <div key={s._id} style={{border:"1px solid #C8D9E6",borderRadius:10,padding:12,background:"#F9F7F5"}}>
                  <div style={{fontWeight:800,fontSize:".88rem",color:"#2F4156"}}>{s.name}</div>
                  {s.reason&&<div style={{fontSize:".72rem",color:"#567C8D",marginTop:2,fontStyle:"italic"}}>{s.reason}</div>}
                  {s.desc&&<div style={{fontSize:".78rem",color:"#2F4156",marginTop:4,lineHeight:1.5}}>{s.desc}</div>}
                  {s.address&&<div style={{fontSize:".7rem",color:"#8A9CAA",marginTop:3}}>📍 {s.address}</div>}
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <button onClick={()=>{addActivity(activeDay,s);}} style={{padding:"7px 12px",borderRadius:8,border:"none",background:"#2F4156",color:"#fff",fontSize:".75rem",fontWeight:700,fontFamily:"inherit"}}>+ Add to day</button>
                    {s.tip&&<span style={{fontSize:".7rem",color:"#567C8D",alignSelf:"center"}}>💡 {s.tip}</span>}
                  </div>
                </div>
              ))}
            </div>}
          </div>}
        </div>}
        {/* Group tab — only rendered when ≥2 members */}
        {tab==="group"&&isGroupTrip&&<GroupPlanningPanel
          groupState={groupState}
          currentDay={day}
          currentUserId={currentUserId}
          destination={data.destination}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          onAddSuggestion={handleAddSuggestion}
          onVoteSuggestion={handleVoteSuggestion}
          onClearSuggestionVote={handleClearSuggestionVote}
          onSetSuggestionStatus={handleSetSuggestionStatus}
          onDeleteSuggestion={handleDeleteSuggestion}
          onAddComment={handleAddComment}
          onMergeApproved={handleMergeApprovedSuggestions}
          onVoteActivity={handleVoteExistingActivity}
        />}

        {/* Live tab */}
        {tab==="live"&&<div style={{display:"grid",gap:14}}>
          <RealtimeStatusPanel
            day={day}
            realtimeEnabled={realtimeEnabled}
            onToggleRealtime={()=>setRealtimeEnabled(v=>!v)}
            onRefreshNow={refreshRealtimeNow}
            onReoptimize={optimizeCurrentDay}
          />
          <LiveTripControlPanel
            day={day}
            lateRisk={lateRisk}
            controlActions={controlActions}
            onDelay={handleDelayRemaining}
            onSkipNext={handleSkipNextStop}
            onRebuild={handleRebuildRestOfDay}
            onRefresh={refreshLiveControl}
          />
        </div>}

        {/* Weather fallback tab */}
        {tab==="fallbacks"&&<div style={{display:"grid",gap:14}}>
          {selectedWeatherActivity&&<div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:14,padding:16}}>
            <div style={{fontWeight:800,marginBottom:8}}>Generating fallbacks for: {selectedWeatherActivity.name}</div>
            <button onClick={generateWeatherFallbacksForSelectedActivity} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit"}}>
              🔍 Find weather alternatives
            </button>
          </div>}
          <WeatherFallbackPanel
            weatherForecast={day?.weatherForecast||""}
            selectedActivity={selectedWeatherActivity}
            fallbackOptions={weatherFallbackOptions}
            onAddAlternative={handleAddWeatherAlternative}
            onReplaceWithFallback={handleReplaceWithWeatherFallback}
            onDismiss={handleDismissWeatherFallback}
          />
        </div>}

        {/* Map tab - all day maps always mounted, only active day visible */}
        <div style={{display:tab==="map"?"block":"none"}}>
          <div style={{padding:"10px 13px",background:"#dceaf3",border:"1px solid #C8D9E6",borderRadius:9,fontSize:".8rem",color:"#2F4156",marginBottom:12,fontWeight:600}}>Day {day.day||(activeDay+1)} · {acts.length} stops{form.hotel?" · Hotel start":""}</div>
          {days.map((d,i)=><DayMap key={i} acts={d.activities||[]} destination={data.destination} hotel={form.hotel} isFirstDay={i===0} isLastDay={i===totalDays-1} userLoc={userLoc} onRequestLocation={requestLoc} visible={tab==="map"&&activeDay===i}/>)}
        </div>
        {/* Packing list tab */}
        {tab==="packing"&&(()=>{
          const pl=generatePackingList(days,form);
          const cats=[["🧳 Essentials","essentials"],["👗 Clothing","clothing"],["🎒 Gear","gear"],["🪥 Toiletries","toiletries"]];
          const totalItems=Object.values(pl).flat().length;
          const checkedCount=Object.values(packingChecked).filter(Boolean).length;
          return(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Notifications opt-in */}
              <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:12,padding:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:".86rem"}}>🔔 Activity Notifications</div>
                  <div style={{fontSize:".74rem",color:"#8A9CAA",marginTop:2}}>Get a reminder 15 min before each activity</div>
                </div>
                {notifEnabled
                  ?<span style={{padding:"5px 11px",borderRadius:20,background:"#dcfce7",border:"1px solid #bbf7d0",color:"#16a34a",fontWeight:700,fontSize:".75rem"}}>✓ On</span>
                  :<button onClick={requestNotifications} style={{padding:"8px 14px",borderRadius:9,border:"none",background:"#2F4156",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:".78rem"}}>Enable</button>
                }
              </div>
              {/* Packing progress */}
              <div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:12,padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{fontWeight:800}}>🎒 Packing List</div>
                  <span style={{fontSize:".78rem",color:"#567C8D",fontWeight:600}}>{checkedCount}/{totalItems} packed</span>
                </div>
                <div style={{height:6,borderRadius:99,background:"#EEE8DF",overflow:"hidden",marginBottom:12}}>
                  <div style={{height:"100%",borderRadius:99,width:(totalItems?Math.round(checkedCount/totalItems*100):0)+"%",background:"#22c55e",transition:"width .3s"}}/>
                </div>
                {cats.map(([label,key])=>(
                  <div key={key} style={{marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:".78rem",color:"#567C8D",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</div>
                    <div style={{display:"grid",gap:4}}>
                      {pl[key].map((item,idx)=>{
                        const k=key+":"+idx;
                        return(
                          <label key={k} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",borderRadius:8,background:packingChecked[k]?"#f0fdf4":"#F9F7F5",border:"1px solid "+(packingChecked[k]?"#bbf7d0":"#EEE8DF"),cursor:"pointer"}}>
                            <input type="checkbox" checked={!!packingChecked[k]} onChange={e=>setPackingChecked(p=>({...p,[k]:e.target.checked}))} style={{accentColor:"#22c55e",width:15,height:15,flexShrink:0}}/>
                            <span style={{fontSize:".83rem",color:packingChecked[k]?"#8A9CAA":"#2F4156",textDecoration:packingChecked[k]?"line-through":"none",flex:1}}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {checkedCount===totalItems&&totalItems>0&&<div style={{textAlign:"center",padding:"14px 0",fontSize:".9rem",fontWeight:800,color:"#16a34a"}}>🎉 All packed!</div>}
              </div>
            </div>
          );
        })()}
        {/* Tips */}
        {tab==="tips"&&<div className="fu" style={{display:"flex",flexDirection:"column",gap:11}}>
          {[{title:"General Tips",color:"#2F4156",items:data.tips,b:">"},{title:"Free Things",color:"#567C8D",items:data.freebies,b:"+"},{title:"Hidden Gems",color:"#567C8D",items:data.gems,b:"*"}].map(block=>{
            if(!block.items?.length) return null;
            return<div key={block.title} style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:12,padding:16}}>
              <div style={{fontWeight:700,fontSize:".88rem",marginBottom:10,color:block.color}}>{block.title}</div>
              {block.items.map((t,i)=><div key={i} style={{padding:"7px 0",borderBottom:i<block.items.length-1?"1px solid #EEE8DF":"none",fontSize:".83rem",color:"#2F4156",display:"flex",gap:9,lineHeight:1.5}}><span style={{color:block.color,flexShrink:0}}>{block.b}</span>{t}</div>)}
            </div>;
          })}
          {data.packing?.length>0&&<div style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:12,padding:16}}>
            <div style={{fontWeight:700,fontSize:".88rem",marginBottom:10,color:"#2F4156"}}>Packing List</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{data.packing.map((t,i)=><span key={i} style={{fontSize:".76rem",padding:"4px 10px",background:"#EEE8DF",border:"1px solid #C8D9E6",borderRadius:6,color:"#2F4156"}}>{t}</span>)}</div>
          </div>}
        </div>}
      </div>
    </div>
  );
}

// ── Join Screen — shown when a user opens an invite link ──────────────────────
function JoinScreen({tripData,onJoin}){
  const [name,setName]=useState("");
  const dest=tripData?.destination||"this trip";
  const memberCount=(tripData?.members||[]).length;
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#2C365A,#2F4156)",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <style>{CSS}</style>
      <div style={{background:"#fff",borderRadius:24,padding:"40px 32px",maxWidth:440,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:"3rem",marginBottom:12}}>✈️</div>
          <h2 style={{fontSize:"1.5rem",fontWeight:900,color:"#2F4156",margin:"0 0 8px"}}>Du wurdest eingeladen!</h2>
          <p style={{color:"#567C8D",fontSize:".9rem",lineHeight:1.6,margin:0}}>
            Reise nach <b style={{color:"#2F4156"}}>{dest}</b>
            {memberCount>0&&<span> · {memberCount} {memberCount===1?"Reisender":"Reisende"} dabei</span>}
          </p>
        </div>
        {/* Avatar preview of existing members */}
        {(tripData?.members||[]).length>0&&(
          <div style={{display:"flex",justifyContent:"center",gap:-4,marginBottom:24}}>
            {(tripData.members||[]).slice(0,5).map((m,i)=>(
              <div key={i} title={m.name} style={{width:36,height:36,borderRadius:"50%",background:"#2F4156",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".8rem",fontWeight:800,border:"2.5px solid #fff",marginLeft:i>0?-10:0,zIndex:10-i,boxShadow:"0 2px 6px rgba(0,0,0,.15)"}}>
                {(m.avatar||m.name||"?")[0].toUpperCase()}
              </div>
            ))}
          </div>
        )}
        <div style={{marginBottom:20}}>
          <label style={{display:"block",fontSize:".78rem",fontWeight:700,color:"#2F4156",marginBottom:8}}>Dein Name (wird der Gruppe angezeigt)</label>
          <input
            autoFocus
            value={name}
            onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onJoin(name.trim())}
            placeholder="z.B. Anna"
            style={{width:"100%",padding:"14px 16px",borderRadius:12,border:"2px solid #C8D9E6",fontSize:"1rem",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <button
          disabled={!name.trim()}
          onClick={()=>name.trim()&&onJoin(name.trim())}
          style={{width:"100%",padding:"15px",borderRadius:12,border:"none",background:name.trim()?"#2F4156":"#C8D9E6",color:"#fff",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:name.trim()?"pointer":"default",transition:"background .15s"}}>
          Dem Trip beitreten →
        </button>
        <p style={{textAlign:"center",fontSize:".68rem",color:"#8A9CAA",marginTop:14,margin:"14px 0 0"}}>Kein Account nötig · Name wird nur innerhalb der Gruppe gesehen</p>
      </div>
    </div>
  );
}

// ── First-run setup screen (only shown if server has no API key yet) ───────────
function SetupKeyScreen({onDone}){
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
    <div style={{minHeight:"100vh",background:"#F5EFEB",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <style>{CSS}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"36px 32px",maxWidth:420,width:"100%",boxShadow:"0 8px 40px rgba(47,65,86,.12)"}}>
        <div style={{fontSize:"2.4rem",marginBottom:12,textAlign:"center"}}>✈️</div>
        <h2 style={{fontSize:"1.4rem",fontWeight:900,color:"#2F4156",marginBottom:6,textAlign:"center"}}>Welcome to TripMind</h2>
        <p style={{fontSize:".84rem",color:"#567C8D",textAlign:"center",lineHeight:1.6,marginBottom:24}}>
          One-time setup: enter your Claude API key to activate trip generation.<br/>
          It stays on your computer — no account needed.
        </p>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:".72rem",fontWeight:700,color:"#2F4156",marginBottom:5}}>🔑 Claude API Key</div>
          <input
            type="password"
            value={key}
            onChange={e=>{setKey(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&save()}
            placeholder="sk-ant-…"
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${err?"#fca5a5":key?"#567C8D":"#C8D9E6"}`,fontSize:".9rem",fontFamily:"inherit",background:"#EEE8DF",outline:"none"}}
            autoFocus
          />
          {err&&<div style={{fontSize:".73rem",color:"#dc2626",marginTop:5}}>⚠ {err}</div>}
          <div style={{fontSize:".68rem",color:"#8A9CAA",marginTop:6}}>
            Get a free key at <b>console.anthropic.com</b> → API Keys → Create Key.<br/>Stored locally in <code>api_key.txt</code> — never sent to third parties.
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving||!key.trim()}
          style={{marginTop:16,width:"100%",padding:"13px",borderRadius:11,border:"none",background:key.trim()&&!saving?"#2F4156":"#C8D9E6",color:"#fff",fontWeight:800,fontSize:"1rem",fontFamily:"inherit",cursor:key.trim()&&!saving?"pointer":"default",transition:"background .15s"}}>
          {saving?"Saving…":"Save & Start →"}
        </button>
      </div>
    </div>
  );
}

// ── Root / Generation ──────────────────────────────────────────────────────────
// Long trips strategy: generate meta once, then days in small batches of 3
// Each batch is one callAI that returns multiple days at once → far fewer API calls
// ── Bottom Navigation Bar ──────────────────────────────────────────────────────
function BottomNav({tab,setTab,tripsCount}){
  const tabs=[
    {id:"home",icon:"✈️",label:"Neue Reise"},
    {id:"trips",icon:"🧳",label:"Meine Reisen",badge:tripsCount||null},
  ];
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:"rgba(255,255,255,.97)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",borderTop:"1px solid #C8D9E6",padding:"8px 16px calc(8px + env(safe-area-inset-bottom))"}}>
      <div style={{maxWidth:600,margin:"0 auto",display:"flex",gap:6}}>
        {tabs.map(({id,icon,label,badge})=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{flex:1,padding:"10px 8px 8px",borderRadius:14,border:"none",fontFamily:"inherit",cursor:"pointer",
              background:tab===id?"#2F4156":"transparent",
              color:tab===id?"#fff":"#8A9CAA",
              transition:"all .18s",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:"1.35rem",lineHeight:1}}>{icon}</span>
            <span style={{fontSize:".68rem",fontWeight:tab===id?700:500,letterSpacing:".01em",whiteSpace:"nowrap"}}>{label}</span>
            {badge&&<span style={{position:"absolute",top:7,right:"calc(50% - 20px)",minWidth:17,height:17,borderRadius:999,background:"#dc2626",color:"#fff",fontSize:".58rem",fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── My Trips Screen ────────────────────────────────────────────────────────────
function MyTripsScreen({savedTrips,setSavedTrips,onLoadTrip}){
  return(
    <div style={{minHeight:"100vh",background:"#F5EFEB",fontFamily:"'Segoe UI',system-ui,sans-serif",paddingBottom:100}}>
      <style>{CSS}</style>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#2C365A,#2F4156)",padding:"32px 18px 28px",textAlign:"center"}}>
        <div style={{fontSize:".67rem",letterSpacing:".16em",textTransform:"uppercase",color:"rgba(255,255,255,.7)",fontWeight:600,marginBottom:10}}>Deine Abenteuer</div>
        <h1 style={{fontSize:"clamp(1.7rem,5vw,2.2rem)",fontWeight:900,letterSpacing:"-.03em",color:"#fff",marginBottom:8}}>🧳 Meine Reisen</h1>
        <p style={{color:"rgba(255,255,255,.75)",fontSize:".88rem"}}>{savedTrips.length} gespeicherte Reise{savedTrips.length!==1?"n":""}</p>
      </div>
      <div style={{maxWidth:600,margin:"0 auto",padding:"18px 14px"}}>
        {savedTrips.length===0?(
          <div style={{textAlign:"center",padding:"60px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:14}}>
            <div style={{fontSize:"4rem"}}>🗺️</div>
            <div style={{fontWeight:900,fontSize:"1.15rem",color:"#2F4156"}}>Noch keine Reisen gespeichert</div>
            <div style={{fontSize:".88rem",color:"#567C8D",maxWidth:260,lineHeight:1.5}}>Erstelle deine erste Reise — sie erscheint dann hier.</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {savedTrips.map(t=>{
              const members=t.members||[{name:"You",avatar:"👤"}];
              const totalDays=t.days?.length||"?";
              return(
                <div key={t.id} onClick={()=>onLoadTrip(t)}
                  style={{background:"#fff",border:"1px solid #C8D9E6",borderRadius:18,overflow:"hidden",boxShadow:"0 3px 14px rgba(47,65,86,.10)",cursor:"pointer"}}>
                  {/* Hero image */}
                  <div style={{height:130,backgroundImage:`linear-gradient(rgba(44,54,90,.45),rgba(44,54,90,.72)),url(${heroImg(t.destination)})`,backgroundSize:"cover",backgroundPosition:"center",position:"relative",display:"flex",alignItems:"flex-end",padding:"14px 16px"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:"rgba(255,255,255,.75)",fontSize:".65rem",fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>{t._date}</div>
                      <div style={{color:"#fff",fontWeight:900,fontSize:"1.18rem",textShadow:"0 2px 8px rgba(0,0,0,.4)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>✈️ {t.destination}</div>
                    </div>
                    <button onClick={e=>{
                      e.stopPropagation();
                      setSavedTrips(p=>p.filter(x=>x.id!==t.id));
                    }} style={{flexShrink:0,width:32,height:32,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"none",color:"rgba(255,255,255,.85)",fontSize:".9rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",marginLeft:8}}>×</button>
                  </div>
                  {/* Info row */}
                  <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:".8rem",color:"#2F4156",fontWeight:700,background:"#EEE8DF",padding:"3px 10px",borderRadius:20}}>📅 {totalDays} Tage</span>
                      <div style={{display:"flex",alignItems:"center"}}>
                        {members.slice(0,4).map((m,idx)=>(
                          <div key={idx} title={m.name} style={{width:26,height:26,borderRadius:"50%",background:"#2F4156",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".65rem",fontWeight:800,border:"2.5px solid #fff",marginLeft:idx>0?-9:0,zIndex:4-idx,flexShrink:0}}>
                            {m.avatar||(m.name||"?")[0].toUpperCase()}
                          </div>
                        ))}
                        {members.length>4&&<span style={{fontSize:".62rem",color:"#8A9CAA",marginLeft:5}}>+{members.length-4}</span>}
                      </div>
                    </div>
                    <button onClick={e=>{
                      e.stopPropagation();
                      localStorage.setItem("tm_invite_"+t.id,JSON.stringify(t));
                      const url=window.location.origin+window.location.pathname+"?joinTrip="+t.id;
                      navigator.clipboard?.writeText(url).then(()=>alert("✅ Invite-Link kopiert!")).catch(()=>prompt("Link kopieren:",url));
                    }} style={{padding:"7px 12px",background:"#2F4156",border:"none",borderRadius:10,fontSize:".72rem",fontWeight:700,color:"#fff",fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                      👥 Einladen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App(){
  const [screen,setScreen]=useState("setup");
  const [loadMsg,setLoadMsg]=useState("Starting…");
  const [pct,setPct]=useState(0);
  const [errorMsg,setErrorMsg]=useState("");
  const [itinerary,setItinerary]=useState(null);
  const [currentForm,setCurrentForm]=useState({});
  const [savedTrips,setSavedTrips]=useState(()=>{
    try{ const s=localStorage.getItem("tm_saved"); return s?JSON.parse(s):[]; }catch(_){ return []; }
  });
  const [needsSetup,setNeedsSetup]=useState(false);
  const [bottomTab,setBottomTab]=useState("home");
  // ── Join flow: replaces window.prompt ─────────────────────────────────────
  const [joinData,setJoinData]=useState(null); // {trip, joinId}
  // Auto-persist savedTrips to localStorage
  useEffect(()=>{
    try{ localStorage.setItem("tm_saved",JSON.stringify(savedTrips)); }catch(_){}
  },[savedTrips]);
  // Check if server has API key configured (only on localhost)
  useEffect(()=>{
    const isLocal=window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1";
    if(!isLocal) return;
    fetch("/api/status").then(r=>r.json()).then(d=>{if(!d.configured) setNeedsSetup(true);}).catch(()=>{});
  },[]);
  // Load trip from URL on mount (?trip= share link OR ?joinTrip= invite link)
  useEffect(()=>{
    try{
      const params=new URLSearchParams(window.location.search);
      const b64=params.get("trip");
      if(b64){
        const payload=JSON.parse(decodeURIComponent(escape(atob(b64))));
        if(payload?.destination&&payload?.days){
          setItinerary(payload);
          setCurrentForm(payload._form||{});
          setScreen("trip");
          window.history.replaceState({},"",window.location.pathname);
          return;
        }
      }
      const joinId=params.get("joinTrip");
      if(joinId){
        window.history.replaceState({},"",window.location.pathname);
        let foundTrip=null;
        try{
          const raw=localStorage.getItem("tm_invite_"+joinId);
          if(raw) foundTrip=JSON.parse(raw);
        }catch(_){}
        if(!foundTrip){
          try{
            const all=JSON.parse(localStorage.getItem("tm_saved")||"[]");
            foundTrip=all.find(t=>String(t.id)===joinId)||null;
          }catch(_){}
        }
        if(foundTrip){
          // Show JoinScreen instead of window.prompt
          setJoinData({trip:foundTrip,joinId});
        } else {
          alert("Trip not found or link has expired.");
        }
      }
    }catch(e){ console.warn("Could not load trip from URL:",e); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  if(needsSetup) return <SetupKeyScreen onDone={()=>setNeedsSetup(false)}/>;
  // ── Join screen — shown when user opens invite link ────────────────────────
  if(joinData) return <JoinScreen tripData={joinData.trip} onJoin={(name)=>{
    const newMember={id:uid(),name:name.trim(),avatar:name.trim()[0].toUpperCase()};
    const updatedTrip={...joinData.trip,members:[...(joinData.trip.members||[{id:"u1",name:"Organiser",avatar:"O"}]),newMember]};
    // Persist new member identity under this tripId so Trip can read it
    try{localStorage.setItem("tm_user_"+(updatedTrip.id||joinData.joinId),JSON.stringify(newMember));}catch(_){}
    setItinerary(updatedTrip);
    setCurrentForm(updatedTrip._form||{});
    setJoinData(null);
    setScreen("trip");
  }}/>;


// ── Real weather via Open-Meteo (free, no key) ────────────────────────────────
async function fetchRealWeather(destination, startDate, totalDays){
  try{
    // Geocode destination to lat/lon
    const geo=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(destination)).then(r=>r.json());
    if(!geo||!geo[0]) return null;
    const {lat,lon}=geo[0];
    // Open-Meteo forecast (up to 16 days ahead)
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=${Math.min(totalDays,14)}&start_date=${startDate}`;
    const wx=await fetch(url).then(r=>r.json());
    if(!wx?.daily?.time) return null;
    // WMO weather codes → description
    function wmoDesc(code){
      if(code<=1) return "Clear";
      if(code<=3) return "Partly cloudy";
      if(code<=49) return "Fog";
      if(code<=59) return "Drizzle";
      if(code<=69) return "Rain";
      if(code<=79) return "Snow";
      if(code<=82) return "Rain showers";
      if(code<=84) return "Snow showers";
      if(code<=99) return "Thunderstorm";
      return "Mixed";
    }
    return wx.daily.time.map((date,i)=>({
      date,
      desc:wmoDesc(wx.daily.weathercode[i]),
      max:Math.round(wx.daily.temperature_2m_max[i]),
      min:Math.round(wx.daily.temperature_2m_min[i]),
      rain:(wx.daily.precipitation_sum[i]||0)>3
    }));
  }catch(e){ console.warn("Weather fetch failed:",e); return null; }
}

  async function generate(form){
    setCurrentForm(form); setErrorMsg(""); setScreen("loading"); setPct(0);
    const totalDays=Math.min(getDays(form.startDate,form.endDate)||3,21);
    const dest=form.destination;
    const hotel=form.hotel||"";
    const interests=form.interests?.length?form.interests.join(", "):"general sightseeing";
    const style=form.style||"medium";
    const transport=form.transport||"mixed";
    const profile=`${form.travelers} pax, ${form.ageGroup}, ${style} budget, ${transport} transport`;
    const hotelLine=hotel?`Hotel: ${hotel}. Only suggest places within 30 min of hotel.`:"";

    function tcFor(dn){
      const isFirst=dn===1, isLast=dn===totalDays;
      const parts=[];
      if(isFirst&&form.arrivalTime){
        const am=toMins(form.arrivalTime);
        if(am!=null){
          if(am>=1200) parts.push(`Very late arrival (${form.arrivalTime}). Only 1 activity: dinner nearby.`);
          else parts.push(`Arrival ${form.arrivalTime}. Start activities at ${fmtTime(am+60)} earliest.`);
        }
      }
      if(isLast&&form.departureTime){
        const dm=toMins(form.departureTime);
        if(dm!=null) parts.push(`Flight ${form.departureTime}. Last activity ends by ${fmtTime(dm-120)}.`);
      }
      return parts.join(" ");
    }

    function numActsFor(dn){
      const tc=tcFor(dn);
      if(tc.includes("Only 1 activity")) return 1;
      if(tc.includes("Start activities at")){
        const am=toMins(form.arrivalTime)||0;
        const h=(22*60-am-60)/60;
        return h<4?1:h<7?2:3;
      }
      if(tc.includes("Last activity ends by")){
        const dm=toMins(form.departureTime)||0;
        const h=((dm-120)-9*60)/60;
        return h<3?1:h<5?2:3;
      }
      return 3;
    }

    function buildDayPrompt(dn){
      const tc=tcFor(dn);
      const n=numActsFor(dn);
      const storedPersonality=(()=>{try{return localStorage.getItem("tm_personality")||"";}catch(_){return "";}})();
      const personalityBlock=buildPersonalityPromptBlock(storedPersonality||getDefaultPersonalityFromForm(form));
      return "You are a travel expert. Respond ONLY with a single JSON object, no markdown, no comments.\n"
        +`Plan day ${dn} of ${totalDays} in ${dest}. ${profile}. Interests: ${interests}. ${hotelLine} ${tc}\n`
        +`${personalityBlock}\n`
        +"Only include activities open at scheduled time (museums 09-18, bars 20+, restaurants lunch 12-15 dinner 19-23).\n"
        +`Include exactly ${n} activities. Make each day feel distinct from the others.\n`
        +"Return exactly:\n"
        +'{"day":'+dn+',"theme":"short 3-word theme","neighborhood":"area name",'
        +'"weatherForecast":"Sunny 22C","timeWindow":"09:00-22:00",'
        +'"budget":{"budget":"50 EUR","medium":"100 EUR","luxury":"200 EUR"},'
        +'"evening":"one sentence evening suggestion",'
        +'"lunch":{"name":"place name","cuisine":"type","price":"15 EUR","desc":"short","imgQuery":"food keyword"},'
        +'"dinner":{"name":"place name","cuisine":"type","price":"25 EUR","desc":"short","imgQuery":"food keyword"},'
        +'"activities":['
        +'{"time":"09:00","name":"place name","type":"Museum","desc":"very short desc",'
        +'"address":"street, city","duration":"2h","price":"12 EUR","isFree":false,"isHidden":false,'
        +'"openHours":"09:00-18:00","tip":"short insider tip","transport":"Metro line X","imgQuery":"3 words"}'
        +']}';
    }

    try{
      // ── Step 1: meta + all days fire in parallel ──────────────────────────
      setLoadMsg(`Planning all ${totalDays} days in parallel…`); setPct(5);

      const metaP="You are a travel expert. Respond ONLY with a single JSON object, no markdown, no comments.\n"
        +`Trip: ${dest}, ${totalDays} days, ${profile}.\n`
        +"Return exactly these keys:\n"
        +'{"destination":"","tagline":"","currency":"","language":"","emergency":"","weatherNote":"",'
        +'"transportInfo":{"description":"","officialSite":"","ticketSite":""},'
        +'"tips":["","",""],"freebies":["","",""],"gems":["",""],"packing":["","","",""]}';

      // Track per-day completion for live progress
      let doneDays=0;
      function onDayDone(){ doneDays++; setPct(10+Math.round((doneDays/totalDays)*85)); setLoadMsg(`Days ready: ${doneDays} / ${totalDays}…`); }

      // Fire everything at once
      const metaPromise=callAI(metaP,600);
      const dayPromises=[];
      for(let dn=1;dn<=totalDays;dn++){
        const p=dn; // capture
        dayPromises.push(
          callAI(buildDayPrompt(p),950)
            .then(dayData=>{
              onDayDone();
              const acts=(dayData.activities||[]).map(a=>({_id:uid(),...a}));
              return{...dayData,day:p,activities:acts};
            })
            .catch(err=>{
              // On per-day failure, return a minimal placeholder so Promise.all doesn't abort
              onDayDone();
              console.warn(`Day ${p} failed:`,err.message);
              return{day:p,theme:"Day "+p,activities:[],_failed:true};
            })
        );
      }

      // Await both together
      const [meta,...dayResults]=await Promise.all([metaPromise,...dayPromises]);
      if(!meta||!meta.destination) throw new Error("Could not load destination info – please try again");

      // Sort (parallel resolves in any order) and strip failed placeholders warning
      const allDays=dayResults.sort((a,b)=>a.day-b.day);
      const failedCount=allDays.filter(d=>d._failed).length;
      if(failedCount===allDays.length) throw new Error("All days failed to generate – please try again");

      setPct(96);
      // ── Patch with real weather if start date is within 14 days ──────────
      if(form.startDate){
        const today=new Date(); today.setHours(0,0,0,0);
        const start=new Date(form.startDate+"T00:00:00");
        const daysAhead=Math.round((start-today)/86400000);
        if(daysAhead>=0&&daysAhead<=14){
          setLoadMsg("Fetching real weather…");
          const wxData=await fetchRealWeather(dest,form.startDate,totalDays);
          if(wxData){
            allDays.forEach((d,i)=>{
              const wx=wxData[i];
              if(!wx) return;
              const label=`${wx.desc} ${wx.max}C`;
              d.weatherForecast=label;
              d._realWeather=wx; // keep raw for rain-proof trigger
            });
          }
        }
      }
      setPct(99);
      setItinerary({...meta,days:allDays});
      setScreen("trip");
    }catch(err){
      console.error("Generation error:",err);
      setErrorMsg(err.message||"Unknown error – please try again");
      setScreen("error");
    }
  }

  function saveTrip({days:currentDays,groupState:currentGroupState}={}){
    if(!itinerary) return;
    const tripId=itinerary.id||("trip_"+Date.now());
    // Include live days from Trip so edits are never lost
    const saved={...itinerary,id:tripId,_date:new Date().toLocaleDateString(),_form:currentForm,...(currentDays?{days:currentDays}:{}),...(currentGroupState?{_groupState:currentGroupState}:{})};
    setItinerary(saved);
    setSavedTrips(p=>[saved,...p.filter(t=>t.id!==tripId)]);
    alert("Trip saved to your device!");
  }

  function shareTrip({days:currentDays,groupState:currentGroupState}={}){
    if(!itinerary) return;
    try{
      const payload=JSON.stringify({...itinerary,...(currentDays?{days:currentDays}:{}),...(currentGroupState?{_groupState:currentGroupState}:{}),_form:currentForm});
      const b64=btoa(unescape(encodeURIComponent(payload)));
      const url=window.location.origin+window.location.pathname+"?trip="+b64;
      if(navigator.share){
        navigator.share({title:"My trip to "+itinerary.destination,url}).catch(()=>{});
      } else {
        navigator.clipboard.writeText(url).then(()=>alert("Share link copied to clipboard!")).catch(()=>{
          prompt("Copy this link:",url);
        });
      }
    }catch(e){ alert("Could not create share link: "+e.message); }
  }

  if(screen==="loading") return <Loading msg={loadMsg} pct={pct}/>;
  if(screen==="trip"&&itinerary) return <Trip data={itinerary} form={currentForm} onBack={()=>{setScreen("setup");setBottomTab("trips");}} onSave={saveTrip} onShare={shareTrip}/>;
  if(screen==="error") return(
    <div style={{minHeight:"100vh",background:"#fff",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:24,gap:18,textAlign:"center"}}>
      <style>{CSS}</style>
      <div style={{fontSize:"3rem"}}>⚠️</div>
      <div style={{fontSize:"1.15rem",fontWeight:900,color:"#dc2626"}}>Generation Failed</div>
      <div style={{fontSize:".88rem",color:"#567C8D",maxWidth:360,background:"#fef2f2",border:"1px solid #C8D9E6",borderRadius:10,padding:"14px 16px",lineHeight:1.6,wordBreak:"break-word"}}>{errorMsg}</div>
      <div style={{fontSize:".78rem",color:"#8A9CAA",maxWidth:320}}>Check your connection and try again.</div>
      <Btn onClick={()=>setScreen("setup")} color="#2F4156">← Try Again</Btn>
    </div>
  );
  const handleLoadTrip=(t)=>{setItinerary(t);setCurrentForm(t._form||{});setScreen("trip");};
  return(
    <div style={{paddingBottom:72}}>
      {bottomTab==="home"&&<Setup onGenerate={generate} savedTrips={savedTrips} setSavedTrips={setSavedTrips} onLoadTrip={handleLoadTrip}/>}
      {bottomTab==="trips"&&<MyTripsScreen savedTrips={savedTrips} setSavedTrips={setSavedTrips} onLoadTrip={handleLoadTrip}/>}
      <BottomNav tab={bottomTab} setTab={setBottomTab} tripsCount={savedTrips.length}/>
    </div>
  );
}

