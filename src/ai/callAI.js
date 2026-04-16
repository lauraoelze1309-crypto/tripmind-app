// TripMind AI call layer
import { MODEL } from '../constants/config.js';

export function repairJSON(raw){
  // Strip markdown fences
  let s=raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  // Find outermost { }
  const si=s.indexOf("{");
  if(si===-1) throw new Error("No JSON object in response");
  s=s.slice(si);
  // Build cleaned string char-by-char
  let r="",inStr=false,esc=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(esc){
      // pass through valid escapes; drop invalid ones
      const valid='"\\\/bfnrtu'.includes(c);
      r+=valid?"\\"+c:c;
      esc=false; continue;
    }
    if(c==="\\"){esc=true;continue;}
    if(c==='"'){inStr=!inStr;r+=c;continue;}
    if(inStr){
      // sanitise control chars inside strings
      if(c==="\n"){r+=" ";continue;}
      if(c==="\r"||c==="\t"){continue;}
      if(c.charCodeAt(0)<32){continue;}
      // replace smart quotes/apostrophes with plain equivalents
      if(c==="\u2019"||c==="\u2018"){r+="'";continue;}
      if(c==="\u201c"||c==="\u201d"){r+='"';continue;}
      r+=c;
    } else {
      r+=c;
    }
  }
  // Try parsing as-is
  try{ return JSON.parse(r); }catch(_){
    // Count unclosed brackets and close them
    let op=0,ap=0,in2=false,es=false;
    for(const c of r){
      if(es){es=false;continue;}
      if(c==="\\"){es=true;continue;}
      if(c==='"'){in2=!in2;continue;}
      if(!in2){
        if(c==="{")op++;
        else if(c==="}")op--;
        else if(c==="[")ap++;
        else if(c==="]")ap--;
      }
    }
    let fx=r;
    // If we're mid-string, close it
    if(in2) fx+='"';
    for(let a=0;a<ap;a++) fx+="]";
    for(let b=0;b<op;b++) fx+="}";
    try{ return JSON.parse(fx); }
    catch(e){ throw new Error("Parse failed: "+e.message); }
  }
}

export function getApiKey(){ try{ return localStorage.getItem("tm_api_key")||""; }catch(_){ return ""; } }
export async function callAI(prompt,maxTok,attempt){
  attempt=attempt||0;
  try{
    // Always use backend proxy — API key is stored securely on the server
    const url="/api/messages";
    const headers={"Content-Type":"application/json"};
    const res=await fetch(url,{method:"POST",headers,
      body:JSON.stringify({model:MODEL,max_tokens:maxTok||900,messages:[{role:"user",content:prompt}]})});
    if(!res.ok){
      const t=await res.text().catch(()=>"");
      if((res.status===529||res.status>=500)&&attempt<2){await new Promise(r=>setTimeout(r,2000*(attempt+1)));return callAI(prompt,maxTok,attempt+1);}
      throw new Error("API "+res.status+(t?": "+t.slice(0,120):""));
    }
    const data=await res.json();
    if(data.error) throw new Error(data.error.message||"AI error");
    const raw=(data.content||[]).map(b=>b.text||"").join("");
    if(!raw.trim()) throw new Error("Empty response");
    return repairJSON(raw);
  }catch(err){
    if((err.name==="TypeError"||/fetch|network/i.test(err.message))&&attempt<2){
      await new Promise(r=>setTimeout(r,1500*(attempt+1)));
      return callAI(prompt,maxTok,attempt+1);
    }
    throw err;
  }
}
