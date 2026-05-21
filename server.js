
const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.json({limit:"50mb"}));
app.use(express.text({limit:"25mb"}));
app.use(express.static("public"));

const supabase = createClient(
  process.env.SUPABASE_URL || "https://waffczxyaxpycpjfaqnq.supabase.co",
  process.env.SUPABASE_ANON_KEY || ""
);

async function extractText(file){
  const name = (file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";
  const buffer = file.buffer;

  try {
    if(mime.includes("pdf") || name.endsWith(".pdf")) {
      const data = await pdf(buffer);
      return (data.text || "").trim();
    }

    if(mime.includes("word") || name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || "").trim();
    }

    if(name.endsWith(".txt") || mime.includes("text")) {
      return buffer.toString("utf8").trim();
    }
  } catch(e) {}

  return "";
}

async function aiExtract(text, filename){
  if(!process.env.OPENAI_API_KEY){
    throw new Error("Thiếu OPENAI_API_KEY");
  }

  const prompt = `
Bạn là AI phân tích văn bản hành chính Việt Nam.

Hãy trích xuất:
- so_hieu
- ngay_ban_hanh
- noi_dung
- thoi_han

Trả về JSON:
{
 "so_hieu":"",
 "ngay_ban_hanh":"",
 "noi_dung":"",
 "thoi_han":""
}

Tên file: ${filename}

Nội dung:
${(text || "").slice(0,12000)}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{
      "Authorization":"Bearer " + process.env.OPENAI_API_KEY,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type:"json_object" },
      messages:[
        { role:"system", content:"Bạn là AI trích xuất văn bản hành chính." },
        { role:"user", content: prompt }
      ],
      temperature:0.1
    })
  });

  const data = await response.json();

  if(!response.ok){
    throw new Error(data.error?.message || "OpenAI API lỗi");
  }

  return JSON.parse(data.choices[0].message.content);
}

app.get("/api/health",(req,res)=>{
  res.json({
    ok:true,
    hasOpenAI:Boolean(process.env.OPENAI_API_KEY),
    hasSupabase:Boolean(process.env.SUPABASE_ANON_KEY),
    supabaseUrl: process.env.SUPABASE_URL || "https://waffczxyaxpycpjfaqnq.supabase.co"
  });
});

app.get("/api/records", async (req,res)=>{
  try {
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .order("id", { ascending:false });

    if(error) throw error;
    res.json(data || []);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/upload-one", upload.single("file"), async (req,res)=>{
  try {
    if(!req.file) return res.status(400).json({error:"Chưa có file"});

    const text = await extractText(req.file);

    const ai = await aiExtract(text, req.file.originalname);

    const { error } = await supabase
      .from("records")
      .insert([{
        so_hieu: ai.so_hieu || "Chưa xác định",
        ngay_ban_hanh: ai.ngay_ban_hanh || "Chưa xác định",
        noi_dung: ai.noi_dung || "Chưa xác định",
        thoi_han: ai.thoi_han || "Chưa xác định",
        can_bo: "",
        trang_thai: "Chưa xử lý",
        ghi_chu: ""
      }]);

    if(error) throw error;

    res.json({success:true});
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.put("/api/records/:id", async (req,res)=>{
  try {
    const { error } = await supabase
      .from("records")
      .update(req.body)
      .eq("id", req.params.id);

    if(error) throw error;
    res.json({success:true});
  } catch(err) {
    res.status(500).json({error:err.message});
  }
});

app.delete("/api/records/:id", async (req,res)=>{
  try {
    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", req.params.id);

    if(error) throw error;
    res.json({success:true});
  } catch(err) {
    res.status(500).json({error:err.message});
  }
});

app.listen(PORT, "0.0.0.0", ()=>{
  console.log("Running on port " + PORT);
});
