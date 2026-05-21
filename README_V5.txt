PHIÊN BẢN V5 - AI + CSV RESTORE + DANH SÁCH CÁN BỘ

Đã có:
- OpenAI AI thật với gpt-4o-mini
- Upload nhiều file cùng lúc
- SQLite lưu dữ liệu
- Export CSV
- Import CSV restore
- Chỉnh sửa trực tiếp trên bảng
- Cột Cán bộ có danh sách chọn:
  Nguyễn Dũng, Phương Đạt, Công Cường, Thiều Cường, Phan Kiên, Tùng Long,
  Văn Tuấn, Minh Khương, Ngọc Chung, Hoàng Hải, Huyền Trang, Văn Tiến,
  Quang Hoàng, Duy Thắng, Lê Thuỷ
- Cán bộ vẫn có thể tự nhập tay khi phát sinh người mới
- Deploy-ready cho Render

Lưu ý:
- PDF scan/ảnh chưa có OCR nâng cao.
- Nếu deploy Render free mà không có persistent disk/database ngoài, SQLite có thể không bền sau redeploy. Để an toàn lâu dài nên dùng backup CSV định kỳ hoặc nâng cấp Supabase/PostgreSQL.

Chạy local:
npm install
set OPENAI_API_KEY=sk-...   (Windows CMD)
npm start
