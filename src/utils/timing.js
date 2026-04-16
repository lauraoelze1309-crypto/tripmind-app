// TripMind timing utilities
import { toMins } from './helpers.js';

export function getNowMinutes(date=new Date()){ return date.getHours()*60+date.getMinutes(); }
export function enrichActivityTiming(act){ const start=toMins(act.time),duration=parseDurationToMinutes(act.duration),end=start!=null?start+duration:null; return{...act,_live:{start,end,duration}}; }
