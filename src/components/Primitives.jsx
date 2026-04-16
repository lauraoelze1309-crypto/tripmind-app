// TripMind UI primitives
import React from 'react';

export function getInitials(name){
  if(!name) return "?";
  const parts=name.trim().split(/\s+/);
  if(parts.length===1) return parts[0][0].toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}

export function InitialsAvatar({name,size=36,fontSize=".9rem",style={}}){
  const initials=getInitials(name);
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,#111,#555)",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"#fff",fontWeight:800,fontSize,letterSpacing:"-.01em",fontFamily:'"FF Real","FF Real Text","DM Sans",system-ui,sans-serif',...style}}>
      {initials}
    </div>
  );
}

export const Lbl=({c,sub})=><div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".09em",textTransform:"uppercase",color:sub?"#8A9CAA":"#555",marginBottom:6}}>{c}</div>;
export const TIn=({value,onChange,placeholder,type,style})=><input type={type||"text"} value={value} onChange={onChange} placeholder={placeholder} style={{width:"100%",padding:"12px 13px",background:"var(--tm-surface2)",border:"1.5px solid #E8E8E8",borderRadius:9,color:"var(--tm-text)",fontFamily:"inherit",...(style||{})}}/>;
export const Chip=({label,on,onClick})=><button onClick={onClick} style={{padding:"9px 14px",minHeight:38,borderRadius:50,fontSize:".8rem",fontFamily:"inherit",background:on?"#111":"var(--tm-border)",border:"1.5px solid "+(on?"#111":"var(--tm-border)"),color:on?"#fff":"#111",whiteSpace:"nowrap"}}>{label}</button>;
export const Crd=({children,style})=><div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:18,marginBottom:13,...(style||{})}}>{children}</div>;
export const Spin=({size})=><div style={{width:size||22,height:size||22,border:"2.5px solid #E8E8E8",borderTop:"2.5px solid #555",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}}/>;
export const Btn=({children,onClick,color,disabled,full,outline})=>{
  const bg=disabled?"var(--tm-border)":outline?"#fff":(color||"#111");
  const cl=disabled?"#8A9CAA":outline?(color||"#111"):"#fff";
  return <button onClick={disabled?null:onClick} style={{padding:"13px 20px",minHeight:50,borderRadius:12,fontSize:".95rem",fontWeight:800,fontFamily:"inherit",border:outline?"1.5px solid "+(color||"#111"):"none",background:bg,color:cl,width:full?"100%":"auto"}}>{children}</button>;
};
