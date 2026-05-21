
const express = require("express");
const multer = require("multer");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");

try {
  if (fs.existsSync("./config.env")) {
    const envText = fs.readFileSync("./config.env", "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^([^#=\s]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
} catch {}

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  }
});

app.use(express.json({limit:"50mb"}));
app.use(express.text({limit:"25mb"}));
app.use(express.static("public"));

fs.mkdirSync("./data", { recursive: true });
const db = new sqlite3.Database("./data/database.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    so_hieu TEXT,
    ngay_ban_hanh TEXT,
    noi_dung TEXT,
    thoi_han TEXT,
    can_bo TEXT,
    trang_thai TEXT,
    ghi_chu TEXT,
    created_at TEXT
  )`);
});

function run(sql, params=[]){
  return new Promise((resolve,reject)=>{
    db.run(sql, params, function(err){
      if(err) reject(err); else resolve(this);
    });
  });
}
function all(sql, params=[]){
  return new Promise((resolve,reject)=>{
    db.all(sql, params, (err,rows)=>err?reject(err):resolve(rows));
  });
}

async function extractText(file){
  const name = (file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";
  const buffer = file.buffer;

  try {
    if(mime.includes("pdf") || name.endsWith(".pdf")){
      const data = await pdf(buffer);
      return (data.text || "").trim();
    }

    if(mime.includes("word") || name.endsWith(".docx")){
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || "").trim();
    }

    if(name.endsWith(".txt") || mime.includes("text")){
      return buffer.toString("utf8").trim();
    }
  } catch(e) {
    return "";
  }

  return "";
}

function buildPrompt(filename, text){
  return `
Bạn là AI phân tích văn bản hành chính Việt Nam.

Hãy trích xuất chính xác các trường:
- so_hieu
- ngay_ban_hanh
- noi_dung
- thoi_han

Trả về JSON hợp lệ:
{
 "so_hieu":"",
 "ngay_ban_hanh":"",
 "noi_dung":"",
 "thoi_han":""
}

Quy tắc:
- so_hieu: số/ký hiệu văn bản. Không tự bịa.
- ngay_ban_hanh: ngày ban hành văn bản, không nhầm với thời hạn xử lý.
- noi_dung: tóm tắt ngắn gọn nội dung/nhiệm vụ chính, tối đa 250 ký tự.
- thoi_han: hạn xử lý/hạn báo cáo/hạn hoàn thành nếu có. Không lấy ngày ban hành làm thời hạn.
- Nếu không rõ ghi "Chưa xác định".
- Không tạo trường ghi_chu. Ghi chú do người dùng nhập thủ công.

Tên file: ${filename}

${text ? "Văn bản đã đọc được:\n" + text.slice(0, 15000) : "Hãy đọc trực tiếp nội dung từ file được gửi kèm, kể cả PDF scan/ảnh nếu có thể."}
`;
}

async function callOpenAIResponses(payload){
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(()=>({}));
  if(!res.ok){
    throw new Error(data.error?.message || "OpenAI API lỗi HTTP " + res.status);
  }

  let text = data.output_text;
  if(!text && Array.isArray(data.output)){
    for(const item of data.output){
      if(Array.isArray(item.content)){
        for(const c of item.content){
          if(c.text){ text = c.text; break; }
          if(c.type === "output_text" && c.text){ text = c.text; break; }
        }
      }
      if(text) break;
    }
  }
  if(!text) throw new Error("AI không trả về nội dung.");
  return text.replace(/```json|```/g, "").trim();
}

async function aiExtract(file, extractedText){
  if(!process.env.OPENAI_API_KEY){
    throw new Error("Server chưa có OPENAI_API_KEY. Hãy đặt biến môi trường trên Render hoặc config.env khi chạy local.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = buildPrompt(file.originalname, extractedText);

  // Nếu đọc được text, dùng text để tiết kiệm chi phí.
  if(extractedText && extractedText.trim().length > 30){
    const payload = {
      model,
      input: [{
        role: "user",
        content: [{ type: "input_text", text: prompt }]
      }],
      text: { format: { type: "json_object" } },
      temperature: 0.1
    };

    const text = await callOpenAIResponses(payload);
    return JSON.parse(text);
  }

  // Nếu không đọc được text, gửi file gốc cho AI đọc trực tiếp.
  const mime = file.mimetype || "application/octet-stream";
  const dataUrl = `data:${mime};base64,${file.buffer.toString("base64")}`;

  const payload = {
    model,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_file", filename: file.originalname || "van-ban", file_data: dataUrl }
      ]
    }],
    text: { format: { type: "json_object" } },
    temperature: 0.1
  };

  const text = await callOpenAIResponses(payload);
  return JSON.parse(text);
}

function csvEscape(v){
  v = String(v ?? "");
  return `"${v.replace(/"/g,'""')}"`;
}

function parseCSV(text){
  text = text.replace(/^\ufeff/, "");
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i], next = text[i+1];
    if(ch === '"' && inQuotes && next === '"'){ cell += '"'; i++; continue; }
    if(ch === '"'){ inQuotes = !inQuotes; continue; }
    if(ch === "," && !inQuotes){ row.push(cell); cell=""; continue; }
    if((ch === "\n" || ch === "\r") && !inQuotes){
      if(ch === "\r" && next === "\n") i++;
      row.push(cell); cell="";
      if(row.some(x=>x.trim() !== "")) rows.push(row);
      row=[];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if(row.some(x=>x.trim() !== "")) rows.push(row);
  return rows;
}

