import { submitChat, getSessions, getModels, isLoggedIn } from './api.js';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text) {
  // Escape HTML in the raw text first to prevent XSS, then render safe markdown
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return marked.parse(escaped);
}

// State
let forceBiasMode = false;
let currentModelId = 'gpt-4o';
const pipelineStages = ['Uploading', 'Bias Scanning', 'Inferring', 'Auditing', 'Wrapping', 'Done'];

// DOM refs
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sessionsList = document.getElementById('sessions-list');
const forceBiasToggle = document.getElementById('force-bias-toggle');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const biasModal = document.getElementById('bias-modal');
const biasModalOverlay = document.getElementById('bias-modal-overlay');
const biasModalClose = document.getElementById('bias-modal-close');
const biasModalContent = document.getElementById('bias-modal-content');
const biasModalBody = document.getElementById('bias-modal-body');
const statusIndicator = document.getElementById('status-indicator');
const modelSelect = document.getElementById('model-select');

async function loadModels() {
  if (!isLoggedIn()) return;
  try {
    const { data } = await getModels();
    if (!data?.models?.length) return;
    modelSelect.innerHTML = data.models.map((m) => `<option value="${m.id}">${m.id} (${m.provider})</option>`).join('');
    currentModelId = data.models[0].id;
  } catch { /* use fallback */ }
}

async function loadSessions() {
  if (!isLoggedIn()) return;
  try {
    const { data } = await getSessions(1, 20);
    renderApiSessions(data?.sessions || []);
  } catch { /* ignore */ }
}

function renderApiSessions(sessions) {
  if (!sessions.length) {
    sessionsList.innerHTML = '<p class="text-xs text-white/30 px-3 py-2">No sessions yet</p>';
    return;
  }
  sessionsList.innerHTML = sessions.map((s) => `
    <button data-session="${s.id}" class="w-full text-left px-3 py-2.5 rounded-lg transition-colors text-white/50 hover:bg-white/5 hover:text-white/70">
      <div class="text-xs font-medium truncate">${escapeHtml(s.preview || 'Session')}</div>
      <div class="text-[10px] text-white/30 mt-0.5">${new Date(s.created_at).toLocaleString()}</div>
    </button>`).join('');
}

forceBiasToggle.addEventListener('click', () => {
  forceBiasMode = !forceBiasMode;
  const knob = forceBiasToggle.querySelector('span');
  forceBiasToggle.dataset.active = forceBiasMode;
  if (forceBiasMode) {
    forceBiasToggle.classList.remove('bg-white/10'); forceBiasToggle.classList.add('bg-accent-red/30');
    knob.classList.remove('bg-white/40'); knob.classList.add('bg-accent-red');
    knob.style.transform = 'translateX(16px)';
  } else {
    forceBiasToggle.classList.remove('bg-accent-red/30'); forceBiasToggle.classList.add('bg-white/10');
    knob.classList.remove('bg-accent-red'); knob.classList.add('bg-white/40');
    knob.style.transform = 'translateX(0)';
  }
});

