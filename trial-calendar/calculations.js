/**
 * calculations.js
 * -----------------------------------------------------------------------
 * Trial-deadline calculation engine, ported and improved from the
 * firm's Google Apps Script "Cal Helper" tool. Every formula was
 * verified against the sample "Cal_Helper_-_Trial_Output.csv" (trial
 * date 10/30/2026), and the two deadlines that had no corresponding
 * calc function in the original script (IME doctor appointment, MUST
 * Start Noticing Depos) were confirmed directly with the firm and are
 * implemented per their instructions rather than the sample's values.
 *
 * Note: court-day counting (subtractCourtDays) intentionally does NOT
 * replicate the original Apps Script's calcCourtGeneric(), which had a
 * reference-equality bug making it behave like a calendar-day count
 * with a single backward snap. This version does a true court-day
 * count (skips weekends/holidays without consuming the count), so a
 * few deadlines that depend on 16 court days (motion filing deadlines)
 * will land earlier than the old tool would have produced. See README.
 * -----------------------------------------------------------------------
 */

// ---------------------------------------------------------------------
// Court holidays
// ---------------------------------------------------------------------
// Carried over from the Apps Script's hardcoded list (sourced from LASC:
// https://www.lacourt.ca.gov/apps/court-holidays). Three entries had
// data-entry typos in the original; corrected and confirmed:
//   "03-31-202"  -> 03-31-2027
//   "11-25-2025" -> 11-25-2027
//   "09-04-2027" -> 09-04-2028
const HOLIDAYS = [
  [12,25,2023],[1,1,2024],[1,15,2024],[2,12,2024],[2,19,2024],[4,1,2024],
  [5,27,2024],[6,19,2024],[7,4,2024],[9,2,2024],[9,27,2024],[11,11,2024],
  [11,28,2024],[11,29,2024],[12,25,2024],[1,1,2025],[1,20,2025],[2,12,2025],
  [2,17,2025],[3,31,2025],[5,26,2025],[6,19,2025],[7,4,2025],[9,1,2025],
  [9,26,2025],[11,11,2025],[11,27,2025],[11,28,2025],[12,25,2025],[1,1,2026],
  [1,19,2026],[2,12,2026],[2,16,2026],[3,31,2026],[5,25,2026],[6,19,2026],
  [7,3,2026],[9,7,2026],[9,25,2026],[11,11,2026],[11,26,2026],[11,27,2026],
  [12,25,2026],[1,1,2027],[1,18,2027],[2,12,2027],[2,15,2027],[3,31,2027],
  [6,18,2027],[7,5,2027],[9,6,2027],[9,24,2027],[11,11,2027],[11,25,2027],
  [11,26,2027],[12,24,2027],[12,31,2027],[1,17,2028],[2,11,2028],[2,21,2028],
  [3,31,2028],[5,29,2028],[6,19,2028],[7,4,2028],[9,4,2028],[9,22,2028],
  [11,10,2028],[11,23,2028],[11,24,2028],[12,25,2028],
].map(([m, d, y]) => new Date(y, m - 1, d));

// ---------------------------------------------------------------------
// Low-level date helpers (all operate on local-time Date objects to
// avoid the classic UTC-parsing off-by-one-day bug)
// ---------------------------------------------------------------------

