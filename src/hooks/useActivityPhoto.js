// TripMind activity photo hooks
import { useState, useEffect } from 'react';
import { GOOGLE_PLACES_KEY } from '../constants/config.js';
import { actImg } from '../utils/helpers.js';

const _photoCache=new Map();
async function _fetchPlacePhoto(query,key){
  if(!key||key==="PASTE_YOUR_KEY_HERE") return null;
  const ck=query.toLowerCase().trim().slice(0,60);
  if(_photoCache.has(ck)) return _photoCache.get(ck);
  _photoCache.set(ck,null); // lock to prevent duplicate fetches
  try{
    const r=await fetch("https://places.googleapis.com/v1/places:searchText",{
      method:"POST",
      headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"places.photos"},
      body:JSON.stringify({textQuery:query,maxResultCount:1})
    });
    const d=await r.json();
    const pn=d?.places?.[0]?.photos?.[0]?.name;
    if(pn){
      const url=`https://places.googleapis.com/v1/${pn}/media?maxWidthPx=800&key=${key}`;
      _photoCache.set(ck,url);
      return url;
    }
  }catch(_){}
  return null;
}
function useActivityPhoto(imgQuery,name){
  const fallback=actImg(imgQuery||name);
  const [src,setSrc]=useState(fallback);
  useEffect(()=>{
    let cancelled=false;
    const q=(imgQuery||name||"").trim();
    if(!q) return;
    if(!GOOGLE_PLACES_KEY||GOOGLE_PLACES_KEY==="PASTE_YOUR_KEY_HERE") return;
    const ck=q.toLowerCase().slice(0,60);
    if(_photoCache.has(ck)&&_photoCache.get(ck)){setSrc(_photoCache.get(ck));return;}
    _fetchPlacePhoto(q,GOOGLE_PLACES_KEY).then(url=>{if(!cancelled&&url) setSrc(url);});
    return()=>{cancelled=true;};
  },[imgQuery,name]);
  return [src,()=>setSrc(fallback)];
}
export { useActivityPhoto };
