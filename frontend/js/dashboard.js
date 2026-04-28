import { getDashboardStats, getTimeseries, getAttributeHeatmap, getLogs, prepareDataset, downloadDataset, getReportData, isLoggedIn } from './api.js';

if (!isLoggedIn()) window.location.href = '/login.html';

// Render chart from real timeseries data
async function renderChart() {
  const container = document.getElementById('bias-chart');
  try {
    const { data } = await getTimeseries('7d');
    const vals = data?.datasets?.[0]?.data || [];
    const labels = data?.labels || [];
    if (!vals.length) { container.innerHTML = '<p class="text-xs text-white/30 p-4">No data yet</p>'; return; }
    const maxVal = Math.max(...vals, 1);
    container.innerHTML = vals.map((val, i) => {
      const height = (val / maxVal) * 100;
      const colorClass = val > 50 ? 'bg-accent-red/30 hover:bg-accent-red/50' : val > 30 ? 'bg-accent-amber/30 hover:bg-accent-amber/50' : 'bg-accent-blue/20 hover:bg-accent-blue/40';
      return `<div class="flex-1 ${colorClass} rounded-t transition-colors cursor-pointer relative group" style="height:${height}%">
        <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white/0 group-hover:text-white/60 transition-colors font-medium">${val}</div>
      </div>`;
    }).join('');
  } catch { container.innerHTML = '<p class="text-xs text-white/30 p-4">Failed to load</p>'; }
}

// Render heatmap from real attribute data
async function renderHeatmap() {
  const container = document.getElementById('heatmap-grid');
  try {
    const { data } = await getAttributeHeatmap();
    const attrs = data?.attributes || [];
    if (!attrs.length) { container.innerHTML = '<p class="text-xs text-white/30 p-4 col-span-full">No attribute data yet</p>'; return; }
    container.innerHTML = attrs.map((attr) => {
      const score = Math.round(attr.average_bias_score || 0);
      const intensity = score > 30 ? 'bg-accent-red' : score > 20 ? 'bg-accent-amber' : score > 10 ? 'bg-accent-cyan' : 'bg-accent-green';
      const opacity = Math.min(score / 50, 0.6) + 0.1;
      return `<div class="text-center">
        <div class="heatmap-cell h-16 rounded-xl ${intensity} flex items-center justify-center text-xs font-bold cursor-pointer" style="opacity:${opacity}" title="${attr.attribute}: ${score}% avg bias">${score}%</div>
        <div class="text-[10px] text-white/40 mt-1.5 font-medium">${attr.attribute}</div>
      </div>`;
    }).join('');
  } catch { container.innerHTML = '<p class="text-xs text-white/30 p-4">Failed to load</p>'; }
}

// Render distribution from attribute heatmap data
async function renderDistribution() {
  const container = document.getElementById('bias-distribution');
  try {
    const { data } = await getAttributeHeatmap();
    const attrs = data?.attributes || [];
    if (!attrs.length) { container.innerHTML = '<p class="text-xs text-white/30 p-4">No data yet</p>'; return; }
    const maxCount = Math.max(...attrs.map((a) => a.detection_count || 1), 1);
    const colors = ['accent-red', 'accent-amber', 'accent-amber', 'accent-cyan', 'accent-green', 'accent-green'];
    container.innerHTML = attrs.slice(0, 6).map((attr, i) => {
      const width = (attr.detection_count / maxCount) * 100;
      const color = colors[i] || 'accent-blue';
      return `<div class="flex items-center gap-3">
        <span class="text-xs text-white/50 w-28 flex-shrink-0">${attr.attribute}</span>
        <div class="flex-1 h-6 rounded-lg bg-white/5 overflow-hidden relative">
          <div class="h-full rounded-lg bg-${color}/20 transition-all duration-700" style="width:${width}%"></div>
          <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white/60">${attr.detection_count}</span>
        </div>
      </div>`;
    }).join('');
  } catch { container.innerHTML = '<p class="text-xs text-white/30 p-4">Failed to load</p>'; }
}

