# QuantAI — AI-Powered Indian Stock Market Platform

> A production-grade, full-stack investment platform with real-time NSE data, Google Gemini AI analysis, live WebSocket price streaming, and a comprehensive portfolio management suite.

---

## Live Demo

- **Frontend:** [quantai.vercel.app](https://quantai.vercel.app)
- **Backend API Docs:** [quantai-backend.azurewebsites.net/docs](https://quantai-backend-ecdzdyesauhmdtg7.centralindia-01.azurewebsites.net/docs)

---

## Features

### Real-Time Market Data
- Live NSE stock prices via **Angel One SmartAPI** with WebSocket streaming
- Custom 450ms rate limiter and in-memory price cache across 42 NSE stocks + major indices
- **yfinance** fallback with persistent session headers to avoid 401 crumb errors
- Market hours gating — WebSocket only connects during live trading hours

### AI-Powered Analysis
- **Multi-turn AI stock chat** powered by Google Gemini with full conversation history
- **Structured news analysis** — articles processed through Gemini into 7-section insights
- **Confidence-scored technical analysis** — RSI, MACD, EMA, Bollinger Bands, Support/Resistance levels combined into a 0–100 score with BUY/SELL/HOLD verdict

### Portfolio Management
- Real-time portfolio valuation with live P&L per holding
- Transaction history with Zerodha and Angel One CSV import support
- Watchlist with live price tracking and 1-day change calculation

### Charts & Screener
- Pure **HTML Canvas candlestick chart renderer** (replaced Recharts for reliable y-axis scaling)
- Line and area charts for portfolio performance
- NSE screener across 42 stocks with **golden cross** and **volume signal** detection
- 3-stock comparison engine with side-by-side metrics

### Alerts & Notifications
- Price alerts with above/below conditions
- Email notifications via Gmail SMTP
- Web Push notifications via VAPID + service worker
- Background alert scheduler running every 30 seconds via APScheduler

### Authentication
- JWT-based auth with access + refresh token pattern
- Silent token refresh every 12 hours via `TokenRefresher` component
- Protected routes via FastAPI dependency injection

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Backend | FastAPI, Python, Pydantic, APScheduler |
| Database | MongoDB Atlas M0 |
| Live Prices | Angel One SmartAPI, yfinance |
| AI | Google Gemini |
| Charts | HTML Canvas (candlesticks), Recharts (line/area) |
| Auth | JWT, bcrypt |
| Push | Web Push API, VAPID, pywebpush |
| Payments | Razorpay |
| Deployment | Vercel (frontend), Azure App Service F1 (backend) |
| Process Manager | Gunicorn + UvicornWorker |

---

## Architecture

```
Browser (Next.js 14 — Vercel)
         │
         │ HTTP / WebSocket
         ▼
FastAPI Backend (Azure App Service — Central India)
         │
         ├── routes/          ← Thin HTTP controllers
         ├── services/        ← All business logic
         │   └── analysis/    ← data.py, indicators.py, analysis.py
         ├── database/        ← MongoDB collections
         └── main.py          ← App init, routers, CORS, lifespan
         │
         ├── MongoDB Atlas    ← Users, portfolio, alerts, watchlist
         └── External APIs    ← Angel One, Gemini, yfinance, Razorpay
```

**Key architectural decisions:**
- Routes → Services separation — routes handle HTTP only, all logic in services
- `analysis/` sub-package split by responsibility: `data.py` (fetch), `indicators.py` (math), `analysis.py` (orchestrate)
- In-memory price cache with 5-second TTL stops hammering Angel One on every request
- Frontend never calls external APIs directly — all keys stay server-side

---

## Project Structure

```
AI-INVESTEMENT-AGENT/
├── backend/
│   ├── app/
│   │   ├── routes/          # auth, market, portfolio, watchlist, alerts,
│   │   │                    # pnl, charts, analysis, ai, news, payments,
│   │   │                    # push, screener, comparison, transactions, ws
│   │   ├── services/
│   │   │   ├── analysis/    # data.py, indicators.py, analysis.py
│   │   │   ├── angel_one.py, price_cache.py, ai_service.py
│   │   │   ├── alert_scheduler.py, algorithms.py, instruments.py
│   │   │   ├── news_service.py, push_service.py
│   │   ├── database/
│   │   └── main.py
│   ├── requirements.txt
│   └── Procfile
│
└── frontend/
    ├── app/                 # dashboard, portfolio, market, analysis,
    │                        # charts, screener, compare, pnl, watchlist,
    │                        # alerts, ai, news, optimize, transactions
    ├── components/          # Sidebar, Skeletons, ErrorBoundary,
    │                        # AdvancedChart, StockChart, TokenRefresher,
    │                        # ParticleCanvas, MarketStatusBadge
    ├── hooks/               # useLivePrices, useMarketStatus,
    │                        # usePushNotifications, MarketUI
    └── lib/
        └── apiFetch.ts      # JWT-aware fetch wrapper
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB Atlas account
- Angel One SmartAPI credentials
- Google Gemini API key

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `/backend`:

```env
MONGO_URI=your_mongodb_uri
ANGEL_API_KEY=your_angel_one_api_key
ANGEL_CLIENT_ID=your_client_id
ANGEL_PASSWORD=your_password
ANGEL_TOTP_SECRET=your_totp_secret
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_jwt_secret
ALERT_EMAIL_SENDER=your_email@gmail.com
ALERT_EMAIL_PASSWORD=your_app_password
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your_email@gmail.com
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file in `/frontend`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
```

Run the frontend:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deployment

### Backend — Azure App Service

Startup command:
```bash
gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 app.main:app
```

Set all `.env` variables in Azure → Environment Variables. Connect GitHub repo via Deployment Center for auto-deploy on push.

Keep-warm ping (prevents F1 cold start):
```
https://quantai-backend-ecdzdyesauhmdtg7.centralindia-01.azurewebsites.net/ping
```
Set up on [cron-job.org](https://cron-job.org) every 14 minutes.

### Frontend — Vercel

Connect GitHub repo. Set environment variables in Vercel dashboard. Auto-deploys on every push to `main`.

---

## Key Engineering Decisions

| Decision | Rationale |
|---|---|
| FastAPI over Django | Async-native, built-in WebSocket support, Pydantic validation |
| MongoDB over PostgreSQL | Document model fits portfolio/watchlist data naturally |
| Azure Central India | Lower latency to Angel One's NSE data servers |
| HTML Canvas over Recharts | Reliable y-axis control for candlestick wicks and bodies |
| Inline styles over Tailwind | Design tokens can't be accidentally purged in production |
| Routes → Services split | Routes handle HTTP only; business logic stays independently testable |

---

## Notable Bugs Fixed

- **Hydration mismatch** — `Math.random()` in JSX moved to a constant outside render
- **`useSearchParams()` error** — wrapped in `<Suspense>` boundary on Charts page
- **yfinance 401 crumb error** — fixed with persistent `requests.Session()` + Chrome User-Agent
- **Angel One rate limiting** — `_RateLimiter` class enforcing 450ms minimum between calls
- **WebSocket localhost hardcode** — URL built from env var with `https → wss` protocol swap
- **Azure pip failure** — removed ghost package `annotated-doc` from requirements.txt
- **TokenRefresher wrong method** — changed from GET to POST `/auth/refresh`

---

## Design System

- **Base:** `#111111` background, `rgba(26,26,26,0.85)` cards, `0.5px solid #2c2c2c` borders
- **Fonts:** DM Sans (body) + DM Serif Display (headings and numbers)
- **Semantic accents:** `#3dba6a` UP · `#e05555` DN · `#c4943a` AMB
- **Background:** Ambient canvas with dot grid + slow orbs (no particle physics)
- All pages use inline styles with token constants — no Tailwind

---

## Author

**Ravi Nautiyal**
NIT Jalandhar · [GitHub](https://github.com/RaviNautiyal)

---

*Built as a major personal project to explore full-stack development, real-time systems, and AI integration in the Indian stock market context.*
