// TripMind dark mode hook
import { useState, useEffect } from 'react';

export function useDarkMode(){
  const [dark,setDark]=useState(()=>{
    try{
      const saved=localStorage.getItem("tm_theme");
      if(saved==="dark") return true;
      if(saved==="light") return false;
    }catch(_){}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches||false;
  });
  useEffect(()=>{
    const html=document.documentElement;
    html.setAttribute("data-theme",dark?"dark":"light");
    try{localStorage.setItem("tm_theme",dark?"dark":"light");}catch(_){}
  },[dark]);
  useEffect(()=>{
    const mq=window.matchMedia?.("(prefers-color-scheme: dark)");
    if(!mq) return;
    function onChange(e){
      // Only follow system if user hasn't manually overridden
      const saved=localStorage.getItem("tm_theme");
      if(!saved) setDark(e.matches);
    }
    mq.addEventListener("change",onChange);
    return()=>mq.removeEventListener("change",onChange);
  },[]);
  return [dark,setDark];
}
