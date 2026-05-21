PHIÊN BẢN V9 - HỖ TRỢ PDF SCAN/ẢNH + GHI CHÚ THỦ CÔNG

Đã sửa:
1. Khi PDF không có lớp chữ hoặc là ảnh scan:
   - App không còn dừng ở lỗi “Không đọc được nội dung file”.
   - App gửi file gốc cho AI đọc trực tiếp bằng Responses API.
   - Hỗ trợ: PDF, DOCX, TXT, JPG, PNG, WEBP.

2. Cột Ghi chú:
   - Không tự điền tên file nữa.
   - Để trống để người dùng nhập thủ công.

3. Vẫn giữ:
   - Banner Tổ Cảnh sát Phòng, chống tội phạm Công an xã Hát Môn
   - Upload nhiều file theo hàng đợi từng file
   - Chọn hoặc nhập tay cán bộ
   - Import/Export CSV
   - SQLite
   - Kiểm tra server /api/health

Lưu ý:
- PDF scan/ảnh sẽ tốn chi phí API cao hơn file PDF có chữ.
- File tối đa 25MB.
- Nếu deploy Render, nhớ đặt OPENAI_API_KEY.
- Kiểm tra: https://ten-app.onrender.com/api/health
