/* =========================================================================
   BioDota: Игровой цикл, координация матча и привязка событий арены
   ========================================================================= */

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const chartCanvas = document.getElementById('chartCanvas');
const victoryChartCanvas = document.getElementById('victoryChartCanvas');

let canvasDisplayWidth = 1920;
let canvasDisplayHeight = 1080;
let canvasScale = 1.0;

let currentAlphaSpecies = 'warrior';
let currentBetaSpecies = 'forager';

let isRunning = false;
let simStarted = false;
let matchEnded = false;
let timeScale = 1.0;
let cheatsEnabled = false;
let currentTool = 'inspect';
let selectedBacterium = null;
let activeTuningSpecies = 'warrior';
let isMouseDown = false;
let pointerDownPos = { x: 0, y: 0 };
let simulationTime = 0;
let highestGeneration = 1;

let colony = [];
let neutrals = [];
let superBacteria = [];
let foods = [];
let antibiotics = [];
let sparks = [];
let feeders = [];
let projectiles = [];

const chartHistory = { capacity: 60, alpha: [], beta: [], lastSampleTime: 0 };
let fullMatchHistory = { alpha: [], beta: [] };

let victoryParticles = [];
let victoryFxAnimationId = null;

function resizeCanvases() {
  const container = document.getElementById('petri-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const availW = Math.max(200, rect.width - 8);
  const availH = Math.max(200, rect.height - 8);

  let w = availW;
  let h = w * (9 / 16);
  if (h > availH) {
    h = availH;
    w = h * (16 / 9);
  }

  canvasDisplayWidth = Math.floor(w);
  canvasDisplayHeight = Math.floor(h);
  canvasScale = canvasDisplayWidth / VIRTUAL_WIDTH;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvasDisplayWidth * dpr);
  canvas.height = Math.round(canvasDisplayHeight * dpr);
  canvas.style.width = `${canvasDisplayWidth}px`;
  canvas.style.height = `${canvasDisplayHeight}px`;

  const chartRect = chartCanvas.getBoundingClientRect();
  chartCanvas.width = Math.round(chartRect.width * dpr);
  chartCanvas.height = Math.round(chartRect.height * dpr);
}

function updateFeederGuards() {
  ['alpha', 'beta'].forEach(strain => {
    const feeder = feeders.find(f => f.strainType === strain && !f.dead);
    if (!feeder) return;

    let guards = colony.filter(b => b.strain === strain && !b.dead && b.isFeederGuard);

    if (guards.length > 2) {
      guards.sort((a, b) => Math.hypot(a.x - feeder.x, a.y - feeder.y) - Math.hypot(b.x - feeder.x, b.y - feeder.y));
      for (let i = 2; i < guards.length; i++) guards[i].isFeederGuard = false;
      guards = guards.slice(0, 2);
    }

    if (guards.length < 2) {
      const candidates = colony.filter(b => b.strain === strain && !b.dead && !b.isFeederGuard);
      candidates.sort((a, b) => Math.hypot(a.x - feeder.x, a.y - feeder.y) - Math.hypot(b.x - feeder.x, b.y - feeder.y));
      while (guards.length < 2 && candidates.length > 0) {
        const recruit = candidates.shift();
        recruit.isFeederGuard = true;
        guards.push(recruit);
      }
    }

    if (guards.length >= 1) guards[0].guardPole = 0;
    if (guards.length >= 2) guards[1].guardPole = 1;
  });
}

function initVictoryFx(isRadiant) {
  const victoryFxCanvas = document.getElementById('victoryFxCanvas');
  if (!victoryFxCanvas) return;
  const victoryFxCtx = victoryFxCanvas.getContext('2d');
  const rect = victoryFxCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  victoryFxCanvas.width = Math.round(rect.width * dpr);
  victoryFxCanvas.height = Math.round(rect.height * dpr);

  victoryParticles = [];
  for (let i = 0; i < 110; i++) victoryParticles.push(new VictoryParticle(rect.width, rect.height, isRadiant));

  if (victoryFxAnimationId) cancelAnimationFrame(victoryFxAnimationId);

  let lastFxTime = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastFxTime) / 1000, 0.1);
    lastFxTime = now;
    victoryFxCtx.clearRect(0, 0, victoryFxCanvas.width, victoryFxCanvas.height);
    victoryFxCtx.save();
    victoryFxCtx.scale(dpr, dpr);

    let activeCount = 0;
    for (let p of victoryParticles) {
      p.update(dt);
      p.draw(victoryFxCtx);
      if (p.life > 0) activeCount++;
      else if (Math.random() < 0.25) { p.reset(false, isRadiant); activeCount++; }
    }
    victoryFxCtx.restore();
    if (activeCount > 0 && !document.getElementById('victory-modal').classList.contains('hidden')) {
      victoryFxAnimationId = requestAnimationFrame(loop);
    }
  }
  victoryFxAnimationId = requestAnimationFrame(loop);
}

