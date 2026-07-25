# Trial Deadline Calculator (Prototype)

Static HTML/CSS/JS site. No backend, no build step, no dependencies.
Enter a case handle and trial date, click **Generate CSV**, and a
Google Calendar-importable CSV downloads automatically.

## Files

- `index.html` — the form
- `styles.css` — minimal styling
- `calculations.js` — the date-math engine (holidays, weekend/court-day
  adjustment, and all 53 deadline formulas)
- `app.js` — form handling, CSV building, and triggering the download

## Running it locally

Just open `index.html` in a browser — no server needed. (If your
browser blocks local file scripts, run `python3 -m http.server` in this
folder and visit `http://localhost:8000`.)

## Deploying (free)

Push this folder to a GitHub repo and enable **GitHub Pages** (Settings
→ Pages → deploy from branch), or drag-and-drop the folder onto
**Netlify Drop**. Either gives you a free public URL in under a minute.

## Verification

Every deadline formula in `calculations.js` was reverse-engineered from
your Apps Script (`code.txt`) and checked against your sample output
(`Cal_Helper_-_Trial_Output.csv`, trial date 10/30/2026, case "Tillie
(Oceanside USD)"). All 53 rows reproduce the sample's dates exactly,
except the two below, which are implemented per your direct
instructions rather than the sample's (now-outdated) values.

## Resolved since the last round

1. **"MUST SCHEDULE DOCTOR APPOINTMENT WITH OUR EXPERT"** — now 150
   days before trial (calendar, backward-adjusted), per your
   confirmation.
2. **"MUST Start Noticing Depos"** — now 20 calendar days before "L/D
   to serve notice of non-expert deposition by OVERNIGHT" (calendar,
   backward-adjusted), per your confirmation.
3. **Court-day counting rewritten.** `subtractCourtDays()` no longer
   replicates the original Apps Script's `calcCourtGeneric()` bug
   (which behaved like a calendar-day count with a single backward
   snap, due to a reference-equality bug in the original JS). It now
   does a true court-day count: step back one calendar day at a time,
   and only count a day toward the total if it's not itself a weekend
   or holiday. This affects the 16-court-day motion-filing deadlines
   and the 5-court-day disability-accommodation deadline.

   **In practice, this didn't change any dates in the sample** — for
   realistic California court holiday patterns (no more than a couple
   consecutive holiday/weekend days), the old bug's "snap to nearest
   earlier court day, once per iteration" and true court-day counting
   land on the same date. The only two rows that moved from the
   original sample are the two above, which you asked me to change.
4. **Holiday typos confirmed and fixed:** `03-31-202` → `03-31-2027`,
   `11-25-2025` → `11-25-2027`, `09-04-2027` → `09-04-2028`, sourced
   from LASC's court holiday list.

## Other things worth knowing

- **Typo fixed:** "Paralega/Legal Assistant" → "Paralegal/Legal
  Assistant" in one deadline label.
- **Row order is fixed, not sorted by date** — matching your original
  template. This is intentional; your sample CSV isn't chronologically
  sorted either.
- **No accounts/auth yet**, per your request — anyone with the URL can
  use this. Revisit before this touches real case data broadly.
