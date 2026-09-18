# Changes from the original frontend

## Theme / rebrand

1. Global color remap: every hardcoded `blue-*` → `rose-*` (brand),
   `gray-*`/`slate-*` → `stone-*` (warm neutral), `purple-*` → `fuchsia-*`
   (accent), applied systematically across all 26 files that had hardcoded
   Tailwind colors. `green-*`/`red-*`/`yellow-*`/`orange-*` were left
   untouched since they carry semantic meaning (success/error/warning) and
   remapping them would hurt clarity, not help it.
2. New CSS variable theme in `app/globals.css`: warm ivory background, deep
   rose primary, soft gold accent, softer 0.9rem radius.
3. Added a two-font system (Playfair Display for headings, Inter for body)
   via `next/font/google`, wired into `tailwind.config.js` as `font-serif`
   / `font-sans`.
4. Hand-rebuilt the highest-visibility screens: landing page, all 5 auth
   pages (now sharing a new `components/auth/AuthShell.tsx` instead of
   duplicating the same card markup 5 times), the staff/owner `Sidebar`,
   and both dashboard layouts.

## Bugs found and fixed

5. **Broken owner registration.** `app/auth/register/page.tsx` posted to
   `/auth/register`, which never existed on the backend - this flow was
   completely non-functional. Now calls a new dedicated
   `POST /auth/register-owner` endpoint (added to the backend), which
   creates an owner account with no salon attached (the user then sets up
   their own salon via the existing `/salon-setup` page).
6. **Wrong redirect after customer registration.** After signing up,
   customers were redirected to `/auth/login` (the owner/staff login page)
   with a `?registered=true` flag - but that page doesn't read that query
   param, so the success message never showed and the person landed on the
   wrong login form. Now redirects to `/auth/login-customer?registered=true`,
   which does display it.
7. **"Customer Login" button on the landing page linked to the owner/staff
   login page**, not `/auth/login-customer`. Fixed.
8. **Staff navigation link was entirely commented out** in `Sidebar.tsx`
   ("temporarily hidden for all users"), so owners had no way to navigate
   to staff management from the UI. Restored, gated on `userRole === 'owner'`
   - matches the backend, which now properly restricts staff management to
   owners.
9. **Customer layout's active nav state was hardcoded** - the "Dashboard"
   button always rendered as active regardless of which page was actually
   open, because (unlike the staff `Sidebar`) it never checked `pathname`.
   Fixed to compute active state the same way.
10. **Dead/mismatched API calls in `services/api.ts`**: `authApi.logout()`,
    `appointmentsApi.getToday()`, and `customersApi.getStats()` called
    backend routes that don't exist (`/auth/logout`, `/appointments/today`,
    `/customers/{id}/stats`) and weren't used anywhere in the app. Removed.
    Added corresponding calls for endpoints that *do* exist but had no
    frontend wrapper yet (`approve`, `respond`, `getNotifications`,
    `markNotificationRead`, staff/salon/dashboard APIs).
11. **`.gitignore` was empty**, and `frontend/.env.production` (containing
    real Supabase URL/keys) was committed straight into git. Fixed
    `.gitignore` to actually exclude env files, removed the committed env
    files, and added `.env.example`.
12. **Unused dependencies removed**: `@supabase/supabase-js` and
    `@supabase/ssr` were in `package.json` but never imported anywhere -
    the frontend only ever talks to the FastAPI backend, never Supabase
    directly. Removed to shrink install size and avoid implying a code path
    that doesn't exist.
13. **Stray duplicate file removed**: a literal directory named `@/` at the
    project root (`@/hooks/use-toast.ts`) duplicated `hooks/use-toast.ts`
    byte-for-byte - almost certainly a shadcn CLI/path-alias mishap that
    got committed by accident. The real import (`@/hooks/use-toast`, used
    in `components/ui/toaster.tsx`) resolves via the TS path alias to
    `hooks/use-toast.ts`, so the literal folder was unused clutter.

