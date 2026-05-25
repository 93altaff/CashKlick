# CashKlick — PRD

## Overview
CashKlick is a "rewards / earn money" mobile app (Expo + React Native, FastAPI + MongoDB backend). Imported from public GitHub repo `93altaff/CashKlick` and modified per user requirements.

## Source
- Repo: https://github.com/93altaff/CashKlick (public, imported into `/app`)
- Project files preserved: `.env` (frontend + backend), `.git`, `.emergent`

## Stack
- **Frontend**: Expo Router (SDK 54), React Native 0.81, lucide-react-native icons, react-native-google-mobile-ads (AdMob), expo-linear-gradient, expo-network, expo-image-picker.
- **Backend**: FastAPI + Motor (MongoDB).
- **Auth**: Device-bound auth (one device = one account). Hidden admin login via long-press on Profile → Logout (≥800 ms).
- **Ads (AdMob)**: `react-native-google-mobile-ads` with Google official **test ad IDs** as defaults. Real ads only render in a custom dev/standalone build — Expo Go and the web preview show a styled "Sponsored" placeholder card.

## Modifications applied on top of the imported repo
1. **Admin login**: Long-press the red Logout button on the **Profile** tab opens the admin modal (credentials live in `/app/memory/test_credentials.md`). Backend creds set from `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
2. **Quiz / Survey**:
   - 107 quiz + 50 survey questions seeded from `/app/backend/questions.py` (admin can override via CRUD).
   - `/api/quiz/today` and `/api/survey/today` return **20 deterministic random questions** per user per day.
   - One-question-per-screen UI with progress bar and "Next" button.
   - On final submit a **rewarded ad** is shown; if the user dismisses it early, the task is reset and they must restart.
   - Reward is **50–200 random points** (range per user request) credited only when `ad_watched=true` is posted.
   - Native ad rendered at the bottom of the screen.
3. **Visit & Earn**:
   - Native ad rendered at the top.
   - Sites listed in a scrollable `FlatList` (cards) — only one task can be active at a time.
   - 15-second stay timer enforced via `AppState`: if the user returns from the external browser before the timer ends, a warning card appears ("Stay X seconds more · Reopen / Cancel"); if they return after the timer ends, **50–100 random points** are credited.
4. **Task details screen**: Screenshot upload form **removed**. Tasks with `require_mobile`/`require_email` use those inputs; tasks with no extra info use the "Payment Received" button.
5. **Admin panel** (new tabs):
   - **Visit Sites**: add/delete sites users can visit for points.
   - **Quiz Bank**: add/delete quiz questions (overrides the seeded bank).
   - **Survey Bank**: add/delete survey questions.
   - **Ads**: edit AdMob App ID + Banner / Native / Rewarded / Interstitial unit IDs (changes to App ID require a new native build; unit IDs apply at runtime).

## Backend Endpoints (prefix `/api`)
Auth: `POST /auth/admin-login`, `POST /auth/device-login`, `POST /auth/device-register`, `GET /auth/me`, `POST /auth/logout`.
Public: `GET /config` (now includes user-editable `admob` block).
User: `GET /tasks`, `GET /tasks/{id}`, `POST /tasks/{id}/submit`, `POST /tasks/{id}/payment-received`, `POST /earn/checkin`, `GET|POST /earn/spin{,/state}`, `GET|POST /earn/scratch{,/state}`, `GET /visits`, `POST /visits/{id}/complete` (50–100 pts), `GET /watch`, `POST /watch/{id}/complete`, `GET /quiz/today` (20 questions), `POST /quiz/submit` (requires `ad_watched=true`), `GET /survey/today`, `POST /survey/submit`, `GET /wallet`, `GET|POST /withdrawals`.
Admin (new): `GET|POST|DELETE /admin/quiz-bank`, `GET|POST|DELETE /admin/survey-bank`, `GET|PUT|DELETE /admin/visits`, `PUT /admin/ads`. Plus all existing admin endpoints.

## Seed
On startup: 3 banners, 3 tasks, 2 visit sites, 1 watch video, admin user (`93altaff@gmail.com`), demo user (`demo@cashclick.app`, token `demo_session_token_001`, 500 pts). Quiz/Survey questions come from `/app/backend/questions.py` until an admin overrides via the admin app.

## Limitations
- Real AdMob ads only work in a custom dev/standalone build, not in Expo Go or the web preview. The app gracefully renders a `Sponsored` placeholder card and resolves rewarded-ad promises to `true` so previews remain testable.
- App ID changes require a new native build to take effect (config plugin injects native meta-data at build time).
