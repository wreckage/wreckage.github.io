/**
 * app.js
 * Wires up the form: reads the two inputs, runs the calculation engine,
 * builds a Google-Calendar-importable CSV, and triggers a download.
 */

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

function downloadCSV(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
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
  const errorEl = document.getElementById('form-error');
  const statusEl = document.getElementById('form-status');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    statusEl.textContent = '';

    const caseHandle = caseHandleInput.value.trim();
    const trialDateStr = trialDateInput.value;

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
    const csvText = buildCSV(rows);
    const filename = `${sanitizeFilename(caseHandle)}_trial_deadlines.csv`;

    downloadCSV(csvText, filename);
    statusEl.textContent = `Downloaded ${filename} (${rows.length} deadlines).`;
  });
});
