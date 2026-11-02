# B'Lao Barbershop — Master Management

App quản lý tiệm cắt tóc (Dashboard, Services, Orders) chạy local với SQLite.

## Yêu cầu

- **Node.js 22.5+** — dùng SQLite tích hợp sẵn, **không cần** Python / Visual Studio Build Tools

## Chạy development

```powershell
cd D:\BLaoBarber
# Nếu lỗi npm.ps1: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
npm.cmd install
npm.cmd run dev
```

- Giao diện: http://localhost:5173
- API + SQLite: http://127.0.0.1:3847

Database tự lưu tại: `%APPDATA%\BLaoBarber\data.db`

## Chạy production (một process)

```bash
npm run build
npm start
```

Mở http://127.0.0.1:3847

## Luồng nghiệp vụ

1. **Services** — thêm/sửa/xóa dịch vụ và giá
2. **Orders** — tạo đơn → Đang làm → Thu tiền (hoàn thành) hoặc Giữ (held)
3. **Dashboard** — tổng khách, doanh thu, thống kê theo dịch vụ hôm nay
