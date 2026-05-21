V11 - SỬA LỖI GIAO DIỆN BÁO CHƯA CÓ OPENAI_API_KEY

Nguyên nhân:
- /api/health của bản Supabase trả về:
  hasOpenAI: true
- Nhưng frontend cũ kiểm tra:
  hasApiKey
- Vì vậy server đã đúng nhưng giao diện báo nhầm.

Cách cập nhật:
1. Upload đè toàn bộ file V11 lên GitHub.
2. Render tự deploy hoặc bấm Manual Deploy -> Deploy latest commit.
3. Mở lại app bằng Ctrl + F5 để xóa cache.

Kiểm tra:
https://vanbanden.onrender.com/api/health

Nếu có:
hasOpenAI:true
hasSupabase:true

là đúng.
