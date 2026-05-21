
const express=require("express");
const multer=require("multer");
const pdf=require("pdf-parse");
const mammoth=require("mammoth");
const {createClient}=require("@supabase/supabase-js");
const {google}=require("googleapis");

const app=express();
const PORT=process.env.PORT||3000;
const APP_USERNAME=process.env.APP_USERNAME||"";
const APP_PASSWORD=process.env.APP_PASSWORD||"";
const LEGAL_CATEGORIES=["Pháp luật hình sự","Xử lý vi phạm hành chính","Tố tụng hình sự","Khác"];

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024}});
app.use(express.json({limit:"50mb"}));
app.use(express.text({limit:"25mb"}));
app.use(express.static("public"));

const supabase=createClient(process.env.SUPABASE_URL||"",process.env.SUPABASE_ANON_KEY||"");

function requireAuth(req,res,next){
  if(!APP_USERNAME&&!APP_PASSWORD) return next();
  const u=req.headers["x-app-username"]||"";
  const p=req.headers["x-app-password"]||"";
  if((!APP_USERNAME||u===APP_USERNAME)&&(!APP_PASSWORD||p===APP_PASSWORD)) return next();
  res.status(401).json({error:"Sai tài khoản hoặc mật khẩu."});
}
["/api/records","/api/upload-one","/api/import-csv","/api/export-csv","/api/legal"].forEach(p=>app.use(p,requireAuth));

function todayVN(){return new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date());}

async function extractTextFromBuffer(buffer,filename,mimetype){
  const name=(filename||"").toLowerCase(), mime=mimetype||"";
  try{
    if(mime.includes("pdf")||name.endsWith(".pdf")){const d=await pdf(buffer);return (d.text||"").trim();}
    if(mime.includes("word")||name.endsWith(".docx")){const r=await mammoth.extractRawText({buffer});return (r.value||"").trim();}
    if(name.endsWith(".txt")||mime.includes("text")) return buffer.toString("utf8").trim();
  }catch(e){}
  return "";
}
async function extractText(file){return extractTextFromBuffer(file.buffer,file.originalname,file.mimetype);}

async function openaiText(prompt,json=false){
  if(!process.env.OPENAI_API_KEY) throw new Error("Thiếu OPENAI_API_KEY.");
  const body={
    model:process.env.OPENAI_MODEL||"gpt-4o-mini",
    input:[{role:"user",content:[{type:"input_text",text:prompt}]}],
    temperature:0.1
  };
  if(json) body.text={format:{type:"json_object"}};
  const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error?.message||"OpenAI lỗi HTTP "+res.status);
  let text=data.output_text;
  if(!text&&Array.isArray(data.output)){
    for(const item of data.output||[]){
      for(const c of item.content||[]){
        if(c.text){text=c.text;break;}
        if(c.type==="output_text"&&c.text){text=c.text;break;}
      }
      if(text) break;
    }
  }
  return (text||"").replace(/```json|```/gi,"").trim();
}

async function aiExtract(file,txt){
  const prompt=`Bạn là AI phân tích văn bản hành chính Việt Nam. Hãy trả về json hợp lệ, chỉ json:
{"so_hieu":"","ngay_ban_hanh":"","noi_dung":"","thoi_han":""}
Quy tắc: không tự bịa; ngày ban hành không nhầm thời hạn; nội dung tối đa 250 ký tự; nếu không rõ ghi "Chưa xác định".
Tên file: ${file.originalname}
Nội dung:
${txt.slice(0,15000)}`;
  if(txt&&txt.length>30){
    try{return JSON.parse(await openaiText(prompt,true));}
    catch(e){return JSON.parse(await openaiText("Chỉ trả về json hợp lệ.\n"+prompt,false));}
  }
  const mime=file.mimetype||"application/octet-stream";
  const dataUrl=`data:${mime};base64,${file.buffer.toString("base64")}`;
  const body={
    model:process.env.OPENAI_MODEL||"gpt-4o-mini",
    input:[{role:"user",content:[
      {type:"input_text",text:"Bạn phải trả về json hợp lệ. "+prompt},
      {type:"input_file",filename:file.originalname||"van-ban",file_data:dataUrl}
    ]}],
    text:{format:{type:"json_object"}},
    temperature:0.1
  };
  const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error?.message||"OpenAI lỗi HTTP "+res.status);
  return JSON.parse((data.output_text||"{}").replace(/```json|```/gi,"").trim());
}