// Render audit log from real data
async function renderAuditLog() {
  const tbody = document.getElementById('audit-log-body');
  try {
    const { data } = await getLogs({ limit: 10 });
    const logs = data?.logs || [];
    if (!logs.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-xs text-white/30 px-4 py-4 text-center">No audit entries yet</td></tr>'; return; }
    tbody.innerHTML = logs.map((log) => {
      const score = Math.round(log.input_bias_score || 0);
      const biasClass = score > 60 ? 'bias-high' : score > 30 ? 'bias-medium' : 'bias-low';
      const biasLabel = score > 60 ? 'HIGH' : score > 30 ? 'MED' : 'LOW';
      const attrs = (log.protected_attributes || []).join(', ') || '—';
      const time = new Date(log.created_at).toLocaleString();
      return `<tr class="border-b border-white/3 hover:bg-white/[0.02] transition-colors">
        <td class="px-4 py-3 text-xs font-mono text-white/40">${log.session_id?.slice(0, 8)}...</td>
        <td class="px-4 py-3 text-xs text-white/60 max-w-[200px] truncate">${escapeHtml(log.prompt_preview || '')}</td>
        <td class="px-4 py-3"><span class="${biasClass} text-[10px] font-semibold px-1.5 py-0.5 rounded-full">${biasLabel} ${score}%</span></td>
        <td class="px-4 py-3 text-xs text-white/40">${log.wrapper_triggered ? '<span class="text-accent-cyan">Yes</span>' : 'No'}</td>
        <td class="px-4 py-3 text-xs text-white/30">${time}</td>
      </tr>`;
    }).join('');
  } catch { tbody.innerHTML = '<tr><td colspan="5" class="text-xs text-accent-red px-4 py-4 text-center">Failed to load logs</td></tr>'; }
}

// Render stats cards
async function renderStats() {
  try {
    const { data } = await getDashboardStats();
    const el = (id) => document.getElementById(id);
    if (el('stat-sessions')) el('stat-sessions').textContent = data?.total_sessions ?? '—';
    if (el('stat-avg-bias')) el('stat-avg-bias').textContent = data?.average_bias_score != null ? data.average_bias_score + '%' : '—';
    if (el('stat-wrapper-rate')) el('stat-wrapper-rate').textContent = data?.wrapper_trigger_rate != null ? (data.wrapper_trigger_rate * 100).toFixed(1) + '%' : '—';
    if (el('stat-compliance')) el('stat-compliance').textContent = data?.compliance_score != null ? (data.compliance_score * 100).toFixed(0) + '%' : '—';
  } catch { /* ignore */ }
}

function escapeHtml(text) { const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML; }

// ── Download Report ────────────────────────────────────────────────────────────
const downloadReportBtn = document.getElementById('download-report-btn');

downloadReportBtn.addEventListener('click', async () => {
  downloadReportBtn.disabled = true;
  downloadReportBtn.textContent = 'Generating...';
  try {
    const { data } = await getReportData();
    const html = buildReportHtml(data);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bias-performance-report-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Report generation failed: ' + err.message);
  } finally {
    downloadReportBtn.disabled = false;
    downloadReportBtn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Download Report`;
  }
});

function bar(pct, color) {
  return `<div style="background:#1e2740;border-radius:6px;overflow:hidden;height:8px;width:100%"><div style="width:${Math.min(pct,100)}%;height:100%;background:${color};border-radius:6px"></div></div>`;
}

function buildReportHtml(d) {
  const s = d.summary;
  const genDate = new Date(d.generated_at).toLocaleString();
  const biasColor = (v) => v > 60 ? '#ef4444' : v > 30 ? '#f59e0b' : '#10b981';

  const modelRows = (d.per_model || []).map((m) => `
    <tr>
      <td>${escapeHtml(m.model)}</td>
      <td style="text-align:center">${m.sessions}</td>
      <td style="text-align:center"><span style="color:${biasColor(m.avg_input_bias)};font-weight:600">${m.avg_input_bias}%</span></td>
      <td style="text-align:center">${m.avg_output_bias != null ? `<span style="color:#10b981;font-weight:600">${m.avg_output_bias}%</span>` : '—'}</td>
      <td style="text-align:center">${m.wrapper_rate}%</td>
      <td style="text-align:center">${m.avg_latency_ms != null ? m.avg_latency_ms + 'ms' : '—'}</td>
    </tr>`).join('');

  const attrRows = (d.attr_breakdown || []).map((a) => `
    <tr>
      <td>${escapeHtml(a.attribute)}</td>
      <td style="text-align:center">${a.detections}</td>
      <td style="min-width:180px">${bar(a.avg_bias * 2, biasColor(a.avg_bias))}</td>
      <td style="text-align:center"><span style="color:${biasColor(a.avg_bias)};font-weight:600">${a.avg_bias}%</span></td>
    </tr>`).join('');

  const timeRows = (d.timeseries || []).map((t) => `
    <tr>
      <td>${t.date}</td>
      <td style="min-width:200px">${bar(t.avg_bias * 2, biasColor(t.avg_bias))}</td>
      <td style="text-align:center"><span style="color:${biasColor(t.avg_bias)};font-weight:600">${t.avg_bias}%</span></td>
      <td style="text-align:center">${t.wrappers}</td>
    </tr>`).join('');

  const conf = d.confidence_dist || {};
  const confTotal = (conf.HIGH || 0) + (conf.MEDIUM || 0) + (conf.LOW || 0) + (conf.UNKNOWN || 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bias Performance Report — ${genDate}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:#f8fafc;color:#1e293b;padding:40px 32px;max-width:1100px;margin:0 auto}
  h1{font-size:1.8rem;font-weight:700;margin-bottom:4px;color:#0f172a}
  .subtitle{color:#64748b;font-size:0.875rem;margin-bottom:32px}
  .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px}
  .kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center}
  .kpi .val{font-size:2rem;font-weight:700;line-height:1.1;margin-bottom:4px}
  .kpi .lbl{font-size:0.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px}
  .section h2{font-size:1rem;font-weight:600;margin-bottom:16px;color:#0f172a}
  table{width:100%;border-collapse:collapse;font-size:0.85rem}
  th{text-align:left;padding:8px 12px;border-bottom:2px solid #e2e8f0;color:#64748b;font-weight:600;text-transform:uppercase;font-size:0.7rem;letter-spacing:.05em}
  td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#f8fafc}
  .conf-row{display:flex;gap:12px;flex-wrap:wrap}
  .conf-pill{padding:8px 16px;border-radius:8px;font-size:0.8rem;font-weight:600;text-align:center;min-width:80px}
  .footer{text-align:center;color:#94a3b8;font-size:0.75rem;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0}
  @media print{body{padding:16px}button{display:none}}
</style>
</head>
<body>
<h1>🔍 Bias Performance Report</h1>
<div class="subtitle">Generated ${genDate} &nbsp;·&nbsp; AI Bias Firewall</div>

<div class="kpi-grid">
  <div class="kpi"><div class="val" style="color:#3b82f6">${s.total_sessions}</div><div class="lbl">Total Sessions</div></div>
  <div class="kpi"><div class="val" style="color:${biasColor(s.avg_input_bias)}">${s.avg_input_bias}%</div><div class="lbl">Avg Input Bias</div></div>
  <div class="kpi"><div class="val" style="color:#10b981">${s.avg_output_bias}%</div><div class="lbl">Avg Output Bias</div></div>
  <div class="kpi"><div class="val" style="color:#10b981">${s.bias_reduction_pct}%</div><div class="lbl">Bias Reduction</div></div>
  <div class="kpi"><div class="val" style="color:#f59e0b">${s.wrapper_triggers}</div><div class="lbl">Wrapper Triggers</div></div>
  <div class="kpi"><div class="val" style="color:#f59e0b">${s.wrapper_rate}%</div><div class="lbl">Wrapper Rate</div></div>
  <div class="kpi"><div class="val" style="color:#10b981">${s.compliance_score}%</div><div class="lbl">Compliance Score</div></div>
  <div class="kpi"><div class="val" style="color:#6366f1">${s.avg_latency_ms}ms</div><div class="lbl">Avg Latency</div></div>
</div>

${modelRows ? `<div class="section">
  <h2>Model Performance Breakdown</h2>
  <table>
    <thead><tr><th>Model</th><th>Sessions</th><th>Avg Input Bias</th><th>Avg Output Bias</th><th>Wrapper Rate</th><th>Avg Latency</th></tr></thead>
    <tbody>${modelRows}</tbody>
  </table>
</div>` : ''}

${attrRows ? `<div class="section">
  <h2>Protected Attribute Detections</h2>
  <table>
    <thead><tr><th>Attribute</th><th>Detections</th><th>Avg Bias</th><th></th></tr></thead>
    <tbody>${attrRows}</tbody>
  </table>
</div>` : ''}

<div class="section">
  <h2>Detection Confidence Distribution</h2>
  <div class="conf-row">
    <div class="conf-pill" style="background:#fef2f2;color:#ef4444">HIGH<br/><span style="font-size:1.2rem">${conf.HIGH || 0}</span></div>
    <div class="conf-pill" style="background:#fffbeb;color:#f59e0b">MEDIUM<br/><span style="font-size:1.2rem">${conf.MEDIUM || 0}</span></div>
    <div class="conf-pill" style="background:#f0fdf4;color:#10b981">LOW<br/><span style="font-size:1.2rem">${conf.LOW || 0}</span></div>
    <div class="conf-pill" style="background:#f8fafc;color:#94a3b8">UNKNOWN<br/><span style="font-size:1.2rem">${conf.UNKNOWN || 0}</span></div>
    <div style="display:flex;align-items:center;font-size:0.8rem;color:#64748b;margin-left:8px">Total: ${confTotal} detections</div>
  </div>
</div>

${timeRows ? `<div class="section">
  <h2>Daily Bias Trend (Last 30 Days)</h2>
  <table>
    <thead><tr><th>Date</th><th>Avg Bias Trend</th><th>Avg Score</th><th>Wrappers Fired</th></tr></thead>
    <tbody>${timeRows}</tbody>
  </table>
</div>` : ''}

<div class="footer">AI Bias Firewall &nbsp;·&nbsp; Bias Performance Report &nbsp;·&nbsp; ${genDate}</div>
</body>
</html>`;
}

// ── Retraining Dataset ────────────────────────────────────────────────────────
let _exportId = null;

const prepareBtn    = document.getElementById('prepare-dataset-btn');
const downloadBtn   = document.getElementById('download-dataset-btn');
const datasetInfo   = document.getElementById('dataset-info');
const prepareBar    = document.getElementById('prepare-bar');
const prepareStatus = document.getElementById('prepare-status');
const prepareProgress = document.getElementById('prepare-progress');

prepareBtn.addEventListener('click', async () => {
  prepareBtn.disabled = true;
  prepareBtn.textContent = 'Preparing...';
  downloadBtn.classList.add('hidden');
  prepareProgress.classList.remove('hidden');
  prepareBar.style.width = '0%';
  prepareStatus.textContent = 'Querying bias-corrected sessions...';

  // Animate progress bar while waiting
  let pct = 0;
  const ticker = setInterval(() => {
    pct = Math.min(pct + 8, 85);
    prepareBar.style.width = pct + '%';
  }, 200);

  try {
    const { data } = await prepareDataset();
    clearInterval(ticker);
    prepareBar.style.width = '100%';
    _exportId = data.export_id;
    const count = data.record_count;
    prepareStatus.textContent = `${count} records ready — click Download to save.`;
    datasetInfo.textContent = `${count} records ready`;
    downloadBtn.classList.remove('hidden');
    prepareBtn.textContent = 'Re-prepare';
  } catch (err) {
    clearInterval(ticker);
    prepareBar.style.width = '0%';
    prepareStatus.textContent = `Error: ${err.message}`;
    prepareBtn.textContent = 'Prepare Dataset';
  } finally {
    prepareBtn.disabled = false;
  }
});

downloadBtn.addEventListener('click', async () => {
  if (!_exportId) return;
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Downloading...';
  try {
    const blob = await downloadDataset(_exportId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bias-patch-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    downloadBtn.textContent = 'Download JSONL';
  } catch (err) {
    prepareStatus.textContent = `Download failed: ${err.message}`;
    downloadBtn.textContent = 'Download JSONL';
  } finally {
    downloadBtn.disabled = false;
  }
});

// Init
renderStats();
renderChart();
renderDistribution();
renderHeatmap();
renderAuditLog();
