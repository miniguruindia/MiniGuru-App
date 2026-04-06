# MiniGuru Admin Panel Setup Guide

## Port Configuration
- **Admin Frontend**: PORT 3000 (Next.js)
- **Backend API**: PORT 5001 (Express.js)
- ✅ No port 3001 in use

## Prerequisites
- Backend must be running before accessing admin features
- Admin uses `http://localhost:5001` as the default API base
- Environment: `.env.local` for admin, `.env` for backend

---

## Starting the Services

### 1️⃣ Start Backend (Terminal 1)
```bash
cd backend
npm run dev
# or
npm start
```

**Expected output:**
```
🚀 Server running on 0.0.0.0:5001
🌐 CORS enabled for all origins (development mode)
📡 Ready to accept requests
```

**Verify backend is running:**
```bash
curl http://localhost:5001/health
# Expected: {"status":"healthy","uptime":...}
```

---

### 2️⃣ Start Admin (Terminal 2)
```bash
cd admin
npm run dev
```

**Expected output:**
```
▲ Next.js 15.1.4
Local: http://localhost:3000
```

---

## Configuration Files

### ✅ Admin (admin/.env.local)
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001
NEXT_PUBLIC_API_URL=http://localhost:5001
HOSTNAME=0.0.0.0
PORT=3000
```

### ✅ Backend (backend/.env)
```env
PORT=5001
NODE_ENV=development
DATABASE_URL=mongodb+srv://...
# ... other configs
```

---

## Troubleshooting

### Error: "Backend not connected"
**Cause**: Backend is not running or not accessible

**Fix**:
1. Verify backend is running on port 5001:
   ```bash
   curl http://localhost:5001/health
   ```
2. Check `.env` files are properly configured
3. Restart both services

### Error: "Failed to fetch"
**Cause**: Network/CORS issue or backend unreachable

**Check browser console** for detailed error messages showing:
- API URL being called
- Response status
- Exact error

### Error: "Connection failed: Failed to fetch"
**Cause**: Backend process is not running

**Fix**:
1. Start backend first: `cd backend && npm run dev`
2. Wait 3-5 seconds for server to initialize
3. Refresh admin page

---

## API Connection Flow

```
Browser (Admin @ :3000)
    ↓
fetch() to http://localhost:5001/admin/stats
    ↓
Backend (Express @ :5001)
    ↓
MongoDB / Database
    ↓
Response → Admin Page
```

---

## Quick Diagnostics

Run this to check all connections:
```bash
# Terminal
curl -v http://localhost:5001/health
curl -v http://localhost:5001/admin/stats

# Browser Console (F12 → Console)
console.log('API_BASE:', process.env.NEXT_PUBLIC_API_URL)
fetch('http://localhost:5001/health').then(r => r.json()).then(console.log)
```

---

## Environment Variables (Current)

| Variable | Admin | Backend | Value |
|----------|-------|---------|-------|
| API_URL  | ✅    | N/A     | http://localhost:5001 |
| PORT     | ✅    | ✅      | 3000 / 5001 |
| NODE_ENV | N/A   | ✅      | development |

---

## Pages Status

| Page | Endpoint | Status |
|------|----------|--------|
| Dashboard | `/admin/stats`, `/admin/orders` | ✅ Enhanced error handling |
| Video Approvals | `/admin/projects/pending` | ✅ Enhanced error handling |
| Revenue | `/admin/orders` | ✅ Enhanced error handling |

All pages now show:
- ✅ Detailed error messages
- ✅ Exact API URL being called
- ✅ Response status codes
- ✅ Console logging for debugging
