// TripMind budget enforcement
import { parseEuro, computeDayBudget, computeTripBudget } from './helpers.js';

export function adjustDaysToBudget(days,totalLimit){
  const currentTotal=computeTripBudget(days).total;
  if(currentTotal<=totalLimit) return days;
  let toSave=currentTotal-totalLimit;

  // Deep-clone so we don't mutate original state
  const newDays=days.map(d=>({
    ...d,
    activities:(d.activities||[]).map(a=>({...a})),
    lunch:d.lunch?{...d.lunch}:d.lunch,
    dinner:d.dinner?{...d.dinner}:d.dinner,
  }));

  // Build candidate cuts: each has a saving amount and an apply() that mutates newDays
  const candidates=[];
  newDays.forEach((d)=>{
    // Activities: remove entirely (most expensive first)
    (d.activities||[]).forEach((a)=>{
      const p=parseEuro(a.price);
      if(p>0&&!a.locked) candidates.push({saving:p,apply:()=>{a._remove=true;}});
    });
    // Dinner: downgrade to max €12 if more expensive
    if(d.dinner){
      const p=parseEuro(d.dinner.price);
      const cheap=12;
      if(p>cheap) candidates.push({saving:p-cheap,apply:()=>{
        d.dinner={...d.dinner,name:"Lokales Restaurant / Imbiss",price:`€${cheap}`,desc:"Budgetfreundliche Abendoption"};
      }});
    }
    // Lunch: downgrade to max €8 if more expensive
    if(d.lunch){
      const p=parseEuro(d.lunch.price);
      const cheap=8;
      if(p>cheap) candidates.push({saving:p-cheap,apply:()=>{
        d.lunch={...d.lunch,name:"Streetfood / lokales Café",price:`€${cheap}`,desc:"Budgetfreundliche Mittagsoption"};
      }});
    }
  });

  // Cut most-expensive items first
  candidates.sort((a,b)=>b.saving-a.saving);
  for(const c of candidates){
    if(toSave<=0) break;
    c.apply();
    toSave-=c.saving;
  }

  // Strip removed activities and return
  return newDays.map(d=>({...d,activities:d.activities.filter(a=>!a._remove)}));
}
export function adjustDayToBudget(day,dayLimit){
  const current=computeDayBudget(day);
  if(current.total<=dayLimit) return day;
  return adjustDaysToBudget([day],dayLimit)[0];
}
