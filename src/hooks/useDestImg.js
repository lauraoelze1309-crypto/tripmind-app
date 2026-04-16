// TripMind destination image hooks
import React, { useState, useEffect, useMemo } from 'react';
import { DEST_PHOTO_MAP } from '../constants/photos.js';

function heroImg(dest){
  const d=(dest||"").toLowerCase();
  const k=Object.keys(DEST_PHOTO_MAP).find(k=>d.includes(k));
  if(k) return `https://images.unsplash.com/${DEST_PHOTO_MAP[k]}?w=1200&q=85`;
  return null;
}

const _wikiImgCache=new Map();

export function useDestImg(dest){
  const mapUrl=React.useMemo(()=>heroImg(dest),[dest]);

  const [wikiUrl,setWikiUrl]=React.useState(()=>{
    const key=(dest||"").toLowerCase().trim();
    return _wikiImgCache.has(key)?_wikiImgCache.get(key):null;
  });

  React.useEffect(()=>{
    if(mapUrl||!dest) return;
    const key=(dest||"").toLowerCase().trim();
    if(_wikiImgCache.has(key)){ setWikiUrl(_wikiImgCache.get(key)); return; }
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(dest)}`)
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        let url=data?.thumbnail?.source||null;
        // Replace low-res thumbnail size with a high-res version (1200px wide)
        if(url) url=url.replace(/\/\d+px-/,'/1200px-');
        _wikiImgCache.set(key,url);
        setWikiUrl(url);
      })
      .catch(()=>{ _wikiImgCache.set(key,null); });
  },[dest,mapUrl]);

  // Return: Unsplash map photo > Wikipedia landmark photo > generic fallback
  return mapUrl||wikiUrl||`https://source.unsplash.com/featured/1200x900/?${encodeURIComponent((dest||'')+'  landmark travel')}&sig=${encodeURIComponent(dest||'')}`;
}
export function DestPhotoBg({dest,gradient,style,children}){
  const imgUrl=useDestImg(dest);
  const bg=gradient?`${gradient},url(${imgUrl})`:`url(${imgUrl})`;
  return(
    <div style={{backgroundSize:"cover",backgroundPosition:"center",...style,backgroundImage:bg}}>
      {children}
    </div>
  );
}
