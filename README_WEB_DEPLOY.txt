TRIỂN KHAI WEB APP LÊN RENDER - CÁCH THỦ CÔNG DỄ NHẤT

Mục tiêu:
Sau khi deploy, bạn có link dạng:
https://van-ban-den-ai.onrender.com

I. UPLOAD LÊN GITHUB

1. Tạo repo mới trên GitHub.
2. Giải nén ZIP này.
3. Upload TOÀN BỘ FILE BÊN TRONG thư mục đã giải nén lên repo.

Cấu trúc đúng trên GitHub phải là:

server.js
package.json
render.yaml
public/
data/
README_WEB_DEPLOY.txt

Không được để lồng thêm thư mục cha.

II. DEPLOY TRÊN RENDER

1. Vào https://dashboard.render.com
2. Chọn New +
3. Chọn Web Service
4. Chọn repo GitHub vừa upload
5. Cấu hình:

Runtime: Node
Build Command: npm install
Start Command: npm start

6. Environment Variables:

OPENAI_API_KEY = sk-...
OPENAI_MODEL = gpt-4o-mini

7. Bấm Deploy Web Service.

III. KIỂM TRA

Sau khi deploy xong, mở:

https://ten-app.onrender.com/api/health

Nếu thấy hasApiKey:true là đúng.

Sau đó mở:

https://ten-app.onrender.com

IV. LƯU Ý QUAN TRỌNG

- Không dùng Blueprint nếu bạn thấy rối.
- Không upload file ZIP nguyên vẹn lên GitHub.
- Không để server.js nằm trong thư mục con.
- Nếu Render báo Not Found, 90% là upload sai cấu trúc thư mục.
- Bản này là app web, không cần CHAY_APP.bat.
- Dữ liệu SQLite trên Render free nên xuất CSV backup định kỳ.
