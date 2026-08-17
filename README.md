# Appz — Local-First Goals & Habit Tracker (Mobile MVP Spec)

## Product Summary
Appz is a **local-first**, beginner-friendly mobile app for tracking personal goals and habits across life domains (for example: **Skincare**, **Gym/Fitness**, **Study**).  
It is intentionally minimal and opinionated: quick logging, simple dashboards, and zero clutter.

## Target Platform
- **React Native (Expo) for cross-platform iOS + Android**

Why: fastest iteration for a learning-friendly but daily-usable app, single codebase, strong local-storage ecosystem.

## Hard Constraints
- **Budget:** near-zero infra cost (no required backend)
- **Timeline:** 4–6 week MVP
- **Use case:** daily-use personal tracker, built with beginner-friendly UX
- **Device assumptions:** mid-range phones (4GB+ RAM, modern iOS/Android versions)
- **Offline first:** fully functional with no internet

## Core Principles
- Local-first and private by default
- No account required
- Fast mobile UX (large tap targets, quick-log buttons, low typing)
- Minimal configuration, guided defaults

## Core Features
### 1) Multi-domain tracking
User can create domains such as:
- Skincare
- Gym/Fitness
- Study

Each domain has:
- Domain dashboard
- Custom trackable metrics (boolean, numeric, duration, note-lite)
- Daily/weekly logs
- Streak tracking
- Lightweight trend charts

### 2) Logging UX
- One-tap “quick log” actions
- Preset values to reduce text entry
- Optional short notes only

### 3) Progress visualization
- Sparkline/trend line for each metric
- Weekly summary cards
- Current streak + longest streak

## Storage & Architecture
- **Database:** SQLite on-device (via Expo SQLite / equivalent RN SQLite package)
- **No mandatory sync:** all data stored locally
- Optional export/import (JSON) for backups

### Suggested local schema (MVP)
- `domains(id, name, color, icon, created_at)`
- `metrics(id, domain_id, name, type, unit, target, created_at)`
- `logs(id, domain_id, metric_id, value_number, value_bool, value_text, logged_at)`
- `streaks(domain_id, metric_id, current_streak, longest_streak, updated_at)`
- `skin_sessions(id, captured_at, lighting_score, angle_score, consent_api_upload, local_image_uri)`
- `skin_analysis(id, skin_session_id, redness_score, texture_score, acne_score, hydration_score, summary, created_at, model_type)`

## Skincare AI Progress Tracker
For skincare only:
1. App guides user to capture periodic photos (consistent lighting/angle prompts).
2. AI extracts visual trend signals over time:
   - Texture
   - Redness
   - Acne count/severity estimate
   - Hydration-related visual cues
3. App generates:
   - Progress summary text
   - Trend graph for tracked skin signals

### Safety & Privacy Language (required in UI)
- “This feature is a casual visual-comparison tool and **not** a dermatological diagnostic instrument.”
- “Photos stay on your device by default.”
- “Photos are only sent externally if you explicitly enable cloud analysis.”

## AI Strategy Decision
**Hybrid approach (recommended):**
- Default: lightweight **on-device** scoring/model heuristics for privacy + offline usage
- Optional: user-enabled **cloud vision API** for richer analysis

Tradeoffs:
- On-device: better privacy, no API cost, lower model sophistication
- Cloud API: higher quality insights, but cost + explicit consent + network required

## MVP Delivery Scope
- Domain creation and dashboards
- Metric setup + quick daily/weekly logging
- Streaks and trend charts
- Skincare photo capture flow
- AI comparison summaries with explicit non-diagnostic disclaimer
- Strict local-first storage

## Out of Scope (MVP)
- Social features
- Mandatory accounts/sync
- Complex automation/rule engines
