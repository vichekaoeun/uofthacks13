# NowAndThen

A location‑first mobile map that captures and surfaces local memories (text, photos, video) and turns user behavior into actionable product intelligence.

**One sentence impact:** NowAndThen helps communities discover, understand, and care for places by turning raw location‑based activity into human‑readable place identities and timely product actions.

## Demo
[![NowAndThen Demo](https://img.youtube.com/vi/zJKlMqIgn7k/maxresdefault.jpg)](https://www.youtube.com/watch?v=zJKlMqIgn7k)

---

## Quick pitch

Places hold memories that vanish when you leave. NowAndThen makes those traces persistent: users leave posts tied to coordinates, clusters form around places, and the app can generate human‑readable summaries from post content when requested.

---

## Why this matters (Impact)

- **Discovery:** replace cryptic local noise with labeled, searchable place identities so people find meaningful nearby content faster.
- **Preservation:** let local memories accumulate into a place's personality, surfacing history that would otherwise disappear.
- **Actionable insights:** provide admin tools and human summaries to help maintainers prioritize and curate local content.

---

## Who is this for

- **Users:** campus students, staff, local residents, and community moderators who want to capture and rediscover local moments.
- **Problem:** local posts are noisy, transient, and hard to surface; product teams lack behavioral signals to prioritize places or intervene effectively.
- **Solution:** tie posts to GPS, cluster them into place candidates, auto‑label and summarize with AI, and use event signals to recommend product actions.

---

## Features & outcomes

- **Geolocated posts:** capture text, photo, or short video at exact coordinates (outcome: persistent place memories).
- **Place clustering + naming:** group nearby posts and produce human labels (reverse geocoding + heuristics) so places are discoverable.
- **On‑demand summaries:** generate readable summaries from posts when a user requests a cluster identity.
- **Trail replay:** visualize a temporal path of posts to tell local stories.
- **Media support:** photo/video capture, upload, and thumbnails in cluster view.

---

## Tech stack

- **Frontend:** React Native (Expo), TypeScript, `react-native-maps`
- **Backend:** Node.js + Express
- **Database:** MongoDB (Atlas)
- **Maps:** Google Maps reverse geocoding + in-app clustering

---

## Measurable outcomes

- **Increased discoverability:** labeled clusters increase content findability and session length.
- **Improved engagement:** action suggestions (nudges, promotion) aim to lift likes and comments in underperforming places.
- **Safer map:** event signals + AI help surface moderation candidates early.

Each recommendation is measurable—apply it and track delta in event rates.

---

## Architecture (brief)

- **Frontend:** React Native (Expo) + `react-native-maps` with client‑side clustering and media handling.
- **Backend:** Node + Express, MongoDB for posts/events, a geocode cache, and endpoints to request cluster summaries.
- **Data flow:** client emits events and posts → backend persists them → AI consumes aggregated inputs → returns structured identity + action suggestions → UI surfaces/applies suggestions.

---

## Quickstart (developer)

### Setup

```bash
git clone <repo-url>
cd nowandthen
```

### Backend

```bash
cd backend
cp .env.example .env    # Set MONGO_URI, GOOGLE_MAPS_API_KEY, JWT_SECRET
npm install
npm run dev             # Uses nodemon
```

**Troubleshooting:** If Mongo Atlas TLS/SSL fails locally, either whitelist your IP in Atlas, run a local Mongo for development, or adjust driver options in `backend/database.js` for dev only.

### Frontend

```bash
cd ..
npm install
expo start
```

Run on device or emulator.

---

## Tips & troubleshooting

- **Mongo TLS/SSL:** if Atlas connection fails locally, prefer whitelisting IP or local Mongo; `backend/database.js` includes a dev fallback (insecure) only for quick testing.
- **Clustering:** adjust the zoom multiplier in `app/(tabs)/index.tsx` if clusters trigger too soon.
- **Geocode API:** backend caches results — tune TTL to balance cost and freshness.

---

## What we're proud of

- A clear product concept (place identity) turned into a working mobile prototype.
- Polished map experience with radius‑controlled discovery, clustering, media thumbnails, and trail animation.
- Readable summaries generated on demand from cluster posts.

---

## What's next

- Consider adding optional analytics or a lightweight `/api/events` endpoint and a client `trackEvent()` helper to measure product impact.
- Lightweight moderation and reporting tools.
- A simple experiments system to apply AI suggestions and measure lift on event rates.
- Precompute cluster titles and identities offline to reduce API calls and improve load time.

---

MIT
