# Promise Keeper

Ứng dụng quản lý lời hứa & công việc hằng ngày (tiếng Việt).

Kiến trúc web:

```
 iPhone / Macbook (Browser / PWA)
        ↓
Vercel  →  React UI (web/)        chỉ giao diện
        ↓  gọi API (HTTP)
Railway →  Express API (server/)  →  PostgreSQL
           (ghi/đọc dữ liệu ở đây)
```

Bản desktop cũ (Electron + SQLite) vẫn giữ ở `electron.js` + `preload.js` + `backend/`.

## Cấu trúc

```
promise-keeper/
├── web/        # Frontend React + Vite  → deploy lên Vercel
│   ├── src/                 # UI (dùng window.api; web build tự gắn HTTP client)
│   ├── src/lib/apiClient.js # HTTP client mô phỏng window.api
│   ├── public/manifest.json # PWA (Add to Home Screen)
│   └── vercel.json
├── server/     # Backend Express + PostgreSQL → deploy lên Railway
│   ├── server.js            # khởi tạo app + mount routes
│   ├── db.js                # pg Pool + schema + migrations
│   ├── lib/                 # dates, todos (getTodosForDate, streak helpers)
│   └── routes/              # people, promises, steps, todos, integrity, streak
├── electron.js # Desktop (legacy)
└── preload.js
```

## Chạy local

### 1. Backend (server/)
Cần một PostgreSQL (local hoặc Railway). Tạo `server/.env` từ `server/.env.example`:

```bash
cd server
cp .env.example .env      # điền DATABASE_URL
npm install
npm run dev               # http://localhost:3001
```

### 2. Frontend (web/)
Tạo `web/.env` từ `web/.env.example` (trỏ tới API ở trên):

```bash
cd web
cp .env.example .env      # VITE_API_URL=http://localhost:3001
npm install
npm run dev               # http://localhost:5173
```

## Deploy

### Railway (API + PostgreSQL)
1. Tạo project mới trên Railway → **Add PostgreSQL** (Railway tự set biến `DATABASE_URL`).
2. **Add Service → GitHub repo**, đặt **Root Directory = `server`**.
3. Biến môi trường cho service:
   - `DATABASE_URL` — tham chiếu tới Postgres (Railway gợi ý sẵn).
   - `CORS_ORIGIN` — URL Vercel của bạn (vd `https://promise-keeper.vercel.app`).
   - `APP_TZ` — `Asia/Ho_Chi_Minh` (mặc định).
4. Deploy → lấy URL công khai (vd `https://promise-keeper-api.up.railway.app`).

### Vercel (React UI)
1. Import GitHub repo vào Vercel.
2. **Root Directory = `web`** (Framework: Vite, tự nhận).
3. Environment Variable:
   - `VITE_API_URL` — URL Railway ở trên.
4. Deploy → mở URL trên iPhone Safari → **Share → Add to Home Screen**.

## Bản desktop (Electron — tuỳ chọn)
```bash
npm install        # cài electron + better-sqlite3 ở root
npm start          # chạy desktop, dữ liệu SQLite ở backend/promises.db
```

## Lưu ý
- Schema đã có sẵn cột `user_id` (mặc định 1) ở `people`, `promises`, `todos` để sẵn sàng multi-user/auth về sau — hiện chạy ở chế độ một người dùng.
- Ngày/giờ lưu dạng TEXT `YYYY-MM-DD` để giữ nguyên logic streak/integrity; "hôm nay" tính theo `APP_TZ`.
- Icon PWA hiện là SVG (`web/public/icon.svg`). iOS đẹp hơn với PNG 180×180 — có thể thay sau bằng `apple-touch-icon.png`.
