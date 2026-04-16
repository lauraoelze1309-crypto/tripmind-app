// TripMind day plan optimizer
import { normalizeActivity, prioritizeActivities, assignTimes, getDayStart, getDayEnd } from './helpers.js';

export function optimizeDayPlan(day,form,totalDays){
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