function csvEscape(v){return `"${String(v??"").replace(/"/g,'""')}"`;}
function parseCSV(text){
  text=text.replace(/^\ufeff/,""); const rows=[]; let row=[],cell="",q=false;
  for(let i=0;i<text.length;i++){const ch=text[i],n=text[i+1];
    if(ch=='"'&&q&&n=='"'){cell+='"';i++;continue}
    if(ch=='"'){q=!q;continue}
    if(ch==","&&!q){row.push(cell);cell="";continue}
    if((ch=="\n"||ch=="\r")&&!q){if(ch=="\r"&&n=="\n")i++; row.push(cell); if(row.some(x=>x.trim()))rows.push(row); row=[]; cell=""; continue}
    cell+=ch;
  }
  row.push(cell); if(row.some(x=>x.trim()))rows.push(row); return rows;
}

// Google Drive
function driveClient(){
  const raw=process.env.GOOGLE_SERVICE_ACCOUNT_JSON||"";
  if(!raw) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_JSON.");
  let cred; try{cred=JSON.parse(raw)}catch(e){cred=JSON.parse(Buffer.from(raw,"base64").toString("utf8"))}
  const auth=new google.auth.GoogleAuth({credentials:cred,scopes:["https://www.googleapis.com/auth/drive.readonly"]});
  return google.drive({version:"v3",auth});
}
async function listRecursive(drive,folderId,cat="Khác"){
  const res=await drive.files.list({q:`'${folderId}' in parents and trashed=false`,fields:"files(id,name,mimeType,modifiedTime,webViewLink,size)",pageSize:1000});
  const out=[];
  for(const f of res.data.files||[]){
    if(f.mimeType==="application/vnd.google-apps.folder"){
      const next=LEGAL_CATEGORIES.includes(f.name)?f.name:cat;
      out.push(...await listRecursive(drive,f.id,next));
    }else out.push({...f,category:cat});
  }
  return out;
}
async function downloadDrive(drive,f){
  if(f.mimeType==="application/vnd.google-apps.document"){
    const r=await drive.files.export({fileId:f.id,mimeType:"text/plain"},{responseType:"arraybuffer"});
    return {buffer:Buffer.from(r.data),mimeType:"text/plain",filename:f.name+".txt"};
  }
  const r=await drive.files.get({fileId:f.id,alt:"media"},{responseType:"arraybuffer"});
  return {buffer:Buffer.from(r.data),mimeType:f.mimeType,filename:f.name};
}
function chunks(text,size=1800,overlap=250){
  const s=String(text||"").replace(/\s+/g," ").trim(), arr=[]; let st=0;
  while(st<s.length){const en=Math.min(st+size,s.length); arr.push(s.slice(st,en)); if(en>=s.length)break; st=Math.max(0,en-overlap)}
  return arr;
}
function tokens(s){
  const stop=new Set(["và","hoặc","của","cho","với","theo","là","có","không","được","trong","ngoài","một","những","các","về","khi","nếu","thì","tại","từ","đến"]);
  return String(s||"").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(w=>w.length>=3&&!stop.has(w)).slice(0,30);
}
function score(words,content){const t=String(content||"").toLowerCase(); let sc=0; for(const w of words) if(t.includes(w)) sc+=Math.min(5,w.length); return sc;}