function stopVictoryFx() {
  const victoryFxCanvas = document.getElementById('victoryFxCanvas');
  if (victoryFxAnimationId) { cancelAnimationFrame(victoryFxAnimationId); victoryFxAnimationId = null; }
  if (victoryFxCanvas) {
    const ctx = victoryFxCanvas.getContext('2d');
    ctx.clearRect(0, 0, victoryFxCanvas.width, victoryFxCanvas.height);
  }
}

function spawnInitialFixedRunes() {
  fixedFoodSpawners.forEach(spawner => {
    for (let i = 0; i < spawner.count; i++) {
      foods.push(new Food(spawner.x + (Math.random() - 0.5) * 45, spawner.y + (Math.random() - 0.5) * 45));
    }
  });
}

function initColony() {
  stopVictoryFx();
  colony = [];
  neutrals = [];
  superBacteria = [];
  foods = [];
  antibiotics = [];
  sparks = [];
  projectiles = [];
  simulationTime = 0;
  highestGeneration = 1;
  selectedBacterium = null;
  matchEnded = false;

  chartHistory.alpha = [];
  chartHistory.beta = [];
  chartHistory.lastSampleTime = 0;
  fullMatchHistory.alpha = [CONFIG.initialStrainCount];
  fullMatchHistory.beta = [CONFIG.initialStrainCount];

  feeders = [
    new AutomaticFeeder(190, 190, 'alpha'),
    new AutomaticFeeder(VIRTUAL_WIDTH - 190, VIRTUAL_HEIGHT - 190, 'beta')
  ];

  superBacteria = [
    new SuperBacterium(280, 110, 'alpha', 'base'),
    new SuperBacterium(670, 110, 'alpha', 'mid'),
    new SuperBacterium(1060, 110, 'alpha', 'central'),
    new SuperBacterium(300, 240, 'alpha', 'base'),
    new SuperBacterium(580, 368, 'alpha', 'mid'),
    new SuperBacterium(860, 495, 'alpha', 'central'),
    new SuperBacterium(190, 310, 'alpha', 'base'),
    new SuperBacterium(190, 855, 'alpha', 'mid'),
    new SuperBacterium(620, 970, 'alpha', 'central'),

    new SuperBacterium(1300, 110, 'beta', 'central'),
    new SuperBacterium(1730, 225, 'beta', 'mid'),
    new SuperBacterium(1730, 770, 'beta', 'base'),
    new SuperBacterium(1060, 585, 'beta', 'central'),
    new SuperBacterium(1340, 712, 'beta', 'mid'),
    new SuperBacterium(1620, 840, 'beta', 'base'),
    new SuperBacterium(860, 970, 'beta', 'central'),
    new SuperBacterium(1250, 970, 'beta', 'mid'),
    new SuperBacterium(1640, 970, 'beta', 'base')
  ];

  neutrals = neutralCamps.map(camp => new NeutralGuardian(camp.x, camp.y, camp.name));

  for (let i = 0; i < CONFIG.initialStrainCount; i++) {
    const x = 190 + (Math.random() - 0.5) * 140;
    const y = 190 + (Math.random() - 0.5) * 140;
    colony.push(new Bacterium(x, y, null, 'alpha', currentAlphaSpecies));
  }

  for (let i = 0; i < CONFIG.initialStrainCount; i++) {
    const x = (VIRTUAL_WIDTH - 190) + (Math.random() - 0.5) * 140;
    const y = (VIRTUAL_HEIGHT - 190) + (Math.random() - 0.5) * 140;
    colony.push(new Bacterium(x, y, null, 'beta', currentBetaSpecies));
  }

  updateFeederGuards();
  spawnInitialFixedRunes();
  updateInspectorUI();
  updateChart();
}

