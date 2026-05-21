ONLINE V18 - TRỢ LÝ AI CỦA DŨNG NGUYỄN

Đã chỉnh:
- Banner: Trợ lý AI của Dũng Nguyễn.
- Đăng nhập bằng APP_USERNAME + APP_PASSWORD trên Render.
- Sửa phần chọn cán bộ trên điện thoại: dùng select thật + ô nhập tay, không dùng datalist.
- Phân loại pháp luật chỉ gồm:
  + Pháp luật hình sự
  + Xử lý vi phạm hành chính
  + Tố tụng hình sự
  + Khác
- Google Drive nên tạo 4 thư mục con đúng tên như trên.
- Thêm nút "Tra cứu" ở từng dòng văn bản đến để hỏi kho pháp luật theo nội dung văn bản.

Cần chạy SQL:
Supabase -> SQL Editor -> New Query -> dán SUPABASE_UPDATE_V18.sql -> Run

Render Environment cần có:
OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
SUPABASE_URL
SUPABASE_ANON_KEY
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_DRIVE_FOLDER_ID
APP_USERNAME
APP_PASSWORD

Kiểm tra:
https://vanbanden.onrender.com/api/health

Nếu mode là ONLINE_V18_DUNG_NGUYEN_LEGAL_CATEGORIES là đúng.
