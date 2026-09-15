# Careerlyst — Full Platform Build

This build preserves the current Careerlyst visual direction: warm cream, black typography, lime accent, restrained borders, editorial spacing, and the existing hero illustration.

## Included
- Public marketing site: Home, Services, Service Detail, Pricing, About, Contact, Legal placeholders
- React + Vite application
- Client signup/login flow
- Client dashboard: Overview, Profile, Orders, Messages, Files, Payments, Notifications, Settings
- Order progress and revision-ready message thread UI
- Limited-capacity positioning and queue-aware dashboard copy
- Admin control panel: Overview, Users, Orders & Queue, Projects, Payments, Messages, Files, Services, Reviews, Coupons, Notifications, Settings
- Demo mode using localStorage so the UI can be tested immediately
- Supabase-ready auth client via `.env`

## Run
1. Install Node.js LTS.
2. Copy `.env.example` to `.env` if using Supabase.
3. Run `cd .\Careerlyst-Full`.
4. Run `npm run dev`.
5. Open the local URL shown by Vite.

## Production backend
The UI is ready to connect to Supabase. Before launch, add:
- Supabase Auth
- PostgreSQL tables and RLS policies
- user/admin RBAC
- Storage buckets for client files
- payment provider + webhooks
- transactional email
- server-side order/capacity rules

Do not rely on the demo admin preview for production authorization. Admin permissions must be enforced in the backend/database.

cd .\Careerlyst-Full

dir

npm install

npm run dev

@Ashik2005@@