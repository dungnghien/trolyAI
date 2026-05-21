PHIÊN BẢN V6 - BANNER + SỬA UPLOAD

Đã sửa:
- Thêm banner: Tổ Cảnh sát Phòng, chống tội phạm Công an xã Hát Môn
- Sửa upload file bằng memoryStorage, phù hợp hơn khi chạy cloud/Render
- Upload nhiều file cùng lúc
- Thông báo lỗi upload rõ hơn
- Cán bộ có danh sách chọn và vẫn nhập tay được
- Export/Import CSV
- SQLite
- AI gpt-4o-mini

CÁCH TRUY CẬP TỪ THIẾT BỊ KHÁC

1. Nếu deploy lên Render:
Sau khi deploy, Render cấp link dạng:
https://ten-app.onrender.com

Bạn mở link này trên điện thoại, máy tính bảng hoặc máy tính khác ở bất kỳ đâu.

2. Nếu chạy trên máy tính nội bộ:
- Chạy npm start hoặc CHAY_APP.bat
- Điện thoại phải cùng Wi‑Fi với máy tính
- Tìm IP máy tính, ví dụ 192.168.1.5
- Trên điện thoại mở:
http://192.168.1.5:3000

LƯU Ý DỮ LIỆU:
- SQLite trên Render free có thể không bền sau redeploy/restart nếu không dùng persistent disk.
- Hãy xuất CSV định kỳ.
- Nếu cần bền vững thật sự, nên dùng Supabase/PostgreSQL ở bản tiếp theo.
