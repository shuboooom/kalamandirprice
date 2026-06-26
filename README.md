# Daily Gold Rate Tracker

Firebase Hosting serves a React dashboard, while Firebase Functions fetch and store daily gold rates in Firestore.

## Architecture

- `web/`: React + Vite dashboard
- `functions/`: Firebase Functions v2 APIs and scheduler
- Firestore collections:
  - `goldRates/{YYYY-MM-DD}`
  - `meta/latestGoldRate`

## Endpoints

- `GET /api/latest`
- `GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=90`

## Source

Rates are fetched from:

- `https://api.kalamandirjewellers.com/api/goldRate/getAllApis`

The scheduler runs daily at `11:20 AM IST`.

## Local setup

1. Install dependencies:
   - `cd functions && npm install`
   - `cd ../web && npm install`
2. For local Vite development, set the API base:
   - `cp web/.env.example web/.env.local`
   - replace `your-firebase-project` with your Firebase project id
3. Build the frontend:
   - `cd web && npm run build`
4. Deploy:
   - `firebase deploy`

## Testing

- Backend: `cd functions && npm test`
- Frontend: `cd web && npm test`

## Notes

- Firestore already supports single-field ordering on `date`, so no composite index is required for the v1 history queries.
- Firestore is locked down; only Functions read and write data in v1.
