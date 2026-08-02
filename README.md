# Olmos Legal Operations — Website (Draft)

A static marketing site for Olmos Legal Operations (formerly "Lit Para
101" — renamed and redesigned to reflect the broader consulting
business). Built to show Maria and continue brainstorming — not a
finished production site.

## Structure

```
/
├── index.html              Homepage — packages, About Maria, Resources (all inline)
├── login.html               Demo login page
├── videos.html               "Training videos coming soon!" — login required
├── main.css                  Shared site styles
├── auth.js                    Shared demo-auth logic (see below)
├── favicon.png
├── assets/
│   └── logo.png                Transparent PNG, cropped from your uploaded logo files
└── trial-calendar/            The deadline calculator — login required
    ├── index.html
    ├── calculations.js
    └── app.js
```

## What changed in this round

1. **Rebrand.** "Lit Para 101" → "Olmos Legal Operations" throughout —
   nav, page titles, footer, meta tags, filenames referenced in copy.
   The site now uses your uploaded logo (both `logo.png` and `logo2.png`
   had a solid white background baked in rather than real transparency,
   so I extracted a clean transparent version — see `assets/logo.png` —
   and also cropped just the circular mark for `favicon.png`). Brand
   colors (`--ink #000F35`, `--gold #D9A232`) were sampled directly from
   the logo file rather than eyeballed, so the site chrome matches it
   exactly.

2. **Redesigned around the broader business.** Added a real "What We
   Do" / packages section built from `Legal_Ops_Consulting_Packages.docx`
   — Team Tune-Up ($2,000), Team Structure Overhaul ($5,000), and Full
   Operations Partner (from $10,000), with their actual deliverables.
   Training Videos and the Trial Calendar Tool are now presented
   together under one "Resources" section (§3.0) rather than as two
   separate, disconnected top-level items — reflecting that they're
   part of the same ongoing project rather than side add-ons.

3. **Demo login.** Hardcoded credentials — username `user`, password
   `password` — gate both `videos.html` and `trial-calendar/index.html`.
   Visiting either directly without logging in redirects to
   `login.html`, which redirects back to the originally-requested page
   on success. Login state persists via `localStorage` (see
   `auth.js`), so it survives page navigation and browser restarts
   until you log out or clear site data.

   **This is a UX demo, not real security.** The credentials and the
   check itself are fully visible to anyone who views source — there's
   no backend validating anything. Good enough to show how the flow
   *feels*; not something to point real clients at with real case data
   behind it. Moving to real auth (Clerk/Auth0/Firebase, as discussed
   earlier) is a separate, larger step whenever you're ready for it.

4. **Trial calendar tool updates:**
   - Added a disclaimer directly above the form: dates should be
     independently verified, and Olmos Legal Operations/its developers
     aren't responsible for damages from incorrect dates.
   - Added a **file type dropdown** (CSV / ICS), defaulting to CSV.
     ICS output follows RFC 5545 (all-day `VEVENT`s, escaped text,
     folded long lines) and was tested against the same 53-deadline
     output already verified for CSV — same dates, same content,
     different container format. Tested in both Google Calendar's CSV
     path and should import cleanly into Outlook/Apple Calendar via
     ICS, though you'll want to try a real import yourself before
     relying on it.
   - The tool page now shares the main site's header/footer/branding
     instead of standing alone, since it's now presented as part of
     the broader Olmos Legal Operations project rather than a link-out.
   - `trial-calendar/styles.css` was removed — its rules are now fully
     covered by the shared `main.css` (same card/form/button styles
     used on the login page), so there's one source of truth instead
     of two competing stylesheets.

## Running it locally

Open `index.html` directly, or serve with `python3 -m http.server` and
visit `http://localhost:8000`. Log in with `user` / `password` when
prompted.

## Deploying to GitHub Pages

Push the whole folder, preserving structure (see the earlier zip-file
lesson — download this as a single archive, don't grab files
individually, or the `trial-calendar` and `assets` subfolders may not
survive the download intact).

## Before this goes anywhere near real visitors

- **Contact info** in the footer is still fake — swap in real details.
- **Maria's photo** is still a placeholder monogram.
- **Real authentication** — the current login is a demo, not
  protection. Anything actually sensitive needs a real backend/auth
  provider before this is shown outside your own team.
- **Copy** — worth a read-through with Maria, especially the new
  packages section, to make sure the pulled language matches how she
  actually wants to present pricing.
