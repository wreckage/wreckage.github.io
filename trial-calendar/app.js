/**
 * app.js
 * Wires up the form: reads the inputs, runs the calculation engine, and
 * builds either a Google-Calendar-importable CSV or an RFC 5545 ICS
 * file (for Outlook, Apple Calendar, etc.), then triggers a download.
 */

// ---------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------

function csvField(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSV(rows) {
  const header = ['Subject', 'Start Date', 'All Day Event', 'Start Time', 'End Time', 'Location', 'Description'];
  const lines = [header.join(',')];
  rows.forEach((row) => {
    lines.push([
      csvField(row.subject),
      csvField(row.startDate),
      'TRUE',
      '',
      '',
      '',
      csvField(row.description),
    ].join(','));
  });
  // CRLF line endings, matching the original Sheets export
  return lines.join('\r\n');
}

// ---------------------------------------------------------------------
// ICS export (RFC 5545) -- for Outlook, Apple Calendar, etc., which
// don't support Google's CSV calendar-import format.
// ---------------------------------------------------------------------

function icsPad2(n) {
  return String(n).padStart(2, '0');
}

function formatICSDate(d) {
  return `${d.getFullYear()}${icsPad2(d.getMonth() + 1)}${icsPad2(d.getDate())}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function escapeICSText(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** RFC 5545 requires content lines to be folded at 75 octets; each
 * continuation line starts with a single space. Most calendar apps
 * tolerate long lines, but Outlook has historically been stricter. */
function foldICSLine(line) {
  if (line.length <= 75) return line;
  let result = '';
  let idx = 0;
  let first = true;
  while (idx < line.length) {
    const chunkLen = first ? 75 : 74;
    result += (first ? '' : '\r\n ') + line.slice(idx, idx + chunkLen);
    idx += chunkLen;
    first = false;
  }
  return result;
}

function buildICS(rows, caseHandle) {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${icsPad2(now.getUTCMonth() + 1)}${icsPad2(now.getUTCDate())}T${icsPad2(now.getUTCHours())}${icsPad2(now.getUTCMinutes())}${icsPad2(now.getUTCSeconds())}Z`;
  const uidSuffix = sanitizeFilename(caseHandle);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Olmos Legal Operations//Trial Calendar Tool//EN',
    'CALSCALE:GREGORIAN',
  ];

  rows.forEach((row, i) => {
    const start = formatICSDate(row.date);
    const end = formatICSDate(addDays(row.date, 1)); // DTEND is exclusive for all-day events
    lines.push('BEGIN:VEVENT');
    lines.push(foldICSLine(`UID:${i}-${uidSuffix}-${start}@olmoslegalops.demo`));
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    lines.push(foldICSLine(`SUMMARY:${escapeICSText(row.subject)}`));
    lines.push(foldICSLine(`DESCRIPTION:${escapeICSText(row.description)}`));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

function downloadFile(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return name.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'trial_deadlines';
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('deadline-form');
  const caseHandleInput = document.getElementById('case-handle');
  const trialDateInput = document.getElementById('trial-date');
  const formatSelect = document.getElementById('file-format');
  const submitBtn = document.getElementById('submit-btn');
  const errorEl = document.getElementById('form-error');
  const statusEl = document.getElementById('form-status');

  function updateSubmitLabel() {
    submitBtn.textContent = formatSelect.value === 'ics' ? 'Generate ICS' : 'Generate CSV';
  }
  formatSelect.addEventListener('change', updateSubmitLabel);
  updateSubmitLabel();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    statusEl.textContent = '';

    const caseHandle = caseHandleInput.value.trim();
    const trialDateStr = trialDateInput.value;
    const format = formatSelect.value;

    if (!caseHandle) {
      errorEl.textContent = 'Please enter a case handle.';
      caseHandleInput.focus();
      return;
    }
    if (!trialDateStr) {
      errorEl.textContent = 'Please enter a trial date.';
      trialDateInput.focus();
      return;
    }

    const trialDate = parseInputDate(trialDateStr);
    const rows = computeDeadlines(caseHandle, trialDate);
    const baseName = `${sanitizeFilename(caseHandle)}_trial_deadlines`;

    if (format === 'ics') {
      const icsText = buildICS(rows, caseHandle);
      const filename = `${baseName}.ics`;
      downloadFile(icsText, filename, 'text/calendar;charset=utf-8;');
      statusEl.textContent = `Downloaded ${filename} (${rows.length} deadlines).`;
    } else {
      const csvText = buildCSV(rows);
      const filename = `${baseName}.csv`;
      downloadFile(csvText, filename, 'text/csv;charset=utf-8;');
      statusEl.textContent = `Downloaded ${filename} (${rows.length} deadlines).`;
    }
  });
});
