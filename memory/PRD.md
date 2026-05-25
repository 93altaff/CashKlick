# CashClick — PRD

## Overview
CashClick is a "rewards/earn money" mobile app (Expo + React Native). Users sign in with Google, complete tasks (PhonePe signup, Groww demat, etc.), spin/scratch for daily points, take daily check-ins, watch videos, complete quizzes/surveys, and withdraw earnings via UPI/Bank.

## Source
Imported from public GitHub repo: https://github.com/93altaff/CashKlick

## Stack
- **Frontend**: Expo Router (SDK 54), React Native 0.81, lucide-react-native icons, expo-linear-gradient, expo-network, expo-image-picker.
- **Backend**: FastAPI + Motor (Mongo).
- **Auth**: Emergent-managed Google Auth (`/api/auth/session` exchanges `session_id`); hidden admin email/password login (`/api/auth/admin-login`) — tap the logo 7× on the splash to reveal.
- **Ads**: `<AdBanner/>` placeholder shown on every tab bar (real AdMob requires a native dev build; Expo Go shows the placeholder).

## Key Screens
- `/` — Splash + Google login + hidden admin modal.
- `/(tabs)` — Home, Earn, Wallet, Profile (bottom tab + ad banner).
- `/task/[id]` — Task detail / submit (mobile, email, screenshot upload).
- `/earn/{spin,scratch,visit,watch,quiz,survey,checkin,refer}`.
- `/withdraw` — UPI / Bank withdrawal flow.
- `/admin` — Stats, users, tasks, banners, submissions, withdrawals, settings, leaderboard.

## Backend Endpoints (prefix `/api`)
Auth: `POST /auth/session`, `POST /auth/admin-login`, `GET /auth/me`, `POST /auth/logout`.
Public: `GET /config`, `GET /banners`, `GET /logo`.
User: `GET /tasks`, `GET /tasks/{id}`, `POST /tasks/{id}/submit`, `POST /tasks/{id}/payment-received`, `POST /earn/checkin`, `GET|POST /earn/spin{,/state}`, `GET|POST /earn/scratch{,/state}`, `GET /visits`, `POST /visits/{id}/complete`, `GET /watch`, `POST /watch/{id}/complete`, `GET /quiz/today`, `POST /quiz/submit`, `GET /survey/today`, `POST /survey/submit`, `GET /wallet`, `GET|POST /withdrawals`.
Admin: tasks/banners/visits/watch CRUD, submissions approve/reject, withdrawals approve/reject, users search + details + adjust, stats, leaderboard, settings, seed.

## Seed
On backend startup the DB auto-seeds: 3 banners, 3 tasks (PhonePe, Groww, Amazon Pay), 2 visit sites, 1 watch video, 1 quiz, 1 survey, global settings, admin user, and a demo user (`demo@cashclick.app`, token `demo_session_token_001`, 500 points).

## Admin Credentials
See `/app/memory/test_credentials.md`.
