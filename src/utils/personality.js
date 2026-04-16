// TripMind personality engine utilities
import { TRIP_PERSONALITIES } from '../constants/personalities.js';

export function getDefaultPersonalityFromForm(form){
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
export function applyTripPersonalityToDay(day,form,personalityId,totalDays){
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
export function applyTripPersonalityToTrip(days,form,personalityId){
  return days.map(d=>applyTripPersonalityToDay(d,{...form,personalityId},personalityId,days.length));
}
export function buildPersonalityPromptBlock(personalityId){
  const p=TRIP_PERSONALITIES[personalityId]||TRIP_PERSONALITIES.explorer;
  return `Trip personality: ${p.label} — ${p.description} Pace: ${p.pace}. Preferred dining: ${p.diningStyle}. Prioritize activity types: ${p.activityBias.join(", ")}.`;
}