14. **Session token moved out of localStorage into an httpOnly cookie**
    (this was previously listed as a known limitation - now fixed). The
    backend sets/reads/clears the cookie directly (see backend
    `CHANGES.md` #17); the frontend no longer stores, reads, or attaches
    `access_token` anywhere. Specifically:
    - `services/api.ts`: axios now sends `withCredentials: true` instead of
      manually attaching an `Authorization` header from localStorage;
      `authApi.logout()` calls the new `POST /auth/logout` to clear the
      cookie server-side (localStorage alone can no longer log anyone out,
      since it never held the real credential to begin with).
    - Both login pages no longer read/store `access_token` (it's not even
      in the response body anymore) - only non-sensitive display fields
      (`role`, `user_id`, `username`, `email`) are kept in localStorage,
      purely for quick UI state like the Sidebar's role badge.
    - `dashboard/layout.tsx`, `customer/layout.tsx`, and `salon-setup/page.tsx`
      no longer pre-check `localStorage.getItem('access_token')` before
      calling the backend (that's no longer possible - the cookie isn't
      readable from JS at all). They call `/auth/me` (or the relevant
      endpoint) directly and let the existing 401 handling do the redirect.
    - `Sidebar.tsx` and `customer/layout.tsx`'s logout handlers now call
      `authApi.logout()` before clearing local UI state.

15. **Removed leftover debug code**: several pages (`customer/dashboard`,
    `customer/appointments`, `dashboard/customers`, `dashboard/page.tsx`)
    had emoji-prefixed `console.log` calls left in from development,
    including ones that dumped full appointment/customer response payloads
    to the browser console. One was mislabeled - `app/dashboard/page.tsx`
    (the owner/staff dashboard) had a stray `console.log('🔍 Customer
    Dashboard - ...')`, apparently copy-pasted from the customer dashboard
    page. All removed.

16. **Removed a stray, entirely-empty `src/` tree**
    (`src/pages`, `src/types`, `src/components`, `src/hooks`, `src/utils`)
    plus empty root-level `types/` and `utils/` directories - dead clutter
    left over from what looks like an abandoned `--src-dir` scaffold that
    was later replaced by the root-level `app/`/`components/`/`hooks/`
    structure, without anyone deleting the old empty folders. This was in
    the *original* project already, carried over into the first two
    versions of this rewrite by accident (empty directories don't show up
    in a file-content search, which is how it slipped through). It's not
    just clutter: Next.js (particularly newer versions with Turbopack)
    treats any `pages/` directory as a second routing root and refuses to
    start with `` `pages` and `app` directories should be under the same
    folder``, even if that `pages/` folder is empty and nested under `src/`.
    If you're re-extracting this zip into a project folder that already had
    the old `src/` tree in it, delete that folder manually first - a zip
    extraction only adds/overwrites files, it won't remove pre-existing
    ones that aren't in the archive.

## Product change: owner/staff self-registration removed, customer billing added

17. **Removed `app/auth/register/page.tsx`** (the owner self-signup form)
    per product decision - owners and staff now only log in through this
    app; account provisioning happens elsewhere (see backend `CHANGES.md`
    #18). The "New salon owner? Create your salon account" link on the
    login page was removed along with it, and the now-unused
    `authApi.registerOwner()` was deleted from `services/api.ts`. Customer
    self-registration (`/auth/register-customer`) is unaffected.

18. **Added a customer invoices page** (`app/customer/invoices/page.tsx`,
    linked from the customer sidebar as "My Invoices") - customers can now
    view and download PDFs of their own invoices, using the new
    salon-scoped-*and*-customer-scoped backend endpoints
    (`GET /billing/my-invoices...`, see backend `CHANGES.md` #19). This is
    the properly-scoped version of a feature that was previously either
    wide open (any customer could see the whole salon's invoices) or
    completely blocked (customers had no billing access at all) -
    customers now see exactly their own invoices, nothing more.

## Feature additions: services, feedback, single-salon branding

17. **Booking page** (`app/customer/book/page.tsx`) now uses the real
    services catalog (a dropdown fetched from `GET /services`) instead of
    a free-text "Service" field - price/duration are shown, and the
    appointment's end time is calculated automatically from the chosen
    service's duration.
18. **New owner/staff page**: `app/dashboard/services/page.tsx` - add,
    edit, delete services (name, description, duration, price, category,
    active toggle), linked from the sidebar.
19. **New owner/staff page**: `app/dashboard/feedback/page.tsx` - browse
    all customer reviews with star ratings, linked from the sidebar.
20. **New customer page**: `app/customer/feedback/page.tsx` ("My
    Feedback") - customers can see reviews they've left, linked from the
    customer sidebar.
21. **`app/customer/appointments/page.tsx`**: completed appointments now
    show a "Leave Feedback" button (star rating + optional comment) that
    posts to the new feedback endpoint; once submitted it's replaced with
    a "Feedback given" indicator so a customer can't submit twice for the
    same visit.
22. **Branding simplified for the single-salon deployment model**: the
    salon's own business name is no longer shown in the sidebar, login
    page, or landing page header/footer. Every layout (dashboard sidebar,
    customer sidebar, all 5 auth pages via `AuthShell`, the landing page
    footer) now shows a plain "Powered by SalonFlow" line instead.
23. **Staff management**: `staffApi.update()` added to `services/api.ts`
    to match the new backend `PUT /staff/{id}` endpoint (previously only
    create/delete existed on the frontend side).

24. **`app/dashboard/staff/page.tsx`**: added the missing Edit action
    (position, phone, active/inactive) using the new `staffApi.update()` -
    only create and delete existed before. Also fixed the status badge,
    which was hardcoded green regardless of `is_active` (only the text
    label changed, not the color) - it now reflects inactive staff
    visually too. Removed copy claiming a confirmation email is sent to
    new staff, which isn't true (the backend auto-confirms staff accounts
    and never emails the temporary password - it's shown once in the
    dialog for the owner to share directly).

## Next.js 15/16 compatibility + more feature fixes

25. **Fixed `params` Promise errors** on every dynamic `[id]` route
    (`dashboard/appointments/[id]`, `.../edit`, `dashboard/customers/[id]`,
    `.../edit`, `dashboard/billing/[id]`) - newer Next.js makes route
    `params` a Promise, so destructuring it directly as
    `{ params }: { params: { id: string } }` and reading `params.id`
    throws "params should be unwrapped with React.use()" at runtime. All
    five now use `useParams()` from `next/navigation` instead.

26. **Added the missing `appointmentsApi.delete()`** - the appointment
    detail page's delete button called a method that didn't exist on the
    frontend API client (and, as it turned out, didn't exist on the
    backend either - see backend `CHANGES.md` #29).

27. **Fixed a production build failure**: both `app/auth/login-customer/page.tsx`
    and `app/dashboard/billing/new/page.tsx` call `useSearchParams()`
    without a `<Suspense>` boundary anywhere above them, which
    `next build`'s static prerendering rejects outright. Both are now
    split into a thin wrapper that renders the real form inside
    `<Suspense>`.

28. **Invoice creation now pulls the service's price automatically** when
    opened from an approved appointment (`?appointment_id=...`), instead
    of always starting at 0 and having to be typed in by hand every time.
    The line item (description/quantity/price) is locked read-only in
    that case - matching the backend enforcement in `CHANGES.md` #28 -
    with a small note explaining why; only discount and tax stay
    editable. A manually-started invoice (no appointment) is unaffected
    and still fully editable.

29. **Appointment status can now be changed without opening the edit
    page**: both the appointments list (`dashboard/appointments/page.tsx`)
    and the detail page now have an inline status dropdown next to the
    status badge that calls `PATCH /appointments/{id}/status` directly.
    The quick Approve/Reject buttons for pending requests are unchanged
    (they still redirect into invoice creation on approve) - the dropdown
    covers every other transition (e.g. approved → completed) that
    previously required navigating to `/edit` just to change one field.

30. **Fixed a self-reference bug introduced by #25's own automated fix**:
    the `useParams()` migration script that fixed all five `[id]` routes
    ran its "replace every `params.id` with `id`" step *after* inserting
    the line `const id = params.id as string` - so that same replacement
    also matched its own just-inserted line, turning it into
    `const id = id as string` (a `ReferenceError: Cannot access 'id'
    before initialization` at runtime on every one of those five pages).
    Fixed by restoring `params.id` on that one declaration line in each
    file; every other `id` reference in those files was already correct.

## Known limitations

`app/auth/resend-confirmation/page.tsx` calls
`POST /auth/resend-confirmation`, which still doesn't exist on the backend
(this was already broken before this change, and is out of scope for the
theme/bugfix pass - see the comment left in that file for a one-line
implementation sketch using `supabase_client.auth.resend()`).