async function findContexts(q,category){
  let query=supabase.from("legal_chunks").select("*").limit(5000);
  if(category&&category!=="Tất cả") query=query.eq("category",category);
  const {data,error}=await query; if(error) throw error;
  const ws=tokens(q);
  return (data||[]).map(c=>({...c,score:score(ws,c.content)})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
}
async function answerLegal(q,ctx){
  const src=ctx.map((c,i)=>`Nguồn ${i+1}: ${c.doc_title}\nPhân loại: ${c.category||"Khác"}\nLink: ${c.source_url||""}\nTrích đoạn:\n${c.content}`).join("\n\n---\n\n");
  const prompt=`Bạn là trợ lý tra cứu pháp luật cho Công an xã. Chỉ trả lời dựa trên nguồn. Nếu chưa đủ căn cứ, nói rõ "Chưa đủ căn cứ trong kho tài liệu". Nêu căn cứ, trích dẫn ngắn, không bịa điều khoản. Cuối câu trả lời liệt kê nguồn đã dùng.

Câu hỏi: ${q}

Nguồn:
${src}`;
  return openaiText(prompt,false);
}

app.get("/api/health",(req,res)=>res.json({ok:true,hasOpenAI:!!process.env.OPENAI_API_KEY,hasSupabase:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY),hasGoogleDrive:!!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON&&process.env.GOOGLE_DRIVE_FOLDER_ID),hasAuth:!!(APP_USERNAME||APP_PASSWORD),mode:"ONLINE_V18_DUNG_NGUYEN_LEGAL_CATEGORIES",model:process.env.OPENAI_MODEL||"gpt-4o-mini"}));