function isSameYMD(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isHoliday(date) {
  return HOLIDAYS.some((h) => isSameYMD(h, date));
}

/**
 * If `date` lands on a holiday or weekend, push it FORWARD to the next
 * non-holiday weekday. Mirrors the original checkCourtDay() sequence:
 * holiday check -> weekend check -> holiday check.
 */
function pushToNextCourtDay(date) {
  let d = new Date(date);
  while (isHoliday(d)) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sat -> Mon
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Sun -> Mon
  while (isHoliday(d)) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * If `date` lands on a holiday or weekend, push it BACKWARD to the
 * previous non-holiday weekday. Mirrors checkCourtDayR().
 */
function pushToPrevCourtDay(date) {
  let d = new Date(date);
  while (isHoliday(d)) d.setDate(d.getDate() - 1);
  if (d.getDay() === 6) d.setDate(d.getDate() - 1); // Sat -> Fri
  else if (d.getDay() === 0) d.setDate(d.getDate() - 2); // Sun -> Fri
  while (isHoliday(d)) d.setDate(d.getDate() - 1);
  return d;
}

/** Subtract N calendar days, then push BACKWARD if it lands on a
 * weekend/holiday. This is the default "X days before" rule. */
function subtractCalendar(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return pushToPrevCourtDay(d);
}

/** Subtract N calendar days, then push FORWARD if it lands on a
 * weekend/holiday. Used only for the expert-exchange deadline (CCP
 * 2034.230(b)), where the statute requires extending the deadline
 * later, not moving it earlier. */
function subtractCalendarPushForward(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return pushToNextCourtDay(d);
}

/** Add N calendar days, then push FORWARD if it lands on a
 * weekend/holiday. */
function addCalendar(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return pushToNextCourtDay(d);
}

/**
 * Subtract N *court* days: step backward one calendar day at a time,
 * and only count a day toward N if it is itself a court day (not a
 * weekend or holiday). Weekends/holidays are skipped without consuming
 * the count. This is a correct, standard court-day count (e.g. for
 * CCP 1005 motion notice), unlike the original Apps Script's version,
 * which had a reference-equality bug that made it behave more like a
 * calendar-day count with a single backward snap.
 */
function subtractCourtDays(date, days) {
  let d = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    if (!isHoliday(d) && d.getDay() !== 0 && d.getDay() !== 6) {
      remaining--;
    }
  }
  return d;
}

/** "Overnight" deadline: base days before `date` (calendar,
 * backward-adjusted), then 2 more court days earlier. */
function overnightBackward(date, days) {
  const base = subtractCalendar(date, days);
  return subtractCourtDays(base, 2);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** MM/DD/YYYY, zero-padded -- used inside subject-line text, matching
 * the original Apps Script's formatDate(). */
function formatSubjDate(d) {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
}

/** M/D/YYYY, no padding -- used for the CSV "Start Date" column,
 * matching the sample CSV's actual formatting. */
function formatCSVDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Parse a "YYYY-MM-DD" string (from <input type="date">) into a local
 * Date, avoiding UTC-parsing pitfalls. */
function parseInputDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ---------------------------------------------------------------------
// Deadline definitions
// ---------------------------------------------------------------------
// Order matches the sample CSV exactly (it is NOT sorted by date -- the
// firm's template has a fixed row order, which this replicates).

function buildContext(trial) {
  const nonexpertCutoff = subtractCalendar(trial, 30); // CCP 2024.020
  const expertCutoff = subtractCalendar(trial, 15); // CCP 2024(d), also = hearing date for nonexpert disco motions
  const exchangeExperts = subtractCalendarPushForward(trial, 50); // CCP 2034.230(b)
  const base10 = subtractCalendar(trial, 10); // trial-10 family (several deadlines share this)

  const filingNonexpertPSVS = subtractCourtDays(expertCutoff, 16);
  const filingExpertPSVS = subtractCourtDays(base10, 16);

  const noticePartyDocsMAIL = subtractCalendar(trial, 25);
  const noticePartyNoDocsOV = overnightBackward(trial, 10);
  const noticeNonexpertDepoOV = overnightBackward(nonexpertCutoff, 10);

  return {
    trial,
    nonexpertCutoff,
    expertCutoff,
    exchangeExperts,
    base10,

    demandExchangePSVS: subtractCalendar(trial, 70),
    demandExchangeMAIL: subtractCalendar(trial, 75),
    demandExchangeOV: overnightBackward(trial, 70),

    propoundMAIL: subtractCalendar(nonexpertCutoff, 35),
    propoundOV: overnightBackward(nonexpertCutoff, 30),
    propoundPSVS: subtractCalendar(nonexpertCutoff, 30),

    noticeNonexpertDepoMAIL: subtractCalendar(nonexpertCutoff, 15),
    noticeNonexpertDepoOV,
    noticeNonexpertDepoPSVS: subtractCalendar(nonexpertCutoff, 10),

    noticeExpertDepoMAIL: subtractCalendar(expertCutoff, 15),
    noticeExpertDepoOV: overnightBackward(expertCutoff, 10),
    noticeExpertDepoPSVS: subtractCalendar(expertCutoff, 10),

    filingNonexpertPSVS,
    filingNonexpertMAIL: subtractCalendar(filingNonexpertPSVS, 5),
    filingNonexpertOV: subtractCourtDays(filingNonexpertPSVS, 2),

    filingExpertPSVS,
    filingExpertMAIL: subtractCalendar(filingExpertPSVS, 5),
    filingExpertOV: subtractCourtDays(filingExpertPSVS, 2),

    noticePartyDocsPSVS: subtractCalendar(trial, 20),
    noticePartyDocsMAIL,
    noticePartyDocsOV: overnightBackward(trial, 20),
    objectNoticeDocs: addCalendar(noticePartyDocsMAIL, 5),

    noticePartyNoDocsPSVS: base10,
    noticePartyNoDocsMAIL: subtractCalendar(trial, 15),
    noticePartyNoDocsOV,
    objectNoticeNoDocs: addCalendar(noticePartyNoDocsOV, 5),

    offerCompromisePSVS: base10,
    offerCompromiseMAIL: subtractCalendar(trial, 15),
    offerCompromiseOV: overnightBackward(trial, 10),

    supplementalExpertList: addCalendar(exchangeExperts, 20),

    sdtDeadline: subtractCalendar(trial, 30),
    mustSendSDTInternal: subtractCalendar(subtractCalendar(trial, 30), 14),

    draftTrialDocs: subtractCalendar(trial, 42),
    mustStartSendingSubpoenas: subtractCalendar(trial, 60),

    // Confirmed: 20 calendar days before "notice of non-expert
    // deposition by OVERNIGHT" (calendar, backward-adjusted).
    mustStartNoticingDepos: subtractCalendar(noticeNonexpertDepoOV, 20),

    beginRetainingExperts: subtractCalendar(exchangeExperts, 70),

    // Confirmed: 150 days before trial (calendar, backward-adjusted).
    imeDoctorAppt: subtractCalendar(trial, 150),

    accommodationDisability: subtractCourtDays(trial, 5),
    lodgeDepoTranscripts: subtractCalendar(trial, 7),
    beginGatheringDepoTranscripts: subtractCalendar(trial, 14),
    trialDocsMILsOV: overnightBackward(trial, 10),
    trialDocsMILsPSVS: base10,
  };
}

const DEADLINE_DEFS = [
  {
    subject: (c, name, f) => `${name} - MUST SCHEDULE DOCTOR APPOINTMENT WITH OUR EXPERT - INTERNAL DEADLINE (Trial ${f(c.trial)})`,
    date: (c) => c.imeDoctorAppt,
    notes: 'red - 150 days before trial',
  },
  {
    subject: (c, name, f) => `${name} - BEGIN RETAINING EXPERTS - INTERNAL DEADLINE (Trial ${f(c.trial)})`,
    date: (c) => c.beginRetainingExperts,
    notes: 'red - 70 days before estimated expert exchange due',
  },
  {
    subject: (c, name, f) => `${name} - L/D for demanding exchange of list of experts and reports by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.demandExchangeMAIL,
    notes: 'red - CCP 2034.220 - [70/before trial] - Note:  No later than 10th day after initial date is set or 70 days before trial (whichever is closer to trial date).',
  },
  {
    subject: (c, name, f) => `${name} - L/D for demanding exchange of list of experts and reports by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.demandExchangeOV,
    notes: 'red - CCP 2034.220 [70/before trial] - Note:  No later than 10th day after initial date is set or 70 days before trial (whichever is closer to trial date).',
  },
  {
    subject: (c, name, f) => `${name} - L/D for demanding exchange of list of experts and reports by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.demandExchangePSVS,
    notes: 'red - CCP 2034.220 [70/before trial] - Note: No later than 10th day after initial date is set or 70 days before trial (whichever is closer to trial date).',
  },
  {
    subject: (c, name, f) => `${name} - L/D to propound non-expert discovery + supplementals + site inspection by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.propoundMAIL,
    notes: 'red - CCP 2030.260 [30/before discovery cut-off]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to propound non-expert discovery + supplementals + site inspection by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.propoundOV,
    notes: 'red - CCP 2030.260 [30/before discovery cut-off]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to propound non-expert discovery + supplementals + site inspection by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.propoundPSVS,
    notes: 'red - CCP 2030.260 [30/before discovery cut-off]',
  },
  {
    subject: (c, name, f) => `${name} - MUST Start Noticing Depos - INTERNAL DEADLINE (Discovery Cut-off for Non-Experts ${f(c.nonexpertCutoff)}, Trial ${f(c.trial)})`,
    date: (c) => c.mustStartNoticingDepos,
    notes: 'red - 20 days before L/D to serve notice of non-expert deposition by OVERNIGHT',
  },
  {
    subject: (c, name, f) => `${name} - MUST start sending out Trial Subpoenas & On-Call Agreements to 3rd party witnesses - INTERNAL DEADLINE (Trial ${f(c.trial)})`,
    date: (c) => c.mustStartSendingSubpoenas,
    notes: 'red - L/D serve is 15 days before trial.',
  },
  {
    subject: (c, name, f) => `${name} - L/D to exchange list of experts and reports (May need to adjust based on POS of demand) (Trial ${f(c.trial)})`,
    date: (c) => c.exchangeExperts,
    notes: 'red - CCP 2034.230(b) - [50 days before the initial trial date, or 20 days after service of the demand, whichever is closer to the trial date] **May need to adjust based on POS of demand**',
  },
  {
    subject: (c, name, f) => `${name} - MUST NOTICE D'S EXPERT'S DEPOS AFTER EXCHANGE TODAY - INTERNAL DEADLINE (Trial ${f(c.trial)})`,
    date: (c) => c.exchangeExperts,
    notes: 'red - Per Jim: When the expert exchange is due, we must asap that day notice their expert depos.',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice of non-expert deposition by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.noticeNonexpertDepoMAIL,
    notes: 'red - CCP 2025.270 [10/before non-expert discovery cut- off -]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for filing non-expert discovery motions by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.filingNonexpertMAIL,
    notes: 'red - [16 COURT DAYS/ before hearing date - Deadline for hearing re: Non-Expert disco mtns ]',
  },
  {
    subject: (c, name, f) => `${name} - MUST send out for service ANY subpoena duces tecum - INTERNAL DEADLINE (Trial ${f(c.trial)})`,
    date: (c) => c.mustSendSDTInternal,
    notes: 'red - This is 14 days before the real deadline!',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice of non-expert deposition by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.noticeNonexpertDepoOV,
    notes: 'red - CCP 2025.270 [10/before non-expert discovery cut- off -]',
  },
  {
    subject: (c, name, f) => `${name} - Paralegal/Legal Assistant MUST Draft Trial Docs (Trial ${f(c.trial)})`,
    date: (c) => c.draftTrialDocs,
    notes: 'red - 42 days before trial',
  },
  {
    subject: (c, name, f) => `${name} - L/D for filing non-expert discovery motions by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.filingNonexpertOV,
    notes: 'red - [16 COURT DAYS/ before hearing date - Deadline for hearing re: Non-Expert disco mtns ]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice of non-expert deposition by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.noticeNonexpertDepoPSVS,
    notes: 'red - CCP 2025.270 [10/before non-expert discovery cut- off -]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for filing non-expert discovery motions by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.filingNonexpertPSVS,
    notes: 'red - [16 COURT DAYS/ before hearing date - Deadline for hearing re: Non-Expert disco mtns]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for filing expert discovery motions by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.filingExpertMAIL,
    notes: 'red - [16 COURT DAYS/ before hearing date - Deadline for hearing re: Expert disco mtns]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for filing expert discovery motions by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.filingExpertOV,
    notes: 'red - [16 COURT DAYS/ before hearing date - Deadline for hearing re: Expert disco mtns]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for filing expert discovery motions by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.filingExpertPSVS,
    notes: 'red - [16 COURT DAYS/ before hearing date - Deadline for hearing re: Expert disco mtns]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice of expert deposition by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.noticeExpertDepoMAIL,
    notes: 'red - CCP 2025.270 [10/before expert discovery cut- off]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve supplemental expert witness list (May need to adjust based on exchange due date) (Trial ${f(c.trial)})`,
    date: (c) => c.supplementalExpertList,
    notes: 'red - CCP 2034.280(a) [20/after exchange of expert info]',
  },
  {
    subject: (c, name, f) => `${name} - L/D MSJ can be heard -  CCP 437(c)a (Trial ${f(c.trial)})`,
    date: (c) => c.nonexpertCutoff,
    notes: 'red - CCP 437c(a) [30/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - DISCOVERY CUT-OFF FOR NON-EXPERTS! (Trial ${f(c.trial)})`,
    date: (c) => c.nonexpertCutoff,
    notes: 'red - CCP 2024.020 [30/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve subpoena duces tecum re MEDICAL RECORDS AND ANY OTHER RECORDS to be delivered to the Court (Trial ${f(c.trial)})`,
    date: (c) => c.sdtDeadline,
    notes: 'red - per Jim [30/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve subpoena duces tecum to ANY INDIVIDUAL OR EXPERT to appear at trial with documents (Trial ${f(c.trial)})`,
    date: (c) => c.sdtDeadline,
    notes: 'red - per Jim [30/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice of expert deposition by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.noticeExpertDepoOV,
    notes: 'red - CCP 2025.270 [10/before expert discovery cut- off]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice of expert deposition by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.noticeExpertDepoPSVS,
    notes: 'red - CCP 2025.270 [10/before expert discovery cut- off]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice to party witnesses to appear at trial with documents by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.noticePartyDocsMAIL,
    notes: 'red - CCP 1987(c) [20/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice to party witnesses to appear at trial with documents by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.noticePartyDocsOV,
    notes: 'red - CCP 1987(c) [20/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve notice to party witnesses to appear at trial with documents by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.noticePartyDocsPSVS,
    notes: 'red - CCP 1987(c) [20/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to OBJECT to Notice to Appear & Produce with documents (Trial ${f(c.trial)})`,
    date: (c) => c.objectNoticeDocs,
    notes: "red - 5 days after RECEIPT of the Notice to Appear - *IF we receive objection from D, then MUST file Notice of Motion to Compel our Notice to Appear & Produce (per D\u2019s objections served on XXXX) - **May need to adjust based on receipt of notice",
  },
  {
    subject: (c, name, f) => `${name} - DISCOVERY CUT-OFF FOR EXPERTS! (Trial ${f(c.trial)})`,
    date: (c) => c.expertCutoff,
    notes: 'red - CCP 2024(d) [15/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for hearing re: NON-EXPERT discovery motions (Trial ${f(c.trial)})`,
    date: (c) => c.expertCutoff,
    notes: 'red - CCP 2024.020 [15/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to send out subpoenas to 3rd party witnesses (Trial ${f(c.trial)})`,
    date: (c) => c.expertCutoff,
    notes: 'red - [15/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for serving notice to party witnesses requesting their appearance at trial without documents by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.noticePartyNoDocsMAIL,
    notes: 'red - CCP 1987(b) [10/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve Offer to Compromise by REG. MAIL (Trial ${f(c.trial)})`,
    date: (c) => c.offerCompromiseMAIL,
    notes: 'red - CCP 998(b) [10/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - MUST begin gathering deposition transcript for lodging - INTERNAL DEADLINE (Trial ${f(c.trial)})`,
    date: (c) => c.beginGatheringDepoTranscripts,
    notes: 'red - Internal deadline [2 weeks before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to file and serve TRIAL DOCS & MILs w/ COURTESY COPY TO DEPT. by OVERNIGHT (10 days before trial - ADJUST BASED ON JUDGE'S TRIAL POLICIES) (Trial ${f(c.trial)})`,
    date: (c) => c.trialDocsMILsOV,
    notes: "red - Judge\u2019s Trial Policies [DEFAULT: 10 days/before trial]",
  },
  {
    subject: (c, name, f) => `${name} - L/D for serving notice to party witnesses requesting their appearance at trial without documents by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.noticePartyNoDocsOV,
    notes: 'red - CCP 1987(b) [10/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve Offer to Compromise by OVERNIGHT (Trial ${f(c.trial)})`,
    date: (c) => c.offerCompromiseOV,
    notes: 'red - CCP 998(b) [10/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to file and serve TRIAL DOCS & MILs w/ COURTESY COPY TO DEPT. by PSVS (10 days before trial - ADJUST BASED ON JUDGE'S TRIAL POLICIES) (Trial ${f(c.trial)})`,
    date: (c) => c.trialDocsMILsPSVS,
    notes: "red - Judge\u2019s Trial Policies [DEFAULT: 10 days/before trial]",
  },
  {
    subject: (c, name, f) => `${name} - L/D to advise court if counsel believes larger panel than 80 prospective jurors will be required (10 days before trial - ADJUST BASED ON JUDGE'S TRIAL POLICIES) (Trial ${f(c.trial)})`,
    date: (c) => c.base10,
    notes: "red - Judge\u2019s Trial Policies [DEFAULT: 10 days/before trial]",
  },
  {
    subject: (c, name, f) => `${name} - MUST submit discovery responses and deposition excerpts counsel to use in place of live testimony to OC (10 days before trial - ADJUST BASED ON JUDGE'S TRIAL POLICIES) (Trial ${f(c.trial)})`,
    date: (c) => c.base10,
    notes: "red - Judge\u2019s Trial Policies [DEFAULT: 10 days/before trial]",
  },
  {
    subject: (c, name, f) => `${name} - L/D for serving notice to party witnesses requesting their appearance at trial without documents by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.noticePartyNoDocsPSVS,
    notes: 'red - CCP 1987(b) [10/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to serve Offer to Compromise by PSVS (Trial ${f(c.trial)})`,
    date: (c) => c.offerCompromisePSVS,
    notes: 'red - CCP 998(b) [10/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D for hearing re: EXPERT discovery motions (Trial ${f(c.trial)})`,
    date: (c) => c.base10,
    notes: 'red - CCP 2024.030 [10/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to OBJECT to Notice to Appear without documents (Trial ${f(c.trial)})`,
    date: (c) => c.objectNoticeNoDocs,
    notes: "red - 5 days after RECEIPT of the Notice to Appear - *IF we receive objection from D, then MUST file Notice of Motion to Compel our Notice to Appear & Produce (per D\u2019s objections served on XXXX) - **May need to adjust based on receipt of notice",
  },
  {
    subject: (c, name, f) => `${name} - L/D to request accommodation of person with disability (Trial ${f(c.trial)})`,
    date: (c) => c.accommodationDisability,
    notes: 'red - CRC 1.100(c)(3) [5 court/before trial]',
  },
  {
    subject: (c, name, f) => `${name} - L/D to lodge deposition transcripts with Clerk (7 days before trial - ADJUST BASED ON JUDGE'S TRIAL POLICIES) (Trial ${f(c.trial)})`,
    date: (c) => c.lodgeDepoTranscripts,
    notes: "red - Judge's Trial Policies [DEFAULT: 7 days/before trial]",
  },
];

/**
 * Main entry point. Returns an array of { subject, startDate, date,
 * description } ready to be written to CSV or ICS, in the same fixed
 * order as the firm's template. `startDate` is the pre-formatted
 * M/D/YYYY string (for CSV); `date` is the underlying Date object (for
 * ICS, or anything else that needs to do its own date math/formatting).
 */
function computeDeadlines(caseHandle, trialDate) {
  const ctx = buildContext(trialDate);
  return DEADLINE_DEFS.map((def) => {
    const date = def.date(ctx);
    return {
      subject: def.subject(ctx, caseHandle, formatSubjDate),
      startDate: formatCSVDate(date),
      date,
      description: def.notes,
    };
  });
}
