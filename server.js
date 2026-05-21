
const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.json({ limit: "50mb" }));
app.use(express.text({ limit: "25mb" }));
app.use(express.static("public"));

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

async function extractText(file) {
  const name = (file.originalname || "").toLowerCase();
  const mime = file.mimetype || "";
  const buffer = file.buffer;

  try {
    if (mime.includes("pdf") || name.endsWith(".pdf")) {
      const data = await pdf(buffer);
      return (data.text || "").trim();
    }

    if (mime.includes("word") || name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || "").trim();
    }

    if (name.endsWith(".txt") || mime.includes("text")) {
      return buffer.toString("utf8").trim();
    }
  } catch (e) {
    return "";
  }

  return "";
}

function buildPrompt(filename, text) {
  return `
Bạn là AI phân tích văn bản hành chính Việt Nam.

Hãy trích xuất chính xác các trường:
{
 "so_hieu":"",
 "ngay_ban_hanh":"",
 "noi_dung":"",
 "thoi_han":""
}

Quy tắc:
- so_hieu: số/ký hiệu văn bản, ví dụ: Số 123/ABC-XYZ.
- ngay_ban_hanh: ngày ban hành văn bản, không nhầm với thời hạn xử lý.
- noi_dung: tóm tắt ngắn gọn nội dung/nhiệm vụ chính, tối đa 250 ký tự.
- thoi_han: hạn xử lý/hạn báo cáo/hạn hoàn thành nếu có. Không lấy ngày ban hành làm thời hạn.
- Nếu không rõ ghi "Chưa xác định".
- Không tạo trường ghi_chu. Ghi chú do người dùng nhập thủ công.

Tên file: ${filename}

${text ? "Nội dung văn bản đã đọc được:\n" + text.slice(0, 15000) : "Hãy đọc trực tiếp file được gửi kèm, kể cả PDF scan/ảnh."}
`;
}

async function callOpenAIResponses(payload) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error?.message || "OpenAI API lỗi HTTP " + res.status);
  }

  let text = data.output_text;

  if (!text && Array.isArray(data.output)) {
    for (const item of data.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.text) { text = c.text; break; }
          if (c.type === "output_text" && c.text) { text = c.text; break; }
        }
      }
      if (text) break;
    }
  }

  if (!text) throw new Error("AI không trả về nội dung.");
  text = text.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

async function aiExtract(file, extractedText) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Thiếu OPENAI_API_KEY trên Render.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const prompt = buildPrompt(file.originalname, extractedText);

  // Nếu file có text, gửi text để tiết kiệm chi phí.
  if (extractedText && extractedText.length > 30) {
    return await callOpenAIResponses({
      model,
      input: [{
        role: "user",
        content: [{ type: "input_text", text: prompt }]
      }],
      text: { format: { type: "json_object" } },
      temperature: 0.1
    });
  }

  // Nếu không có text, gửi file gốc cho AI đọc trực tiếp.
  const mime = file.mimetype || "application/octet-stream";
  const dataUrl = `data:${mime};base64,${file.buffer.toString("base64")}`;

  return await callOpenAIResponses({
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
  });
}

function csvEscape(v) {
  v = String(v ?? "");
  return `"${v.replace(/"/g, '""')}"`;
}

function parseCSV(text) {
  text = text.replace(/^\ufeff/, "");
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && inQuotes && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(x => x.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== "")) rows.push(row);
  return rows;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    mode: "V13_SUPABASE_FILE_AI",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    maxFileMB: 25
  });
});

app.get("/api/records", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/upload-one", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Chưa nhận được file." });

    const extractedText = await extractText(req.file);
    const ai = await aiExtract(req.file, extractedText);

    const record = {
      so_hieu: ai.so_hieu || "Chưa xác định",
      ngay_ban_hanh: ai.ngay_ban_hanh || "Chưa xác định",
      noi_dung: ai.noi_dung || "Chưa xác định",
      thoi_han: ai.thoi_han || "Chưa xác định",
      can_bo: "",
      trang_thai: "Chưa xử lý",
      ghi_chu: ""
    };

    const { error } = await supabase.from("records").insert([record]);
    if (error) throw error;

    res.json({
      success: true,
      mode: extractedText ? "text" : "file_ai",
      record
    });
  } catch (err) {
    console.error("UPLOAD_ONE_ERROR", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/records/:id", async (req, res) => {
  try {
    const allowed = {
      so_hieu: req.body.so_hieu || "",
      ngay_ban_hanh: req.body.ngay_ban_hanh || "",
      noi_dung: req.body.noi_dung || "",
      thoi_han: req.body.thoi_han || "",
      can_bo: req.body.can_bo || "",
      trang_thai: req.body.trang_thai || "",
      ghi_chu: req.body.ghi_chu || ""
    };

    const { error } = await supabase
      .from("records")
      .update(allowed)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/records/:id", async (req, res) => {
  try {
    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/import-csv", async (req, res) => {
  try {
    const rows = parseCSV(req.body);
    if (rows.length < 2) return res.json({ success: false, imported: 0, message: "CSV rỗng." });

    const toInsert = [];
    for (let i = 1; i < rows.length; i++) {
      const c = rows[i];
      toInsert.push({
        so_hieu: c[1] || "",
        ngay_ban_hanh: c[2] || "",
        noi_dung: c[3] || "",
        thoi_han: c[4] || "",
        can_bo: c[5] || "",
        trang_thai: c[6] || "Chưa xử lý",
        ghi_chu: c[7] || ""
      });
    }

    if (toInsert.length) {
      const { error } = await supabase.from("records").insert(toInsert);
      if (error) throw error;
    }

    res.json({ success: true, imported: toInsert.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/export-csv", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;

    const header = ["STT", "Số hiệu", "Ngày ban hành", "Nội dung", "Thời hạn", "Cán bộ", "Trạng thái", "Ghi chú"];
    const lines = [header.map(csvEscape).join(",")];

    (data || []).forEach((r, i) => {
      lines.push([
        i + 1,
        r.so_hieu,
        r.ngay_ban_hanh,
        r.noi_dung,
        r.thoi_han,
        r.can_bo,
        r.trang_thai,
        r.ghi_chu
      ].map(csvEscape).join(","));
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=backup_van_ban.csv");
    res.send("\ufeff" + lines.join("\n"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Running V13 on port " + PORT);
});