app.get("/api/records",async(req,res)=>{try{const {data,error}=await supabase.from("records").select("*").order("id",{ascending:false}); if(error)throw error; res.json(data||[])}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/upload-one",upload.single("file"),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:"Chưa nhận được file."}); const txt=await extractText(req.file); const ai=await aiExtract(req.file,txt); const row={so_hieu:ai.so_hieu||"Chưa xác định",ngay_ban_hanh:ai.ngay_ban_hanh||"Chưa xác định",noi_dung:ai.noi_dung||"Chưa xác định",thoi_han:ai.thoi_han||"Chưa xác định",ngay_nhan:todayVN(),can_bo:"",trang_thai:"Chưa xử lý",ghi_chu:""}; const {error}=await supabase.from("records").insert([row]); if(error)throw error; res.json({success:true,record:row})}catch(e){res.status(500).json({error:e.message})}});
app.put("/api/records/:id",async(req,res)=>{try{const r=req.body; const row={so_hieu:r.so_hieu||"",ngay_ban_hanh:r.ngay_ban_hanh||"",ngay_nhan:r.ngay_nhan||"",noi_dung:r.noi_dung||"",thoi_han:r.thoi_han||"",can_bo:r.can_bo||"",trang_thai:r.trang_thai||"",ghi_chu:r.ghi_chu||""}; const {error}=await supabase.from("records").update(row).eq("id",req.params.id); if(error)throw error; res.json({success:true})}catch(e){res.status(500).json({error:e.message})}});
app.delete("/api/records/:id",async(req,res)=>{try{const {error}=await supabase.from("records").delete().eq("id",req.params.id); if(error)throw error; res.json({success:true})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/export-csv",async(req,res)=>{try{const {data,error}=await supabase.from("records").select("*").order("id",{ascending:true}); if(error)throw error; const lines=[["STT","Số hiệu / Ngày ban hành","Ngày nhận","Nội dung","Thời hạn","Cán bộ","Trạng thái","Ghi chú"].map(csvEscape).join(",")]; (data||[]).forEach((r,i)=>lines.push([i+1,`${r.so_hieu||""}\n${r.ngay_ban_hanh||""}`.trim(),r.ngay_nhan||"",r.noi_dung,r.thoi_han,r.can_bo,r.trang_thai,r.ghi_chu].map(csvEscape).join(","))); res.setHeader("Content-Type","text/csv; charset=utf-8"); res.setHeader("Content-Disposition","attachment; filename=backup_van_ban.csv"); res.send("\ufeff"+lines.join("\n"))}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/import-csv",async(req,res)=>{try{const rows=parseCSV(req.body), ins=[]; for(let i=1;i<rows.length;i++){const c=rows[i],parts=(c[1]||"").split(/\n|\|/).map(x=>x.trim()).filter(Boolean); ins.push({so_hieu:parts[0]||c[1]||"",ngay_ban_hanh:parts.slice(1).join(" "),ngay_nhan:c[2]||todayVN(),noi_dung:c[3]||"",thoi_han:c[4]||"",can_bo:c[5]||"",trang_thai:c[6]||"Chưa xử lý",ghi_chu:c[7]||""})} if(ins.length){const {error}=await supabase.from("records").insert(ins); if(error)throw error;} res.json({success:true,imported:ins.length})}catch(e){res.status(500).json({error:e.message})}});

app.get("/api/legal/docs",async(req,res)=>{try{const {data,error}=await supabase.from("legal_documents").select("*").order("updated_at",{ascending:false}); if(error)throw error; res.json(data||[])}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/legal/sync",async(req,res)=>{try{const folder=process.env.GOOGLE_DRIVE_FOLDER_ID; if(!folder)throw new Error("Thiếu GOOGLE_DRIVE_FOLDER_ID."); const drive=driveClient(); const files=await listRecursive(drive,folder,"Khác"); let synced=0,skipped=0,errors=[]; for(const f of files){try{const ok=f.mimeType==="application/pdf"||f.mimeType==="text/plain"||f.mimeType==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"||f.mimeType==="application/vnd.google-apps.document"||f.name.toLowerCase().match(/\.(pdf|docx|txt)$/); if(!ok){skipped++;continue} const d=await downloadDrive(drive,f); const txt=await extractTextFromBuffer(d.buffer,d.filename,d.mimeType); if(!txt||txt.length<50){errors.push(`${f.name}: Không đọc được nội dung.`);continue} const doc={drive_file_id:f.id,title:f.name,category:LEGAL_CATEGORIES.includes(f.category)?f.category:"Khác",mime_type:f.mimeType,source_url:f.webViewLink||`https://drive.google.com/file/d/${f.id}/view`,modified_time:f.modifiedTime,text_length:txt.length,updated_at:new Date().toISOString()}; const {data:up,error:de}=await supabase.from("legal_documents").upsert(doc,{onConflict:"drive_file_id"}).select().single(); if(de)throw de; await supabase.from("legal_chunks").delete().eq("doc_id",up.id); const rows=chunks(txt).map((content,i)=>({doc_id:up.id,drive_file_id:f.id,doc_title:f.name,category:doc.category,source_url:doc.source_url,chunk_index:i,content})); if(rows.length){const {error:ce}=await supabase.from("legal_chunks").insert(rows); if(ce)throw ce} synced++;}catch(e){errors.push(`${f.name}: ${e.message}`)}} res.json({success:true,total:files.length,synced,skipped,errors})}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/legal/ask",async(req,res)=>{try{const q=String(req.body.question||"").trim(),cat=String(req.body.category||"Tất cả"); if(!q)return res.status(400).json({error:"Chưa nhập câu hỏi."}); const ctx=await findContexts(q,cat); if(!ctx.length)return res.json({answer:"Chưa tìm thấy căn cứ phù hợp trong kho tài liệu.",sources:[]}); res.json({answer:await answerLegal(q,ctx),sources:ctx})}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/legal/ask-record/:id",async(req,res)=>{try{const cat=String(req.body.category||"Tất cả"); const {data:rec,error}=await supabase.from("records").select("*").eq("id",req.params.id).single(); if(error)throw error; const q=`Tra cứu quy định pháp luật, căn cứ xử lý, biểu mẫu hoặc hướng giải quyết liên quan đến văn bản/nội dung sau: ${rec.noi_dung||""}. Số hiệu: ${rec.so_hieu||""}. Thời hạn: ${rec.thoi_han||""}.`; const ctx=await findContexts(q,cat); if(!ctx.length)return res.json({answer:"Chưa tìm thấy căn cứ phù hợp trong kho tài liệu.",sources:[],question:q}); res.json({answer:await answerLegal(q,ctx),sources:ctx,question:q})}catch(e){res.status(500).json({error:e.message})}});

app.listen(PORT,"0.0.0.0",()=>console.log("V18 running on port "+PORT));
