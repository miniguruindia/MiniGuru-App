# MiniGuru Backend Deployment

This backend is an Express + Prisma app that currently uses MongoDB via Prisma.

## Recommended Google Cloud setup

### Best fit for this repo
- Keep the backend on **Google Cloud Run**.
- Use **MongoDB Atlas** (or another MongoDB-compatible service) because the Prisma schema is already built for MongoDB.
- Do not migrate to **Firestore** yet unless you want a full backend rewrite.

### Why Firestore is not the best immediate choice
- The current app uses complex relations, nested types, and transactional workflows.
- Firestore is a good fit for simpler, denormalized document models, but this project would require a major refactor.
- For now, the easiest path is to keep the existing Prisma/MongoDB architecture and deploy the backend to Cloud Run.

## Cloud Run deployment

1. Build the container image:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/miniguru-backend ./backend
```

2. Deploy to Cloud Run:

```bash
gcloud run deploy miniguru-backend \
  --image gcr.io/PROJECT_ID/miniguru-backend \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "PORT=8080" \
  --set-env-vars "DATABASE_URL=..." \
  --set-env-vars "JWT_SECRET=..." \
  --set-env-vars "REFRESH_TOKEN_SECRET=..."
```

3. Set a max instance limit for cost control if needed:

```bash
gcloud run services update miniguru-backend --max-instances=1 --region asia-south1
```

## Environment variables

Use the `.env.example` file as a template.

## Database recommendations

- **Best current choice:** MongoDB Atlas free tier on GCP.
- **Alternative Google-managed path:** If you want a Google-managed database later, consider **Cloud SQL (PostgreSQL)**, but that will require schema migration.
- **Firebase / Firestore path:** Only if you want a full future rewrite. Firestore is not a direct drop-in replacement for the current Prisma/MongoDB design.

## YouTube API

The YouTube integration will continue to work on Cloud Run as long as you set the YouTube environment variables and keep OAuth credentials configured.

## Notes

- Keep sensitive values in Cloud Run environment variables or Secret Manager.
- Use `PORT=8080` in Cloud Run, since the Dockerfile exposes that port.
- Cloud Run free tier is usually enough for a small user base such as 500 users with moderate activity.