modelSelect.addEventListener('change', () => { currentModelId = modelSelect.value; });
sidebarToggle.addEventListener('click', () => { sidebar.classList.toggle('-translate-x-full'); });

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'flex justify-end animate-slide-up';
  div.innerHTML = `<div class="max-w-[80%] md:max-w-[60%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent-blue/20 text-sm">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(div); scrollToBottom();
}

function addPipelineIndicator() {
  const div = document.createElement('div');
  div.className = 'flex justify-start animate-slide-up';
  div.innerHTML = `
    <div class="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md bg-white/5 text-xs space-y-2">
      <div class="flex items-center gap-2 text-white/40">
        <svg class="w-3.5 h-3.5 animate-spin text-accent-blue" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
        <span id="pipeline-text">Processing...</span>
      </div>
      <div class="flex items-center gap-1.5">
        ${pipelineStages.map((s, i) => `<span class="pipeline-stage text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/20" data-stage="${i}">${s}</span>`).join('')}
      </div>
    </div>`;
  chatMessages.appendChild(div); scrollToBottom();
  return div;
}

async function animatePipeline(el, wrapperTriggered) {
  const stages = el.querySelectorAll('.pipeline-stage');
  const pipelineText = el.querySelector('#pipeline-text');
  const count = wrapperTriggered ? pipelineStages.length : 4;
  for (let i = 0; i < count; i++) {
    stages[i].classList.remove('bg-white/5', 'text-white/20');
    stages[i].classList.add('bg-accent-blue/20', 'text-accent-blue');
    pipelineText.textContent = pipelineStages[i] + '...';
    await new Promise((r) => setTimeout(r, 350));
  }
}

function addAIMessage(pipeline, finalText) {
  const score = pipeline.output_bias_score >= 0 ? pipeline.output_bias_score : pipeline.input_bias_score;
  const level = pipeline.confidence_level || (score > 60 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW');
  const biasClass = level === 'HIGH' ? 'bias-high' : level === 'MEDIUM' ? 'bias-medium' : 'bias-low';

  const responseData = {
    biasScore: Math.round(score),
    biasLevel: level,
    wrapperTriggered: pipeline.wrapper_triggered,
    text: pipeline.original_response || finalText,
    protectedAttrs: (pipeline.protected_attributes || []).map((a) => a.attribute),
    decisionPoints: (pipeline.protected_attributes || []).map((a) => ({ attr: a.attribute, confidence: a.confidence, description: a.matched_text || a.detection_method })),
  };

  const div = document.createElement('div');
  div.className = 'flex justify-start animate-slide-up';
  let html = `
    <div class="max-w-[85%] md:max-w-[70%]">
      <div class="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/5 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">${renderMarkdown(responseData.text)}</div>
      <div class="flex items-center gap-2 mt-2 flex-wrap">
        <span class="${biasClass} text-[10px] font-semibold px-2 py-0.5 rounded-full">${level} BIAS (${responseData.biasScore}%)</span>`;
  if (pipeline.wrapper_triggered) html += `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">Wrapper Applied</span>`;
  if (responseData.protectedAttrs.length) html += `<button class="bias-details-btn text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors" data-bias='${JSON.stringify(responseData)}'>View Details</button>`;
  html += `</div>`;
  if (pipeline.wrapper_triggered && finalText !== responseData.text) {
    html += `
      <div class="mt-3 px-4 py-2.5 rounded-2xl rounded-bl-md bg-accent-green/5 border border-accent-green/20 text-sm leading-relaxed">
        <span class="text-accent-green text-xs font-semibold block mb-1">Neutral Response</span>
        <div class="prose prose-invert prose-sm max-w-none">${renderMarkdown(finalText)}</div>
      </div>
      <div class="flex items-center gap-2 mt-2"><span class="bias-low text-[10px] font-semibold px-2 py-0.5 rounded-full">LOW BIAS</span></div>`;
  }
  html += `</div>`;
  div.innerHTML = html;
  chatMessages.appendChild(div); scrollToBottom();
  div.querySelectorAll('.bias-details-btn').forEach((btn) => btn.addEventListener('click', () => openBiasModal(JSON.parse(btn.dataset.bias))));
}

