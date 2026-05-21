V13 - SỬA LỖI KHÔNG PHÂN TÍCH ĐƯỢC FILE

Nguyên nhân bản trước:
- Với Supabase, server chỉ gửi text trích được từ PDF/DOCX sang OpenAI.
- Nếu PDF scan/ảnh không có text, AI nhận nội dung rỗng nên trả "Chưa xác định".

Bản V13 sửa:
- Nếu đọc được text: gửi text sang AI để tiết kiệm.
- Nếu không đọc được text: gửi file gốc cho AI đọc trực tiếp qua Responses API.
- Vẫn lưu dữ liệu vào Supabase.
- Cột ghi chú vẫn để trống cho người dùng nhập thủ công.

Cách cập nhật:
1. Upload đè toàn bộ V13 lên GitHub.
2. Render -> Manual Deploy -> Deploy latest commit.
3. Mở:
   https://vanbanden.onrender.com/api/health
4. Nếu thấy mode: V13_SUPABASE_FILE_AI là đúng bản mới.

Lưu ý:
- PDF scan/ảnh sẽ tốn API hơn file có chữ.
- Nếu file ảnh/PDF quá lớn, nên nén dưới 25MB.
