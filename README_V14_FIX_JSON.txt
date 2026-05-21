V14 - SỬA LỖI JSON_OBJECT

Lỗi đã sửa:
Response input messages must contain the word 'json' in some form to use 'text.format' of type 'json_object'.

Nguyên nhân:
OpenAI yêu cầu prompt phải có chữ "json" khi bật chế độ trả về json_object.
Một số trường hợp prompt tiếng Việt có chữ JSON viết hoa hoặc file mode làm API không nhận.

Bản V14:
- Ép prompt có chữ "json" thường.
- Nếu vẫn lỗi, tự retry không dùng text.format và ép AI trả json.
- Giữ Supabase, upload file gốc, PDF scan/ảnh, CSV, danh sách cán bộ.

Cập nhật:
1. Upload đè V14 lên GitHub.
2. Render -> Manual Deploy -> Deploy latest commit.
3. Kiểm tra:
   https://vanbanden.onrender.com/api/health

Nếu thấy:
mode: V14_FIX_JSON_OBJECT

là đúng bản mới.
