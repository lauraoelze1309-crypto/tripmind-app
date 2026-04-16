// TripMind realtime sync hook
import { useState, useEffect, useRef } from 'react';

export function getSbConfig(){
  try{
    return{
      url:localStorage.getItem("tm_sb_url")||"",
      key:localStorage.getItem("tm_sb_key")||""
    };
  }catch(_){ return{url:"",key:""}; }
}
export function useTripSync(tripId,initialDays){
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
  function moveActivityToDay(fromDayIdx,actId,toDayIdx){
    if(fromDayIdx===toDayIdx) return;
    mutate(prev=>{
      const act=prev[fromDayIdx]?.activities?.find(a=>(a._id||a.name)===actId);
      if(!act) return prev;
      return prev.map((d,i)=>{
        if(i===fromDayIdx) return{...d,activities:d.activities.filter(a=>(a._id||a.name)!==actId)};
        if(i===toDayIdx)   return{...d,activities:[...d.activities,{...act,time:""}]};
        return d;
      });
    });
  }
  function replaceDays(updaterFn){ mutate(updaterFn); }

  // local-only setter — no cloud push, used for ephemeral realtime annotations
  function setDaysLocal(updaterFn){ setDays(updaterFn); }
  return{days,setDays:mutate,setDaysLocal,addActivity,removeActivity,reorderActivities,moveActivityToDay,replaceDays,syncStatus,syncError,cloudEnabled};
}