app.get("/api/health",(req,res)=>{
  res.json({
    ok:true,
    hasApiKey:Boolean(process.env.OPENAI_API_KEY),
    model:process.env.OPENAI_MODEL || "gpt-4o-mini",
    maxFileMB:25,
    note:"V9 hỗ trợ gửi file gốc cho AI khi PDF scan/ảnh không đọc được text."
  });
});

app.get("/api/records", async (req,res)=>{
  try{
    const rows = await all("SELECT * FROM records ORDER BY id DESC");
    res.json(rows);
  }catch(e){ res.status(500).json({error:e.message}); }
});

app.post("/api/upload-one", (req,res,next)=>{
  upload.single("file")(req,res,function(err){
    if(err){
      return res.status(400).json({error:"Lỗi upload: " + err.message});
    }
    next();
  });
}, async (req,res)=>{
  try{
    if(!req.file){
      return res.status(400).json({error:"Chưa nhận được file."});
    }

    const file = req.file;
    const extractedText = await extractText(file);
    const ai = await aiExtract(file, extractedText);

    await run(`
      INSERT INTO records
      (so_hieu,ngay_ban_hanh,noi_dung,thoi_han,can_bo,trang_thai,ghi_chu,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `,[
      ai.so_hieu || "Chưa xác định",
      ai.ngay_ban_hanh || "Chưa xác định",
      ai.noi_dung || "Chưa xác định",
      ai.thoi_han || "Chưa xác định",
      "",
      "Chưa xử lý",
      "",  // Ghi chú để trống, người dùng tự nhập.
      new Date().toISOString()
    ]);

    res.json({
      success:true,
      file:file.originalname,
      mode: extractedText ? "text" : "file_ai"
    });
  }catch(err){
    console.error("UPLOAD_ONE_ERROR", err);
    res.status(500).json({error:err.message || "Lỗi xử lý file."});
  }
});

app.put("/api/records/:id", async (req,res)=>{
  try{
    const id = req.params.id;
    const r = req.body;
    await run(`
      UPDATE records SET
        so_hieu=?,
        ngay_ban_hanh=?,
        noi_dung=?,
        thoi_han=?,
        can_bo=?,
        trang_thai=?,
        ghi_chu=?
      WHERE id=?
    `,[
      r.so_hieu || "",
      r.ngay_ban_hanh || "",
      r.noi_dung || "",
      r.thoi_han || "",
      r.can_bo || "",
      r.trang_thai || "",
      r.ghi_chu || "",
      id
    ]);
    res.json({success:true});
  }catch(err){ res.status(500).json({error:err.message}); }
});

app.delete("/api/records/:id", async (req,res)=>{
  try{
    await run("DELETE FROM records WHERE id=?", [req.params.id]);
    res.json({success:true});
  }catch(err){ res.status(500).json({error:err.message}); }
});

app.post("/api/import-csv", async (req,res)=>{
  try{
    const rows = parseCSV(req.body);
    if(rows.length < 2) return res.json({success:false, imported:0, message:"CSV rỗng hoặc thiếu dòng dữ liệu."});

    let imported = 0;
    for(let i=1;i<rows.length;i++){
      const c = rows[i];
      await run(`
        INSERT INTO records
        (so_hieu,ngay_ban_hanh,noi_dung,thoi_han,can_bo,trang_thai,ghi_chu,created_at)
        VALUES (?,?,?,?,?,?,?,?)
      `,[
        c[1] || "",
        c[2] || "",
        c[3] || "",
        c[4] || "",
        c[5] || "",
        c[6] || "Chưa xử lý",
        c[7] || "",
        new Date().toISOString()
      ]);
      imported++;
    }
    res.json({success:true, imported});
  }catch(err){ res.status(500).json({error:err.message}); }
});

app.get("/api/export-csv", async (req,res)=>{
  try{
    const rows = await all("SELECT * FROM records ORDER BY id ASC");
    const header = ["STT","Số hiệu","Ngày ban hành","Nội dung","Thời hạn","Cán bộ","Trạng thái","Ghi chú"];
    const lines = [header.map(csvEscape).join(",")];
    rows.forEach((r,i)=>{
      lines.push([
        i+1,r.so_hieu,r.ngay_ban_hanh,r.noi_dung,r.thoi_han,r.can_bo,r.trang_thai,r.ghi_chu
      ].map(csvEscape).join(","));
    });
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition","attachment; filename=backup_van_ban.csv");
    res.send("\ufeff" + lines.join("\n"));
  }catch(err){ res.status(500).json({error:err.message}); }
});

app.use((err,req,res,next)=>{
  console.error("GLOBAL_ERROR", err);
  res.status(500).json({error: err.message || "Lỗi server."});
});

app.listen(PORT,"0.0.0.0",()=>{
  console.log(`Running at http://localhost:${PORT}`);
});