function triggerMatchVictory(winnerStrain, reason = 'wiped') {
  if (matchEnded) return;
  matchEnded = true;
  isRunning = false;

  const isRadiant = winnerStrain === 'alpha';
  const victoryModal = document.getElementById('victory-modal');
  const cardInner = document.getElementById('victory-card-inner');
  const title = document.getElementById('victory-title');
  const subtitle = document.getElementById('victory-subtitle');
  const bannerTag = document.getElementById('victory-banner-tag');
  const durationEl = document.getElementById('victory-match-duration');
  const reasonBadge = document.getElementById('victory-reason-badge');
  const maxGenEl = document.getElementById('victory-max-gen');
  const petriContainer = document.getElementById('petri-container');

  if (petriContainer) {
    petriContainer.classList.remove('screen-shake-effect');
    void petriContainer.offsetWidth;
    petriContainer.classList.add('screen-shake-effect');
    setTimeout(() => petriContainer.classList.remove('screen-shake-effect'), 700);
  }

  const mins = Math.floor(simulationTime / 60).toString().padStart(2, '0');
  const secs = Math.floor(simulationTime % 60).toString().padStart(2, '0');
  if (durationEl) durationEl.innerText = `${mins}:${secs}`;
  if (maxGenEl) maxGenEl.innerText = `Gen ${highestGeneration}`;

  if (isRadiant) {
    if (bannerTag) {
      bannerTag.className = "text-[9px] font-mono tracking-[0.25em] uppercase font-bold px-3 py-0.5 rounded-full border border-emerald-500/50 text-emerald-300 bg-emerald-950/70 shadow-md mb-1.5";
      bannerTag.innerText = "ВЕЛИКИЙ ТРИУМФ RADIANT";
    }
    if (title) {
      title.innerText = "ПОБЕДА RADIANT!";
      title.className = "text-xl sm:text-2xl font-extrabold font-dota mb-0.5 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-yellow-200 to-emerald-400 shimmer-text dota-gold-glow";
    }
    if (reason === 'feeder_eaten') {
      if (reasonBadge) { reasonBadge.innerText = "Трон Съеден"; reasonBadge.className = "font-bold text-amber-300 text-[10px]"; }
      if (subtitle) subtitle.innerText = "Вражеская кормушка Dire полностью поглощена и съедена штаммом Radiant!";
    } else {
      if (reasonBadge) { reasonBadge.innerText = "Истребление"; reasonBadge.className = "font-bold text-emerald-300 text-[10px]"; }
      if (subtitle) subtitle.innerText = "Колония Dire полностью истреблена в ходе тотальной биологической войны.";
    }
  } else {
    if (bannerTag) {
      bannerTag.className = "text-[9px] font-mono tracking-[0.25em] uppercase font-bold px-3 py-0.5 rounded-full border border-rose-500/50 text-rose-300 bg-rose-950/70 shadow-md mb-1.5";
      bannerTag.innerText = "ВЕЛИКИЙ ТРИУМФ DIRE";
    }
    if (title) {
      title.innerText = "ПОБЕДА DIRE!";
      title.className = "text-xl sm:text-2xl font-extrabold font-dota mb-0.5 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-orange-300 to-rose-500 shimmer-text";
    }
    if (reason === 'feeder_eaten') {
      if (reasonBadge) { reasonBadge.innerText = "Древо Съедено"; reasonBadge.className = "font-bold text-amber-300 text-[10px]"; }
      if (subtitle) subtitle.innerText = "Кормушка Radiant полностью поглощена и съедена штаммом Dire!";
    } else {
      if (reasonBadge) { reasonBadge.innerText = "Истребление"; reasonBadge.className = "font-bold text-rose-400 text-[10px]"; }
      if (subtitle) subtitle.innerText = "Колония Radiant полностью уничтожена под натиском багрового штамма.";
    }
  }

  const specRad = SPECIES_CONFIG[currentAlphaSpecies];
  const specDire = SPECIES_CONFIG[currentBetaSpecies];
  const timeBonus = (Math.min(1.2, simulationTime * 0.0015) * 100).toFixed(1);
  const coeffGrid = document.getElementById('victory-coefficients-grid');
  if (coeffGrid) {
    const radK = (specRad.damageMult / specRad.defenseMult).toFixed(2);
    const direK = (specDire.damageMult / specDire.defenseMult).toFixed(2);
    coeffGrid.innerHTML = `
      <div class="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30">
        <div class="font-dota font-bold text-emerald-300 text-[10px] mb-1 flex justify-between items-center">
          <span>🟢 Radiant: ${specRad.badge}</span>
          <span class="font-mono text-emerald-400 text-[9px]">k = ${radK}</span>
        </div>
        <div class="space-y-0.5 text-[9px] text-slate-300 font-mono">
          <div>Урон: <span class="text-emerald-300 font-bold">${specRad.damageMult.toFixed(2)}x</span></div>
          <div>Броня: <span class="text-cyan-300">${Math.round((1 - specRad.defenseMult) * 100)}%</span> (x${specRad.defenseMult.toFixed(2)})</div>
          <div>Скорость: <span class="text-amber-300">${specRad.speedBonus.toFixed(2)}x</span></div>
          <div>Срок жизни: <span class="text-emerald-300">${Math.round(specRad.lifespanMult * 100)}%</span></div>
        </div>
      </div>
      <div class="p-2 rounded-lg bg-rose-950/50 border border-rose-500/30">
        <div class="font-dota font-bold text-rose-300 text-[10px] mb-1 flex justify-between items-center">
          <span>🔴 Dire: ${specDire.badge}</span>
          <span class="font-mono text-rose-400 text-[9px]">k = ${direK}</span>
        </div>
        <div class="space-y-0.5 text-[9px] text-slate-300 font-mono">
          <div>Урон: <span class="text-rose-300 font-bold">${specDire.damageMult.toFixed(2)}x</span></div>
          <div>Броня: <span class="text-cyan-300">${Math.round((1 - specDire.defenseMult) * 100)}%</span> (x${specDire.defenseMult.toFixed(2)})</div>
          <div>Скорость: <span class="text-amber-300">${specDire.speedBonus.toFixed(2)}x</span></div>
          <div>Срок жизни: <span class="text-rose-300">${Math.round(specDire.lifespanMult * 100)}%</span></div>
        </div>
      </div>
      <div class="col-span-2 pt-1 border-t border-slate-800 flex justify-between text-[9px] font-mono text-slate-400">
        <span>Эволюционный прирост: +${timeBonus}%</span>
        <span class="text-amber-300">Баланс: 100 vs 100 (выживших ≤ 5)</span>
      </div>
    `;
  }

  playTone('victory');

  if (cardInner) {
    cardInner.classList.remove('animate-victory-card');
    void cardInner.offsetWidth;
    cardInner.classList.add('animate-victory-card');
  }

  if (victoryModal) victoryModal.classList.remove('hidden');
  initVictoryFx(isRadiant);

  const winningSpeciesId = isRadiant ? currentAlphaSpecies : currentBetaSpecies;
  renderSlyWinnerBacterium(winningSpeciesId, winnerStrain, reason);

  setSpeciesConfigLocked(false);
  syncOpponentSelectorLabels();
  requestAnimationFrame(() => setTimeout(drawVictoryChart, 60));
}

