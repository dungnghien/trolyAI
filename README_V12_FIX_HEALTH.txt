V12 - SỬA TRIỆT ĐỂ LỖI GIAO DIỆN BÁO CHƯA CÓ OPENAI_API_KEY

Lỗi:
- /api/health đã hiện hasOpenAI:true
- nhưng giao diện vẫn báo "Server chưa có OPENAI_API_KEY"

Nguyên nhân:
- Frontend cũ vẫn gọi biến hasApiKey.

Bản V12:
- Ghi đè hàm upload ở cuối trang.
- Chỉ dùng hasOpenAI và hasSupabase.
- Thêm kiểm tra trạng thái server khi mở trang.

Cách cập nhật:
1. Giải nén V12.
2. Upload ĐÈ TOÀN BỘ file lên GitHub.
3. Đảm bảo GitHub commit mới đã hiện.
4. Render -> Manual Deploy -> Deploy latest commit.
5. Mở app bằng Ctrl + F5 hoặc mở ẩn danh.

Nếu vẫn thấy dòng cũ:
- nghĩa là Render chưa deploy code mới, hoặc trình duyệt đang cache bản cũ.
