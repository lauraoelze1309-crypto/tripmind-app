// TripMind group planning panel
import { useState } from 'react';

export function GroupPlanningPanel({groupState,currentDay,currentUserId,destination,tripId,tripData,onAddMember,onRemoveMember,onAddSuggestion,onVoteSuggestion,onClearSuggestionVote,onSetSuggestionStatus,onDeleteSuggestion,onAddComment,onMergeApproved,onVoteActivity}){
  const [memberName,setMemberName]=useState("");
  const [title,setTitle]=useState("");
  const [type,setType]=useState("Restaurant");
  const [notes,setNotes]=useState("");
  const [commentDrafts,setCommentDrafts]=useState({});
  const [inviteCopied,setInviteCopied]=useState(false);
  const dayNumber=currentDay?.day;
  const suggestions=getSuggestionsForDay(groupState,dayNumber);
  const approvedCount=suggestions.filter(s=>s.status==="approved").length;
  const isSolo=groupState.members.length<2;

  function submitSuggestion(){
    if(!title.trim()) return;
    onAddSuggestion({dayNumber,title,type,notes,destination});
    setTitle("");setType("Restaurant");setNotes("");
  }
  function submitComment(suggestionId){
    const text=commentDrafts[suggestionId]||""; if(!text.trim()) return;
    onAddComment(suggestionId,text);
    setCommentDrafts(p=>({...p,[suggestionId]:""}));
  }
  function copyInviteLink(){
    const id=tripId||tripData?.id||Date.now();
    const url=window.location.origin+window.location.pathname+"?joinTrip="+id;
    try{localStorage.setItem("tm_invite_"+id,JSON.stringify({...tripData,id}));}catch(_){}
    navigator.clipboard?.writeText(url).then(()=>{
      setInviteCopied(true); setTimeout(()=>setInviteCopied(false),2500);
    }).catch(()=>prompt("Link kopieren:",url));
  }

  return(
    <div className="fu" style={{display:"grid",gap:14}}>
      {/* Header */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div>
            <div style={{fontWeight:800,marginBottom:4}}>👥 Gruppenplanung — Tag {dayNumber}</div>
            <div style={{fontSize:".8rem",color:"var(--tm-text2)"}}>Vorschläge machen, abstimmen, diskutieren — genehmigte Ideen kommen ins Programm.</div>
          </div>
          <button onClick={copyInviteLink} style={{flexShrink:0,padding:"8px 12px",borderRadius:10,border:"none",background:inviteCopied?"#16a34a":"#111",color:"#fff",fontWeight:700,fontSize:".75rem",fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",transition:"background .2s"}}>
            {inviteCopied?"✓ Kopiert!":"🔗 Einladen"}
          </button>
        </div>
      </div>
      {/* Solo invite prompt */}
      {isSolo&&<div style={{background:"linear-gradient(135deg,#F7F7F7,#EFEFEF)",border:"1.5px dashed #CDCDCD",borderRadius:14,padding:20,textAlign:"center"}}>
        <div style={{fontSize:"2rem",marginBottom:8}}>🧳</div>
        <div style={{fontWeight:800,fontSize:"1rem",color:"var(--tm-text)",marginBottom:6}}>Lade Mitreisende ein</div>
        <div style={{fontSize:".8rem",color:"var(--tm-text2)",lineHeight:1.6,marginBottom:14}}>Sobald jemand beitritt, können alle Vorschläge machen und abstimmen — gemeinsam plant es sich besser.</div>
        <button onClick={copyInviteLink} style={{padding:"11px 20px",borderRadius:12,border:"none",background:inviteCopied?"#16a34a":"#111",color:"#fff",fontWeight:800,fontSize:".9rem",fontFamily:"inherit",cursor:"pointer",transition:"background .2s"}}>
          {inviteCopied?"✓ Link kopiert!":"🔗 Einlade-Link kopieren"}
        </button>
      </div>}
      {/* Members */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Travel Group</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {groupState.members.map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:999,background:m.id===currentUserId?"var(--tm-border)":"var(--tm-border)",border:"1px solid #E8E8E8"}}>
              <span style={{fontSize:".78rem",fontWeight:700}}>{m.id===currentUserId?"✓ ":""}{m.name}{m.role==="owner"?" · owner":""}</span>
              {m.role!=="owner"&&<button onClick={()=>onRemoveMember(m.id)} style={{border:"none",background:"transparent",color:"var(--tm-text3)",cursor:"pointer",fontWeight:700,fontSize:".85rem",lineHeight:1}}>×</button>}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={memberName} onChange={e=>setMemberName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&memberName.trim()){onAddMember(memberName);setMemberName("");}}} placeholder="Add traveler name…" style={{flex:1,padding:"10px 12px",borderRadius:10,border:"1px solid #E8E8E8",fontFamily:"inherit",fontSize:"16px"}}/>
          <button onClick={()=>{if(memberName.trim()){onAddMember(memberName);setMemberName("");}}} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",minHeight:44}}>Add</button>
        </div>
      </div>
      {/* Suggest form */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Suggest something for Day {dayNumber}</div>
        <div style={{display:"grid",gap:8}}>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Rooftop bar, museum, brunch place…" style={{padding:"10px 12px",borderRadius:10,border:"1px solid #E8E8E8",fontFamily:"inherit",fontSize:"16px"}}/>
          <select value={type} onChange={e=>setType(e.target.value)} style={{padding:"10px 12px",borderRadius:10,border:"1px solid #E8E8E8",fontFamily:"inherit"}}>
            {["Restaurant","Cafe","Bar","Museum","Viewpoint","Shopping","Wellness","Activity"].map(t=><option key={t}>{t}</option>)}
          </select>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Why does this fit the group?" style={{padding:"10px 12px",borderRadius:10,border:"1px solid #E8E8E8",fontFamily:"inherit",resize:"none"}}/>
          <button onClick={submitSuggestion} disabled={!title.trim()} style={{padding:"11px 14px",borderRadius:10,border:"none",background:title.trim()?"#555":"var(--tm-border)",color:"#fff",fontWeight:700,fontFamily:"inherit",minHeight:44}}>Submit suggestion</button>
        </div>
      </div>
      {/* Suggestions list */}
      <div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12}}>
          <div>
            <div style={{fontWeight:800}}>Group Suggestions</div>
            <div style={{fontSize:".75rem",color:"var(--tm-text2)",marginTop:3}}>{suggestions.length} total · {approvedCount} approved</div>
          </div>
          {approvedCount>0&&<button onClick={onMergeApproved} style={{padding:"9px 12px",borderRadius:10,border:"none",background:"#111",color:"#fff",fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>Add approved to itinerary</button>}
        </div>
        {!suggestions.length&&<div style={{textAlign:"center",padding:"20px 0",fontSize:".82rem",color:"var(--tm-text3)"}}>No suggestions yet. Be the first!</div>}
        <div style={{display:"grid",gap:12}}>
          {suggestions.map(s=>{
            const myVote=s.votes?.[currentUserId]||0;
            const score=scoreVotes(s.votes);
            const isApproved=s.status==="approved";
            const isRejected=s.status==="rejected";
            const comments=groupState.commentsBySuggestionId[s.id]||[];
            return(
              <div key={s.id} style={{border:"1.5px solid "+(isApproved?"#555":isRejected?"#fecaca":"var(--tm-border)"),borderRadius:12,padding:12,background:isApproved?"var(--tm-surface)":isRejected?"#fef2f2":"var(--tm-surface)",position:"relative",opacity:isRejected?.6:1}}>
                {isApproved&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,borderRadius:"12px 12px 0 0",background:"#555"}}/>}
                <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:".9rem"}}>{typeEmoji(s.type)} {s.title}</div>
                    <div style={{fontSize:".7rem",color:"var(--tm-text3)",marginTop:2}}>{s.type} · by {getMemberName(groupState,s.createdBy)} · {new Date(s.createdAt).toLocaleDateString()}</div>
                  </div>
                  <span style={{padding:"3px 9px",borderRadius:50,fontSize:".68rem",fontWeight:700,flexShrink:0,background:isApproved?"var(--tm-border)":isRejected?"#fef2f2":"var(--tm-border)",color:isApproved?"#111":isRejected?"#dc2626":"#555",border:"1px solid "+(isApproved?"var(--tm-border)":isRejected?"#fecaca":"var(--tm-border)"),height:"fit-content"}}>
                    {isApproved?"✓ Approved":isRejected?"✗ Rejected":"Pending"}
                  </span>
                </div>
                {s.notes&&<p style={{fontSize:".78rem",color:"var(--tm-text2)",lineHeight:1.5,margin:"0 0 8px"}}>{s.notes}</p>}
                {/* Vote row */}
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                  <button onClick={()=>myVote===1?onClearSuggestionVote(s.id):onVoteSuggestion(s.id,1)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(myVote===1?"#111":"var(--tm-border)"),background:myVote===1?"var(--tm-border)":"#fff",fontWeight:700,fontFamily:"inherit"}}>👍</button>
                  <span style={{fontSize:".85rem",fontWeight:900,color:score>0?"#111":score<0?"#dc2626":"#8A9CAA",minWidth:22,textAlign:"center"}}>{score>0?"+":""}{score}</span>
                  <button onClick={()=>myVote===-1?onClearSuggestionVote(s.id):onVoteSuggestion(s.id,-1)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(myVote===-1?"#dc2626":"var(--tm-border)"),background:myVote===-1?"#fef2f2":"#fff",fontWeight:700,fontFamily:"inherit"}}>👎</button>
                  <div style={{flex:1}}/>
                  {!isApproved&&<button onClick={()=>onSetSuggestionStatus(s.id,"approved")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:"#555",color:"#fff",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>✓ Approve</button>}
                  {!isRejected&&<button onClick={()=>onSetSuggestionStatus(s.id,"rejected")} style={{padding:"5px 10px",borderRadius:7,border:"none",background:"var(--tm-surface2)",color:"var(--tm-text3)",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>✗ Reject</button>}
                  {(isApproved||isRejected)&&<button onClick={()=>onSetSuggestionStatus(s.id,"pending")} style={{padding:"5px 8px",borderRadius:7,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text2)",fontSize:".72rem",fontFamily:"inherit"}}>↺ Reset</button>}
                  <button onClick={()=>onDeleteSuggestion(s.id)} style={{padding:"5px 8px",borderRadius:7,border:"1px solid #E8E8E8",background:"var(--tm-bg)",color:"var(--tm-text3)",fontSize:".72rem",fontFamily:"inherit"}}>🗑</button>
                </div>
                {/* Voter summary */}
                {Object.keys(s.votes||{}).length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
                  {Object.entries(s.votes).filter(([,v])=>v!==0).map(([mid,v])=>(
                    <span key={mid} style={{fontSize:".62rem",padding:"1px 7px",borderRadius:50,background:v===1?"var(--tm-border)":"#fef2f2",color:v===1?"#111":"#dc2626",border:"1px solid "+(v===1?"var(--tm-border)":"#fecaca"),fontWeight:600}}>{v===1?"▲":"▼"} {getMemberName(groupState,mid)}</span>
                  ))}
                </div>}
                {/* Comments */}
                {comments.length>0&&<div style={{marginBottom:8,display:"flex",flexDirection:"column",gap:4}}>
                  {comments.map(c=>(
                    <div key={c.id} style={{fontSize:".74rem",color:"var(--tm-text2)",padding:"5px 9px",background:"var(--tm-surface2)",borderRadius:7}}>
                      <b>{getMemberName(groupState,c.memberId)}</b>: {c.text}
                    </div>
                  ))}
                </div>}
                <div style={{display:"flex",gap:7}}>
                  <input value={commentDrafts[s.id]||""} onChange={e=>setCommentDrafts(p=>({...p,[s.id]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&(commentDrafts[s.id]||"").trim()) submitComment(s.id);}} placeholder="Add a comment…" style={{flex:1,padding:"6px 9px",borderRadius:8,border:"1px solid #E8E8E8",fontSize:".75rem",fontFamily:"inherit"}}/>
                  <button onClick={()=>submitComment(s.id)} style={{padding:"6px 10px",borderRadius:8,border:"none",background:"#111",color:"#fff",fontSize:".72rem",fontWeight:700,fontFamily:"inherit"}}>Send</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Vote on current itinerary */}
      {(currentDay?.activities||[]).length>0&&<div style={{background:"var(--tm-bg)",border:"1px solid #E8E8E8",borderRadius:14,padding:16}}>
        <div style={{fontWeight:800,marginBottom:10}}>Vote on today's itinerary</div>
        <div style={{display:"grid",gap:8}}>
          {(currentDay.activities||[]).map(a=>{
            const actId=a._id||a.name;
            const actScore=getActivityVoteScore(groupState,dayNumber,actId);
            return(
              <div key={actId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"var(--tm-surface)",border:"1px solid #E8E8E8"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:".84rem"}}>{typeEmoji(a.type)} {a.name}</div>
                  <div style={{fontSize:".73rem",color:"var(--tm-text2)"}}>{a.time||"--:--"} · {a.type||"Activity"}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <button onClick={()=>onVoteActivity(actId,1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #E8E8E8",background:"var(--tm-bg)",fontFamily:"inherit"}}>👍</button>
                  <span style={{fontSize:".8rem",fontWeight:700,color:actScore>0?"#111":actScore<0?"#dc2626":"#8A9CAA",minWidth:18,textAlign:"center"}}>{actScore>0?"+":""}{actScore}</span>
                  <button onClick={()=>onVoteActivity(actId,-1)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #E8E8E8",background:"var(--tm-bg)",fontFamily:"inherit"}}>👎</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}
