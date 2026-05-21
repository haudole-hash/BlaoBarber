# B'Lao — Hướng dẫn cài trên máy tiệm

Ứng dụng chạy **hoàn toàn trên máy local** (không cần internet sau khi cài). Dữ liệu lưu tại:

`%APPDATA%\BLaoBarber\data.db`

---

## Cách 1 file — bấm là xài (khuyên dùng khi gửi cho tiệm)

Trên **máy lập trình** (có internet, chạy một lần):

```powershell
cd D:\BLaoBarber
npm install
npm run package:exe
```

Sau vài phút, trong `release\` có **một file** dạng:

`BLaoBarber-1.0.0-portable.exe` (khoảng 150–200 MB)

**Gửi đúng file `.exe` đó** cho chủ tiệm → bấm đúp → cửa sổ app mở ra, **không** cần cài Node, **không** cần thư mục `scripts`, `dist`, v.v.

- Dữ liệu vẫn lưu: `%APPDATA%\BLaoBarber\data.db`
- Tắt app = đóng cửa sổ chương trình

---

## Cách thư mục + file `.bat` (nhẹ hơn, ~50 MB, cần cài Node)

### Quan trọng: không chỉ gửi file `.bat`

File `**Mo-Quan-Ly-Tiem.bat`** chỉ là nút mở app. Nó **cần** các thư mục/file cùng một chỗ:

```
BLaoBarber/
  Mo-Quan-Ly-Tiem.bat    ← bấm file này
  scripts/
  server/
  dist/
  node_modules/
  package.json
```

- **Gửi riêng mỗi file `.bat`** (USB, Zalo, email…) → **sẽ lỗi**, vì không có chỗ để “ref” (tham chiếu) code và giao diện.
- **Đúng cách:** gửi **cả thư mục** hoặc file `**BLaoBarber-gui-tiem.zip`** (sau khi đóng gói), giải nén rồi bấm `.bat` **bên trong** thư mục đó.

Shortcut trên Desktop **được**, nhưng phải trỏ tới `.bat` trong thư mục đầy đủ (xem bước 3 bên dưới), **không** phải copy mỗi file `.bat` ra Desktop.

---

## Cách dùng hàng ngày (chủ tiệm)

1. Bấm đúp `**Mo-Quan-Ly-Tiem.bat`** (hoặc shortcut trên Desktop).
2. Trình duyệt mở trang quản lý — dùng như bình thường.
3. **Đóng cửa sổ đen (CMD)** = tắt phần mềm. Nên để mở trong giờ làm việc.

Nếu app đã chạy rồi, bấm shortcut lần nữa chỉ **mở thêm tab trình duyệt**, không tạo bản copy thứ hai.

---

## Cài lần đầu trên máy mới

### Bước 1 — Node.js (chỉ cần 1 lần)

Tải **Node.js 22 LTS** (Windows 64-bit): [https://nodejs.org](https://nodejs.org)  

Cài xong, mở CMD gõ `node -v` phải thấy số phiên bản (vd. `v22.x`).

### Bước 2 — Copy thư mục app

Copy cả thư mục `BLaoBarber` (hoặc `release\BLaoBarber` sau khi đóng gói) vào ổ cứng, ví dụ:

`C:\BLaoBarber`

### Bước 3 — Shortcut Desktop (bản `.exe`)

```powershell
cd D:\BLaoBarber
npm run shortcut:exe
```

Tạo icon **`BLao Quan ly tiem`** trên Desktop (có thể trong OneDrive Desktop).

**Lưu ý:** Bấm file `.exe` trong `release\` **không** tạo shortcut. Phải bấm **icon trên Desktop** sau khi chạy lệnh trên.

---

## Đóng gói từ máy dev (người lập trình)

Trên máy có source code — **một lệnh** build + đóng gói + tạo ZIP gửi tiệm:

```powershell
cd D:\BLaoBarber
npm install
npm run package
```

Kết quả:


| Đường dẫn                         | Dùng để                                    |
| --------------------------------- | ------------------------------------------ |
| `release\BLaoBarber\`             | Copy cả thư mục sang máy tiệm              |
| `release\BLaoBarber-gui-tiem.zip` | Gửi file ZIP, tiệm giải nén rồi bấm `.bat` |


Chỉ cần `package:win` (không ZIP): `npm run package:win`

---

## Không cần cài Node trên máy tiệm? (tuỳ chọn)

Tải bản **Node Windows Binary (.zip)** từ nodejs.org, giải nén vào:

`C:\BLaoBarber\runtime\node\`

Trong đó phải có `node.exe`. File `.bat` sẽ tự dùng Node này.

---

## Xử lý sự cố


| Triệu chứng                  | Cách xử lý                                              |
| ---------------------------- | ------------------------------------------------------- |
| Báo không tìm thấy Node      | Cài Node 22+ hoặc thêm `runtime\node\node.exe`          |
| Trang trắng / không vào được | Đảm bảo đã chạy `npm run build` (có thư mục `dist`)     |
| Cổng 3847 bị chiếm           | Tắt cửa sổ CMD cũ của BLaoBarber hoặc khởi động lại máy |
| Mất dữ liệu                  | Sao lưu file `%APPDATA%\BLaoBarber\data.db`             |


---

## Lưu ý bảo mật

- App chỉ lắng nghe `127.0.0.1` — máy khác trong mạng **không** truy cập được.
- Nên sao lưu `data.db` định kỳ (USB / OneDrive).