function setSpeciesConfigLocked(locked) {
  const lockBadge = document.getElementById('tuning-lock-badge');
  const lockedNotice = document.getElementById('tuning-locked-notice');
  const controlsBox = document.getElementById('tuning-controls-box');
  const btnResetStats = document.getElementById('btn-reset-species-stats');
  
  const sliders = [
    document.getElementById('tune-slider-speed'),
    document.getElementById('tune-slider-damage'),
    document.getElementById('tune-slider-defense'),
    document.getElementById('tune-slider-lifespan')
  ];

  if (locked) {
    lockBadge.classList.remove('hidden');
    lockedNotice.classList.remove('hidden');
    controlsBox.classList.add('opacity-60', 'pointer-events-none');
    btnResetStats.classList.add('opacity-40', 'pointer-events-none');
    sliders.forEach(s => { if (s) s.disabled = true; });
  } else {
    lockBadge.classList.add('hidden');
    lockedNotice.classList.add('hidden');
    controlsBox.classList.remove('opacity-60', 'pointer-events-none');
    btnResetStats.classList.remove('opacity-40', 'pointer-events-none');
    sliders.forEach(s => { if (s) s.disabled = false; });
  }
}

function drawMapTerrain(c, w, h) {
  c.fillStyle = '#060a0f';
  c.fillRect(0, 0, w, h);

  c.fillStyle = 'rgba(15, 23, 42, 0.4)';
  c.beginPath();
  for (let i = 0; i < 40; i++) {
    const sx = (Math.sin(i * 123) * 0.5 + 0.5) * w;
    const sy = (Math.cos(i * 321) * 0.5 + 0.5) * h;
    c.arc(sx, sy, 50 + (i % 5) * 16, 0, Math.PI * 2);
  }
  c.fill();

  // Река
  c.save();
  c.beginPath();
  c.moveTo(580, 1120);
  c.bezierCurveTo(750, 800, 1170, 280, 1340, -40);
  c.strokeStyle = 'rgba(23, 37, 54, 0.95)';
  c.lineWidth = 140;
  c.lineCap = 'round';
  c.stroke();

  const riverGrad = c.createLinearGradient(580, 1120, 1340, -40);
  riverGrad.addColorStop(0, '#042233');
  riverGrad.addColorStop(0.5, '#073b54');
  riverGrad.addColorStop(1, '#042233');
  c.strokeStyle = riverGrad;
  c.lineWidth = 105;
  c.stroke();

  c.strokeStyle = 'rgba(14, 165, 233, 0.28)';
  c.lineWidth = 50;
  c.stroke();
  c.restore();

  // Линии
  lanes.forEach(lane => {
    c.save();
    c.beginPath();
    lane.points.forEach((p, idx) => {
      if (idx === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y);
    });
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(25, 36, 51, 0.95)';
    c.lineWidth = lane.width * 1.8;
    c.stroke();

    c.strokeStyle = 'rgba(14, 116, 144, 0.25)';
    c.lineWidth = lane.width * 1.1;
    c.stroke();

    c.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    c.lineWidth = 4;
    c.setLineDash([12, 14]);
    c.stroke();
    c.restore();
  });

  // Базовые плазы
  c.save();
  c.beginPath();
  c.arc(190, 190, 110, 0, Math.PI * 2);
  c.fillStyle = 'rgba(12, 26, 22, 0.95)';
  c.strokeStyle = 'rgba(16, 185, 129, 0.45)';
  c.lineWidth = 3;
  c.fill(); c.stroke();

  c.beginPath();
  c.arc(1730, 890, 110, 0, Math.PI * 2);
  c.fillStyle = 'rgba(26, 14, 18, 0.95)';
  c.strokeStyle = 'rgba(244, 63, 94, 0.45)';
  c.lineWidth = 3;
  c.fill(); c.stroke();
  c.restore();

  // Лесные лагеря
  neutralCamps.forEach(camp => {
    c.save();
    c.beginPath();
    c.arc(camp.x, camp.y, 48, 0, Math.PI * 2);
    c.fillStyle = 'rgba(8, 20, 16, 0.8)';
    c.fill();

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      c.beginPath();
      c.arc(camp.x + Math.cos(a) * 40, camp.y + Math.sin(a) * 40, 10, 0, Math.PI * 2);
      c.fillStyle = 'rgba(12, 32, 26, 0.92)';
      c.strokeStyle = 'rgba(34, 197, 94, 0.35)';
      c.lineWidth = 1.2;
      c.fill(); c.stroke();
    }

    c.beginPath();
    c.arc(camp.x, camp.y, 22, 0, Math.PI * 2);
    c.fillStyle = 'rgba(168, 85, 247, 0.04)';
    c.strokeStyle = 'rgba(192, 132, 252, 0.22)';
    c.lineWidth = 1.0;
    c.setLineDash([3, 4]);
    c.stroke(); c.fill();

    c.beginPath();
    c.arc(camp.x, camp.y, 5, 0, Math.PI * 2);
    c.fillStyle = '#7e22ce';
    c.fill();
    c.restore();
  });

  // Рунические точки
  fixedFoodSpawners.forEach(spawner => {
    c.save();
    c.beginPath();
    c.arc(spawner.x, spawner.y, 20, 0, Math.PI * 2);
    c.fillStyle = 'rgba(234, 179, 8, 0.08)';
    c.strokeStyle = 'rgba(234, 179, 8, 0.4)';
    c.lineWidth = 2;
    c.stroke(); c.fill();

    c.beginPath();
    c.moveTo(spawner.x, spawner.y - 6);
    c.lineTo(spawner.x + 5, spawner.y);
    c.lineTo(spawner.x, spawner.y + 6);
    c.lineTo(spawner.x - 5, spawner.y);
    c.closePath();
    c.fillStyle = 'rgba(253, 224, 71, 0.7)';
    c.fill();
    c.restore();
  });
}

