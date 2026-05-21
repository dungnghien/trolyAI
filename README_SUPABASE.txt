
V10 - SUPABASE

Bước 1:
Trong Supabase:
SQL Editor -> New Query

Dán nội dung file:
SUPABASE_SQL.txt

Rồi RUN.

Bước 2:
Deploy Render.

Environment Variables:

OPENAI_API_KEY = sk-...
OPENAI_MODEL = gpt-4o-mini

SUPABASE_URL = URL project Supabase
SUPABASE_ANON_KEY = publishable key

Build Command:
npm install

Start Command:
npm start

Sau khi deploy:
https://ten-app.onrender.com/api/health

Nếu:
hasSupabase:true
hasOpenAI:true

là thành công.

Dữ liệu bây giờ sẽ lưu online trên Supabase và không mất khi redeploy Render.
