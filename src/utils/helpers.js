// TripMind pure helper/utility functions
export function getUserProfile(){ try{ return JSON.parse(localStorage.getItem("tm_user")||"{}"); }catch(_){ return {}; } }
export function getInitials(name){
  if(!name) return "?";
  const parts=name.trim().split(/\s+/);
  if(parts.length===1) return parts[0][0].toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}
export function picsum(seed, w, h){ return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w||600}/${h||400}`; }
export function actImg(q){ return picsum((q||"travel").toLowerCase().replace(/\s+/g,"-").slice(0,40),600,400); }
export function typeEmoji(t){
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
export function getDays(s,e){ if(!s||!e) return 0; return Math.max(1,Math.round((new Date(e)-new Date(s))/86400000)+1); }
export function fmtDate(d){ if(!d) return ""; return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
export function uid(){ return "_"+Math.random().toString(36).slice(2,9); }
export function toMins(t){ if(!t) return null; const p=(t+"").split(":").map(Number); return isNaN(p[0])?null:p[0]*60+(p[1]||0); }
export function fmtTime(m){ if(m==null) return ""; return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"); }
export function parseEuro(price){
  if(!price) return 0;
  const s=String(price).replace(",",".").toLowerCase();
  if(s.includes("free")) return 0;
  const match=s.match(/(\d+(\.\d+)?)/);
  return match?Number(match[1]):0;
}
export function parseDurationToMinutes(duration){
  if(!duration) return 90;
  const s=String(duration).toLowerCase();
  const h=s.match(/(\d+)\s*h/); const m=s.match(/(\d+)\s*m/);
  let mins=0;
  if(h) mins+=Number(h[1])*60;
  if(m) mins+=Number(m[1]);
  if(!mins){ if(s.includes("half day")) return 240; if(s.includes("full day")) return 480; return 90; }
  return mins;
}
export function isOutdoorActivity(act){
  const t=`${act?.type||""} ${act?.name||""} ${act?.desc||""}`.toLowerCase();
  return ["park","garden","beach","viewpoint","hike","walking","nature","market","photography","architecture","boat","outdoor"].some(k=>t.includes(k));
}
export function isIndoorActivity(act){
  const t=`${act?.type||""} ${act?.name||""} ${act?.desc||""}`.toLowerCase();
  return ["museum","gallery","cafe","restaurant","spa","shopping","mall","cathedral","church","cinema","theater","indoor"].some(k=>t.includes(k));
}
export function isDining(act){
  const t=`${act?.type||""} ${act?.name||""}`.toLowerCase();
  return ["restaurant","dining","bistro","brasserie","cafe","bar","cocktail"].some(k=>t.includes(k));
}
export function weatherLooksRainy(wf){ return ["rain","storm","shower","thunder"].some(k=>String(wf||"").toLowerCase().includes(k)); }
export function weatherLooksHot(wf){ const m=String(wf||"").match(/(-?\d+)/); const t=m?Number(m[1]):null; return t!=null&&t>=28; }
export function museumLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["museum","gallery","cathedral","church","palace","castle"].some(k=>t.includes(k)); }
export function viewpointLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["viewpoint","rooftop","sunset","tower","lookout"].some(k=>t.includes(k)); }
export function nightlifeLike(act){ const t=`${act?.type||""} ${act?.name||""}`.toLowerCase(); return ["bar","club","nightlife","cocktail","pub","live music"].some(k=>t.includes(k)); }
export function downloadTextFile(filename,content){
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
export function weatherStyle(f){
  const m=(f||"").match(/(-?\d+)/); const t=m?parseInt(m[1]):null;
  if(t===null) return {bg:"var(--tm-border)",bd:"var(--tm-border)",c:"#555"};
  if(t>=20)    return {bg:"var(--tm-surface)",bd:"var(--tm-border)",c:"#111"};
  if(t>=10)    return {bg:"var(--tm-border)",bd:"#555",c:"#111"};
  return {bg:"var(--tm-border)",bd:"var(--tm-border)",c:"#555"};
}
export function computeDayBudget(day){
  const acts=(day.activities||[]).reduce((s,a)=>s+parseEuro(a.price),0);
  return{activities:acts,lunch:parseEuro(day.lunch?.price),dinner:parseEuro(day.dinner?.price),total:acts+parseEuro(day.lunch?.price)+parseEuro(day.dinner?.price)};
}
export function computeTripBudget(days){
  return days.reduce((acc,day)=>{const d=computeDayBudget(day);acc.activities+=d.activities;acc.lunch+=d.lunch;acc.dinner+=d.dinner;acc.total+=d.total;return acc;},{activities:0,lunch:0,dinner:0,total:0});
}
export function scoreActivity(act,context){
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
export function getDayStart(day,form){
  if(day?.day===1&&form?.arrivalTime){const a=toMins(form.arrivalTime);if(a!=null)return Math.min(a+60,18*60);}
  return 9*60;
}
export function getDayEnd(day,form,totalDays){
  if(day?.day===totalDays&&form?.departureTime){const d=toMins(form.departureTime);if(d!=null)return Math.max(d-120,10*60);}
  return 22*60;
}
export function getTimeBlocks(dayStart,dayEnd){
  const blocks=[];
  const morningStart=dayStart,middayStart=Math.max(dayStart,12*60),afternoonStart=Math.max(dayStart,15*60),eveningStart=Math.max(dayStart,19*60);
  if(morningStart<Math.min(dayEnd,12*60)) blocks.push({label:"morning",start:morningStart});
  if(middayStart<Math.min(dayEnd,15*60)) blocks.push({label:"midday",start:middayStart});
  if(afternoonStart<Math.min(dayEnd,19*60)) blocks.push({label:"afternoon",start:afternoonStart});
  if(eveningStart<dayEnd) blocks.push({label:"evening",start:eveningStart});
  return blocks;
}
export function normalizeActivity(act,idx){
  const durationMins=parseDurationToMinutes(act.duration);
  const explicitStart=toMins(act.time);
  return{...act,_engine:{originalIndex:idx,durationMins,explicitStart,outdoor:isOutdoorActivity(act),indoor:isIndoorActivity(act),dining:isDining(act)}};
}
export function stableSortByScore(list,getScore){
  return [...list].map((item,index)=>({item,index,score:getScore(item)})).sort((a,b)=>b.score!==a.score?b.score-a.score:a.index-b.index).map(x=>x.item);
}
export function assignTimes(activities,dayStart,dayEnd){
  let cursor=dayStart;
  return activities.map(act=>{
    const dur=act._engine.durationMins;
    const start=act.locked&&act._engine.explicitStart!=null?Math.max(act._engine.explicitStart,cursor):cursor;
    const end=start+dur;
    cursor=end+20;
    return{...act,time:fmtTime(start),endTime:fmtTime(end),conflict:end>dayEnd,_engine:{...act._engine,start,end}};
  });
}
export function prioritizeActivities(activities,weatherForecast,dayStart,dayEnd){
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
export function buildAlternativePlan(day,mode){
  const acts=[...(day.activities||[])];
  if(mode==="budget") return{...day,altMode:"budget",activities:acts.map(a=>parseEuro(a.price)<=20?a:{...a,alternativeFlag:true,desc:`${a.desc||""} Budget-friendly alternative recommended.`})};
  if(mode==="relaxed") return{...day,altMode:"relaxed",activities:acts.slice(0,Math.max(1,acts.length-1))};
  if(mode==="fast") return{...day,altMode:"fast",activities:acts.map(a=>({...a,duration:"1h"}))};
  if(mode==="rainy") return{...day,altMode:"rainy",activities:[...acts].sort((a,b)=>(isOutdoorActivity(a)?1:0)-(isOutdoorActivity(b)?1:0))};
  return day;
}
export function buildTripText(data,form,days){
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
export function exportTripAsPrintableHTML(data,form,days){
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>TripMind - ${data.destination}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#222}h1{margin-bottom:4px}.muted{color:#666;margin-bottom:20px}.day{margin:28px 0;padding-bottom:16px;border-bottom:1px solid #ddd}.act{margin:8px 0;padding:8px 0}</style></head>
<body><h1>${data.destination}</h1>
<div class="muted">Travelers: ${form.travelers||"-"} · Style: ${form.style||"-"} · Transport: ${form.transport||"-"}</div>
${days.map(day=>`<div class="day"><h2>Day ${day.day}: ${day.theme||""}</h2><div>${day.weatherForecast||""}</div>${(day.activities||[]).map(act=>`<div class="act"><strong>${act.time||"--:--"} - ${act.name}</strong><br/>${act.type||""}<br/>${act.address||""}<br/>${act.price||""}</div>`).join("")}</div>`).join("")}
<script>window.onload=()=>window.print();</script></body></html>`;
  const win=window.open("","_blank"); win.document.write(html); win.document.close();
}
export async function shareTripText(data,form,days){
  const text=buildTripText(data,form,days);
  if(navigator.share){ await navigator.share({title:`TripMind - ${data.destination}`,text}); return; }
  await navigator.clipboard.writeText(text);
  alert("Trip copied to clipboard.");
}
export function weatherLooksCold(wf){ const m=String(wf||"").match(/(-?\d+)/),t=m?Number(m[1]):null; return t!=null&&t<=8; }
