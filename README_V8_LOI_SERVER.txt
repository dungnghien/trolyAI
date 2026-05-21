PHIÊN BẢN V8 - SỬA LỖI KHÔNG KẾT NỐI SERVER

Lỗi bạn gặp:
"Không kết nối được server..."

Nguyên nhân phổ biến:
1. Mở trực tiếp file public/index.html bằng double click.
   Sai: file:///...
   Đúng: http://localhost:3000

2. Chưa chạy server.
   Cách đúng khi chạy trên máy tính:
   - Mở CHAY_APP.bat
   - Dán API key vào config.env nếu app yêu cầu
   - Chờ app tự mở http://localhost:3000

3. Deploy Render chưa thành công hoặc app bị crash.
   Cách kiểm tra:
   - Vào Render Dashboard
   - Mở Logs
   - Kiểm tra service có trạng thái Live hay không
   - Mở link:
     https://ten-app.onrender.com/api/health

Nếu /api/health hiện JSON có hasApiKey:true là server OK.

CÁCH CHẠY LOCAL:
1. Giải nén ZIP.
2. Double-click CHAY_APP.bat.
3. Nếu Notepad mở config.env, dán:
   OPENAI_API_KEY=sk-...
4. Lưu lại.
5. Double-click CHAY_APP.bat lần nữa.
6. App sẽ mở http://localhost:3000

CÁCH TRUY CẬP ĐIỆN THOẠI:
- Nếu chạy local: điện thoại cùng Wi-Fi, mở http://IP-máy-tính:3000
- Nếu deploy Render: mở link Render ở bất kỳ đâu.