function openBiasModal(data) {
  const biasClass = data.biasLevel === 'HIGH' ? 'bias-high' : data.biasLevel === 'MEDIUM' ? 'bias-medium' : 'bias-low';
  biasModalBody.innerHTML = `
    <div class="space-y-4">
      <div class="glass-panel rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-white/40">Bias Score</span>
          <span class="${biasClass} text-xs font-semibold px-2 py-0.5 rounded-full">${data.biasLevel} (${data.biasScore}%)</span>
        </div>
        <div class="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <div class="h-full rounded-full ${data.biasScore > 60 ? 'bg-accent-red' : data.biasScore > 30 ? 'bg-accent-amber' : 'bg-accent-green'}" style="width:${data.biasScore}%"></div>
        </div>
      </div>
      ${data.protectedAttrs?.length ? `<div class="glass-panel rounded-xl p-4"><div class="text-xs text-white/40 mb-3">Protected Attributes</div><div class="flex flex-wrap gap-2">${data.protectedAttrs.map((a) => `<span class="text-xs px-2 py-1 rounded-lg bg-accent-red/10 text-accent-red border border-accent-red/20">${a}</span>`).join('')}</div></div>` : ''}
      ${data.decisionPoints?.length ? `<div class="glass-panel rounded-xl p-4"><div class="text-xs text-white/40 mb-3">Decision Points</div><div class="space-y-2">${data.decisionPoints.map((dp) => `<div class="flex items-start gap-3 p-2 rounded-lg bg-white/3"><div class="w-1.5 h-1.5 rounded-full bg-accent-amber mt-1.5 flex-shrink-0"></div><div><div class="text-xs font-medium text-white/70">${dp.attr}</div><div class="text-[10px] text-white/40 mt-0.5">${escapeHtml(dp.description || '')}</div><div class="text-[10px] text-accent-amber mt-0.5">Confidence: ${(dp.confidence * 100).toFixed(0)}%</div></div></div>`).join('')}</div></div>` : ''}
    </div>`;
  biasModal.classList.remove('hidden');
  requestAnimationFrame(() => { biasModalContent.style.transform = 'translateX(0)'; });
}

function closeBiasModal() {
  biasModalContent.style.transform = 'translateX(100%)';
  setTimeout(() => biasModal.classList.add('hidden'), 300);
}
biasModalClose.addEventListener('click', closeBiasModal);
biasModalOverlay.addEventListener('click', closeBiasModal);

function setStatus(status) {
  const dot = statusIndicator.querySelector('span:first-child');
  const label = statusIndicator.querySelector('span:last-child');
  statusIndicator.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full';
  if (status === 'processing') {
    statusIndicator.classList.add('bg-accent-amber/10', 'border', 'border-accent-amber/20');
    dot.className = 'w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse';
    label.className = 'text-[10px] font-semibold text-accent-amber';
    label.textContent = 'PROCESSING';
  } else {
    statusIndicator.classList.add('bg-accent-green/10', 'border', 'border-accent-green/20');
    dot.className = 'w-1.5 h-1.5 rounded-full bg-accent-green status-live';
    label.className = 'text-[10px] font-semibold text-accent-green';
    label.textContent = 'LIVE';
  }
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  if (!isLoggedIn()) {
    addErrorMessage('Please log in to use the chat.');
    return;
  }
  chatInput.value = '';
  addUserMessage(text);
  setStatus('processing');
  const pipelineEl = addPipelineIndicator();
  try {
    const { data } = await submitChat(text, currentModelId, forceBiasMode);
    await animatePipeline(pipelineEl, data.pipeline?.wrapper_triggered);
    pipelineEl.remove();
    addAIMessage(data.pipeline, data.response);
    await loadSessions();
  } catch (err) {
    pipelineEl.remove();
    addErrorMessage(err.message || 'Pipeline failed. Is the backend running?');
  } finally {
    setStatus('live');
  }
});

function addErrorMessage(msg) {
  const div = document.createElement('div');
  div.className = 'flex justify-start';
  div.innerHTML = `<div class="px-4 py-2.5 rounded-xl bg-accent-red/10 border border-accent-red/20 text-xs text-accent-red">${escapeHtml(msg)}</div>`;
  chatMessages.appendChild(div); scrollToBottom();
}

document.getElementById('new-session-btn').addEventListener('click', () => {
  chatMessages.innerHTML = `<div class="flex justify-center py-8"><div class="text-center max-w-md"><div class="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center"><svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg></div><h2 class="text-lg font-bold mb-2">AI Bias Firewall Chat</h2><p class="text-sm text-white/40">Send a message to see real-time bias detection and correction in action.</p></div></div>`;
});

function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }
function escapeHtml(text) { const d = document.createElement('div'); d.textContent = String(text); return d.innerHTML; }

loadModels();
loadSessions();
