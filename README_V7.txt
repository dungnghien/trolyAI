PHIÊN BẢN V7 - SỬA LỖI FAILED TO FETCH KHI UPLOAD

Điểm sửa chính:
- Upload từng file qua /api/upload-one để ổn định hơn.
- Kiểm tra /api/health trước khi upload.
- Hiển thị lỗi cụ thể nếu thiếu OPENAI_API_KEY.
- Giới hạn mỗi file 20MB để tránh Render bị timeout/crash.
- Nếu một file lỗi, các file khác vẫn tiếp tục xử lý.
- Sửa thông báo Failed to fetch rõ nguyên nhân hơn.

Cách kiểm tra sau deploy:
1. Mở link app.
2. Truy cập thử:
   https://ten-app.onrender.com/api/health
3. Nếu thấy hasApiKey:true là server đã nhận API key.
4. Nếu hasApiKey:false, vào Render > Environment > thêm OPENAI_API_KEY.

Lưu ý:
- Render free có thể ngủ. Lần mở đầu chờ 30-60 giây.
- Chỉ upload PDF có chữ, DOCX, TXT.
- PDF scan/ảnh chưa OCR nâng cao.
- File quá lớn có thể lỗi, nên dưới 20MB/file.
