// TripMind Hidden Gems Engine
import { uid } from './helpers.js';
import { weatherLooksRainy } from './helpers.js';

export function gemTextOf(p){ return[p?.name||"",p?.type||"",p?.desc||"",p?.address||"",p?.editorialSummary||""].join(" ").toLowerCase(); }
export function hasAny(text,arr){ return arr.some(x=>text.includes(x)); }
export function parsePriceLevel(priceText){
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
export function _gemIsIndoor(p){ return hasAny(gemTextOf(p),["museum","gallery","bookstore","cafe","coffee","restaurant","bistro","workshop","market hall","cathedral","church","cinema","spa"]); }
export function _gemIsOutdoor(p){ return hasAny(gemTextOf(p),["park","garden","beach","viewpoint","walk","hike","river","lake","square","market","outdoor","lookout"]); }
export function isTouristy(p){ return hasAny(gemTextOf(p),["top attraction","must-see","most famous","world-famous","iconic","main attraction","tourist hotspot","very crowded","highly touristic"]); }
export function looksHiddenGem(p){ return hasAny(gemTextOf(p),["hidden gem","local favorite","locals love","quiet","tucked away","off the beaten path","neighborhood spot","independent","small gallery","artisan","family-run","less crowded"]); }
export function categoryFit(p,interests=[]){
  const t=gemTextOf(p); let score=0;
  const map={"Food & Dining":["restaurant","cafe","bakery","food","wine","bar","bistro"],"Culture":["culture","museum","gallery","theater","music","history"],"History":["history","historic","cathedral","church","palace","fort"],"Nightlife":["bar","cocktail","club","live music","nightlife","pub"],"Nature":["park","garden","lake","river","beach","hike"],"Art":["art","gallery","museum","atelier","studio"],"Shopping":["market","boutique","shop","vintage","design store"],"Hidden Spots":["hidden gem","quiet","off the beaten path","locals love"],"Architecture":["architecture","cathedral","palace","facade","tower"],"Sports":["stadium","sports","climbing","surf","fitness"],"Wellness":["spa","wellness","sauna","yoga"],"Photography":["viewpoint","sunset","lookout","scenic","photography"]};
  for(const i of interests){ const keys=map[i]||[]; if(hasAny(t,keys)) score+=8; }
  return score;
}
export function styleFit(p,style="medium"){
  const level=parsePriceLevel(p.price||p.priceLevel||"");
  if(style==="budget"){ if(level<=1) return 8; if(level===2) return 2; return -8; }
  if(style==="luxury"){ if(level>=3) return 8; if(level===2) return 2; return -4; }
  return 3;
}
export function timeFit(p,period="afternoon"){
  const t=gemTextOf(p); let score=0;
  if(period==="morning"){ if(hasAny(t,["cafe","bakery","market","walk","garden"])) score+=8; if(hasAny(t,["club","cocktail","nightlife"])) score-=10; }
  if(period==="midday"){ if(hasAny(t,["restaurant","market","museum","gallery"])) score+=8; }
  if(period==="afternoon"){ if(hasAny(t,["gallery","museum","viewpoint","design store"])) score+=7; }
  if(period==="evening"){ if(hasAny(t,["bar","cocktail","wine","live music","restaurant"])) score+=10; if(hasAny(t,["cathedral","museum"])) score-=4; }
  return score;
}
export function gemWeatherFit(p,wf){
  if(!weatherLooksRainy(wf)) return 0;
  if(_gemIsIndoor(p)) return 10;
  if(_gemIsOutdoor(p)) return -12;
  return 0;
}
export function uniquenessPenalty(p,existing=[]){
  const t=gemTextOf(p); let penalty=0;
  for(const act of existing){
    const a=gemTextOf(act); if(!a) continue;
    if((t.includes("museum")&&a.includes("museum"))||(t.includes("gallery")&&a.includes("gallery"))||(t.includes("restaurant")&&a.includes("restaurant"))||(t.includes("bar")&&a.includes("bar"))||(t.includes("viewpoint")&&a.includes("viewpoint"))) penalty+=5;
  }
  return penalty;
}
export function scoreHiddenGem(p,context){
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
export function rankHiddenGems(places,context){
  return [...(places||[])].map((p,i)=>({...p,hiddenGemScore:scoreHiddenGem(p,context),_idx:i})).sort((a,b)=>b.hiddenGemScore!==a.hiddenGemScore?b.hiddenGemScore-a.hiddenGemScore:a._idx-b._idx).map(({_idx,...rest})=>rest);
}
export function selectTopHiddenGems(places,context,limit=4){
  return rankHiddenGems(places,context).filter(p=>p.hiddenGemScore>0).slice(0,limit).map(p=>({
    _id:p._id||uid(),name:p.name||"Hidden gem",type:p.type||"Place",desc:p.desc||p.editorialSummary||"",address:p.address||p.formattedAddress||"",duration:p.duration||"1h 30m",time:p.time||"",price:p.price||"Free",isFree:!!p.isFree||String(p.price||"").toLowerCase().includes("free"),
    openHours:p.openHours||"",tip:p.tip||"Less obvious pick chosen for better local fit and lower tourist density.",imgQuery:p.imgQuery||p.name||"hidden gem",rating:p.rating||null,hiddenGemScore:p.hiddenGemScore,hiddenGem:true
  }));
}
