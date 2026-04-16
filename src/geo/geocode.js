// TripMind geocoding and route optimization
export function haversineKm(a,b){
  const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
  const lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.sin(dLng/2)**2*Math.cos(lat1)*Math.cos(lat2);
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
export function estimateTravelMinutes(km,transport="mixed"){
  if(transport==="walking") return Math.max(8,Math.round(km*14));
  if(transport==="car") return Math.max(6,Math.round(km*3.2));
  if(transport==="public") return Math.max(10,Math.round(km*6.5));
  return Math.max(8,Math.round(km*5));
}
export const _geoCache=new Map();
