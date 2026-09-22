# SalonFlow Frontend (Rebranded + Fixed)

Same pages and functionality as the original, restyled to actually look
like a salon product, plus the frontend-side bugs found during the audit,
plus new features: a real services catalog (owner-managed, used when
customers book), and customer feedback/reviews on completed appointments.
See `CHANGES.md` for the full list.

## Setup

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_API_URL to point at your backend
npm install
npm run dev
```

This frontend expects the backend to be running against the rebuilt
single-salon database - see `../database/README.md` for the required
setup order before starting either side.

This frontend expects the **enhanced backend** (with the role/permission
fixes) - specifically the new `POST /auth/register-owner` endpoint used by
`app/auth/register/page.tsx`.

## Theme

The whole app previously used shadcn/ui's stock blue-and-gray default
theme - a generic SaaS look with no connection to "salon." It's been
rebranded:

- **Colors**: deep rose/wine as the primary brand color, warm stone
  neutrals instead of cold gray, soft gold as a decorative accent. Defined
  as CSS variables in `app/globals.css`, consumed everywhere through
  Tailwind tokens (`bg-primary`, `text-muted-foreground`, etc.) rather than
  hardcoded colors, so the whole app reads as one consistent theme.
- **Type**: Playfair Display (serif) for headings/branding, Inter (sans)
  for body/UI text - gives the boutique/salon feel on marketing and auth
  screens while keeping dashboards and tables readable.
- **Shape**: a softer border radius (0.9rem vs. the original 0.5rem) for a
  more "spa" feel than a sharp corporate dashboard.

Every page composes from the same shared primitives (`Button`, `Card`,
`Input`, `Badge`, etc. in `components/ui/`), which is why a change to the
theme tokens cascades through the entire app - dashboard tables, customer
pages, billing screens - without having to touch each page's business
logic individually. The pages that got a deeper visual pass by hand are
the ones a new visitor/owner/customer actually sees first: the landing
page, all five auth screens (now sharing one `AuthShell` component), and
the sidebar/nav chrome.
