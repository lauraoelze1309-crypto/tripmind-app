// TripMind authentication (client-side PBKDF2)
export async function hashPw(password){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",enc.encode(password),{name:"PBKDF2"},false,["deriveBits"]);
  const salt=enc.encode("tripmind-salt-v1");
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},key,256);
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function verifyPw(password,storedHash){
  return (await hashPw(password))===storedHash;
}