// Привязка управления и интерактивности
function setupEventListeners() {
  const btnStart = document.getElementById('btn-start-simulation');
  const startOverlay = document.getElementById('start-overlay');
  const playBtn = document.getElementById('btn-play-pause');
  const playIcon = document.getElementById('play-icon');
  const playText = document.getElementById('play-text');
  const pauseOverlay = document.getElementById('pause-overlay');

  function setSimulationRunning(running) {
    if (!simStarted && running) { btnStart.click(); return; }
    isRunning = running;
    if (isRunning) {
      playIcon.className = "fa-solid fa-pause text-xs";
      playText.innerText = "Пауза";
      pauseOverlay.classList.add('hidden');
    } else {
      playIcon.className = "fa-solid fa-play text-xs";
      playText.innerText = "Старт";
      if (simStarted && !matchEnded) pauseOverlay.classList.remove('hidden');
    }
  }

  btnStart.addEventListener('click', () => {
    initAudio();
    simStarted = true;
    setSpeciesConfigLocked(true);
    startOverlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => startOverlay.classList.add('hidden'), 300);
    setSimulationRunning(true);
    showNotification("Битва началась! Штаммы зафиксированы до конца матча.");
  });

  playBtn.addEventListener('click', () => setSimulationRunning(!isRunning));
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setSimulationRunning(!isRunning); }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    stopVictoryFx();
    simStarted = false;
    matchEnded = false;
    setSpeciesConfigLocked(false);
    initColony();
    syncOpponentSelectorLabels();
    setSimulationRunning(false);
    startOverlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    pauseOverlay.classList.add('hidden');
    document.getElementById('victory-modal').classList.add('hidden');
    showNotification("Арена сброшена к исходному состоянию.");
  });

  const soundBtn = document.getElementById('btn-toggle-sound');
  const soundIcon = document.getElementById('sound-icon');
  soundBtn.addEventListener('click', () => {
    initAudio();
    isAudioEnabled = !isAudioEnabled;
    if (isAudioEnabled) {
      soundIcon.className = "fa-solid fa-volume-high text-amber-400 text-xs sm:text-sm";
      showNotification("Звуки включены");
    } else {
      soundIcon.className = "fa-solid fa-volume-xmark text-slate-400 text-xs sm:text-sm";
      showNotification("Звуки выключены");
    }
  });

  const speedButtons = document.querySelectorAll('.speed-btn');
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => {
        b.classList.remove('bg-amber-600/90', 'text-amber-100', 'font-bold');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-amber-600/90', 'text-amber-100', 'font-bold');
      btn.classList.remove('text-slate-400');
      timeScale = parseFloat(btn.dataset.speed);
      showNotification(`Скорость времени: ${timeScale}x`);
    });
  });

  // Обработка кликов по Canvas
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    initAudio();
  });

  window.addEventListener('mouseup', (e) => {
    if (isMouseDown) {
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) < 8) {
        handleCanvasClick(e);
      }
    }
    isMouseDown = false;
  });

  function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0].clientX);
    const clientY = e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0].clientY);
    if (clientX === undefined || clientY === undefined) return;

    const x = (clientX - rect.left) * (VIRTUAL_WIDTH / rect.width);
    const y = (clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height);

    if (x < 10 || x > VIRTUAL_WIDTH - 10 || y < 10 || y > VIRTUAL_HEIGHT - 10) return;

    // Проверка клика по кормушкам для смены вида
    if (!simStarted || matchEnded) {
      for (let feeder of feeders) {
        if (Math.hypot(feeder.x - x, feeder.y - y) <= feeder.radius + 30) {
          openFeederModal(feeder);
          return;
        }
      }
    }

    let nearest = null;
    let minDist = 36;
    for (let b of colony) {
      if (b.dead) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < minDist) { minDist = d; nearest = b; }
    }

    if (nearest) {
      selectedBacterium = nearest;
      updateInspectorUI();
      showNotification(`Выбрана особь штамма ${nearest.strain === 'alpha' ? 'Radiant' : 'Dire'}`);
      return;
    }

    if (simStarted && !matchEnded) {
      setSimulationRunning(!isRunning);
      showNotification(isRunning ? "▶️ Симуляция продолжается" : "⏸️ Симуляция на паузе");
    }
  }

  function openFeederModal(feeder) {
    const modal = document.getElementById('feeder-modal');
    const title = document.getElementById('modal-feeder-title');
    const dot = document.getElementById('modal-feeder-dot');
    const isAlpha = feeder.strainType === 'alpha';

    title.innerText = `Выбор штамма: ${isAlpha ? 'Radiant (Зеленый)' : 'Dire (Красный)'}`;
    dot.className = `w-2.5 h-2.5 rounded-full ${isAlpha ? 'bg-emerald-400' : 'bg-rose-400'}`;

    const list = document.getElementById('modal-species-list');
    const currentSelected = (feeder.strainType === 'alpha') ? currentAlphaSpecies : currentBetaSpecies;
    list.innerHTML = '';

    Object.values(SPECIES_CONFIG).forEach(spec => {
      const isSelected = (spec.id === currentSelected);
      const btn = document.createElement('div');
      btn.className = `p-2 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
        isSelected 
          ? (feeder.strainType === 'alpha' ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-md shadow-emerald-500/20' : 'bg-rose-950/60 border-rose-400 text-white shadow-md shadow-rose-500/20')
          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
      }`;
      
      btn.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-0.5">
            <span class="font-bold text-xs font-dota">${spec.name}</span>
            ${isSelected ? '<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">Выбран</span>' : ''}
          </div>
          <div class="text-[9px] text-slate-400 space-y-0.5 font-mono">
            <div>Скорость: <span class="text-slate-200">${spec.speedBonus}x</span> | Урон: <span class="text-slate-200">${spec.damageMult}x</span></div>
            <div>Броня: <span class="text-slate-200">${Math.round((1 - spec.defenseMult) * 100)}%</span> | Срок: <span class="text-slate-200">${spec.lifespanMult}x</span></div>
          </div>
        </div>
      `;

      btn.addEventListener('click', () => {
        if (feeder.strainType === 'alpha') currentAlphaSpecies = spec.id;
        else currentBetaSpecies = spec.id;
        
        syncOpponentSelectorLabels();
        modal.classList.add('hidden');
        showNotification(`Для фракции ${feeder.strainType === 'alpha' ? 'Radiant' : 'Dire'} установлен вид: ${spec.name}`);
      });

      list.appendChild(btn);
    });

    modal.classList.remove('hidden');
  }

  document.getElementById('feeder-modal-close').addEventListener('click', () => document.getElementById('feeder-modal').classList.add('hidden'));
  document.getElementById('btn-modal-cancel').addEventListener('click', () => document.getElementById('feeder-modal').classList.add('hidden'));
  document.getElementById('start-pick-alpha').addEventListener('click', () => openFeederModal({ strainType: 'alpha' }));
  document.getElementById('start-pick-beta').addEventListener('click', () => openFeederModal({ strainType: 'beta' }));
  document.getElementById('btn-close-victory').addEventListener('click', () => {
    stopVictoryFx();
    document.getElementById('victory-modal').classList.add('hidden');
  });
  document.getElementById('btn-new-simulation').addEventListener('click', () => {
    stopVictoryFx();
    document.getElementById('victory-modal').classList.add('hidden');
    initColony();
    btnStart.click();
  });
}

// Главный цикл анимации
let lastTimestamp = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const realDt = Math.min((now - lastTimestamp) / 1000, 0.1);
  lastTimestamp = now;
  const dt = realDt * timeScale;

  if (isRunning && !matchEnded) {
    simulationTime += dt;
    updateFeederGuards();

    for (let feeder of feeders) feeder.update(dt);

    for (let spawner of fixedFoodSpawners) {
      spawner.timer += dt;
      if (spawner.timer >= spawner.interval) {
        spawner.timer = 0;
        if (foods.length < 750) {
          for (let i = 0; i < spawner.count; i++) {
            foods.push(new Food(spawner.x + (Math.random() - 0.5) * 45, spawner.y + (Math.random() - 0.5) * 45));
          }
        }
      }
    }

    for (let sb of superBacteria) {
      const enemyStrain = sb.strain === 'alpha' ? 'beta' : 'alpha';
      sb.update(dt, colony.filter(b => b.strain === enemyStrain));
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
      projectiles[i].update(dt);
      if (projectiles[i].dead) projectiles.splice(i, 1);
    }

    for (let n of neutrals) n.update(dt, colony);

    for (let i = antibiotics.length - 1; i >= 0; i--) {
      antibiotics[i].update(dt);
      if (antibiotics[i].life <= 0) antibiotics.splice(i, 1);
    }

    for (let f of foods) f.update();

    for (let i = sparks.length - 1; i >= 0; i--) {
      sparks[i].update();
      if (sparks[i].life <= 0) sparks.splice(i, 1);
    }

    for (let i = colony.length - 1; i >= 0; i--) {
      const b = colony[i];
      b.update(dt, foods, antibiotics, colony, superBacteria, neutrals);
      if (b.dead && b.opacity <= 0) {
        if (selectedBacterium === b) selectedBacterium = null;
        colony.splice(i, 1);
      }
    }

    if (simulationTime - chartHistory.lastSampleTime >= 1.0) {
      chartHistory.lastSampleTime = simulationTime;
      const countAlpha = colony.filter(b => b.strain === 'alpha' && !b.dead).length;
      const countBeta = colony.filter(b => b.strain === 'beta' && !b.dead).length;
      
      chartHistory.alpha.push(countAlpha);
      chartHistory.beta.push(countBeta);
      fullMatchHistory.alpha.push(countAlpha);
      fullMatchHistory.beta.push(countBeta);

      if (chartHistory.alpha.length > chartHistory.capacity) {
        chartHistory.alpha.shift();
        chartHistory.beta.shift();
      }
      updateChart();
      updateInspectorUI();

      if (simStarted && simulationTime > 2.0) {
        if (countAlpha === 0 && countBeta > 0) triggerMatchVictory('beta');
        else if (countBeta === 0 && countAlpha > 0) triggerMatchVictory('alpha');
      }
    }
  }

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const renderScale = canvasScale * dpr;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  drawMapTerrain(ctx, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  for (let ab of antibiotics) ab.draw(ctx);
  for (let sb of superBacteria) sb.draw(ctx);
  for (let p of projectiles) p.draw(ctx);
  for (let n of neutrals) n.draw(ctx);
  for (let feeder of feeders) feeder.draw(ctx);
  for (let f of foods) f.draw(ctx);
  for (let b of colony) b.draw(ctx);
  for (let s of sparks) s.draw(ctx);

  const alphaCount = colony.filter(b => b.strain === 'alpha' && !b.dead).length;
  const betaCount = colony.filter(b => b.strain === 'beta' && !b.dead).length;
  document.getElementById('stat-alpha').innerText = alphaCount;
  document.getElementById('stat-beta').innerText = betaCount;
  
  const mins = Math.floor(simulationTime / 60).toString().padStart(2, '0');
  const secs = Math.floor(simulationTime % 60).toString().padStart(2, '0');
  document.getElementById('stat-time').innerText = `${mins}:${secs}`;
}

window.addEventListener('load', () => {
  initAudio();
  resizeCanvases();
  initColony();
  syncOpponentSelectorLabels();
  setupEventListeners();
  window.addEventListener('resize', () => {
    resizeCanvases();
    updateChart();
  });
  requestAnimationFrame(animate);
});