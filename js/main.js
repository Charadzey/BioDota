/* =========================================================================
   BioDota: Игровой цикл, координация матча и привязка событий арены
   ========================================================================= */

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const chartCanvas = document.getElementById('chartCanvas');
const chartCtx = chartCanvas.getContext('2d');

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

function spawnInitialFixedRunes() {
  fixedFoodSpawners.forEach(spawner => {
    for (let i = 0; i < spawner.count; i++) {
      foods.push(new Food(spawner.x + (Math.random() - 0.5) * 45, spawner.y + (Math.random() - 0.5) * 45));
    }
  });
}

const startOverlay = document.getElementById('start-overlay');
const btnStart = document.getElementById('btn-start-simulation');
const playBtn = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const playText = document.getElementById('play-text');
const pauseOverlay = document.getElementById('pause-overlay');

function setSimulationRunning(running) {
  if (!simStarted && running) { 
    if (btnStart) btnStart.click(); 
    return; 
  }
  isRunning = running;
  if (isRunning) {
    if (playIcon) playIcon.className = "fa-solid fa-pause text-xs";
    if (playText) playText.innerText = "Пауза";
    if (pauseOverlay) pauseOverlay.classList.add('hidden');
  } else {
    if (playIcon) playIcon.className = "fa-solid fa-play text-xs";
    if (playText) playText.innerText = "Старт";
    if (simStarted && !matchEnded && pauseOverlay) pauseOverlay.classList.remove('hidden');
  }
}

function checkFeederClick(x, y) {
  for (let feeder of feeders) {
    const dist = Math.hypot(feeder.x - x, feeder.y - y);
    if (dist <= feeder.radius + 30) {
      if (simStarted && !matchEnded) {
        showNotification("🔒 Выбор вида заблокирован во время активного матча! Нажмите «Сброс».");
        return true;
      }
      openFeederModal(feeder);
      return true;
    }
  }
  return false;
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0].clientX);
  const clientY = e.clientY !== undefined ? e.clientY : (e.changedTouches && e.changedTouches[0].clientY);
  if (clientX === undefined || clientY === undefined) return;

  const x = (clientX - rect.left) * (VIRTUAL_WIDTH / rect.width);
  const y = (clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height);

  if (x < 10 || x > VIRTUAL_WIDTH - 10 || y < 10 || y > VIRTUAL_HEIGHT - 10) return;

  if ((!simStarted || matchEnded) && checkFeederClick(x, y)) return;

  if (cheatsEnabled && currentTool !== 'inspect') {
    handlePointerAction(e);
    return;
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

function handlePointerAction(e) {
  if (!cheatsEnabled && currentTool !== 'inspect') return;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
  if (clientX === undefined || clientY === undefined) return;

  const x = (clientX - rect.left) * (VIRTUAL_WIDTH / rect.width);
  const y = (clientY - rect.top) * (VIRTUAL_HEIGHT / rect.height);

  if (x < 10 || x > VIRTUAL_WIDTH - 10 || y < 10 || y > VIRTUAL_HEIGHT - 10) return;

  if (currentTool === 'food') {
    for (let i = 0; i < 4; i++) foods.push(new Food(x + (Math.random() - 0.5) * 35, y + (Math.random() - 0.5) * 35));
  } else if (currentTool === 'alpha') {
    if (colony.length < CONFIG.maxBacteria) colony.push(new Bacterium(x, y, null, 'alpha', currentAlphaSpecies));
  } else if (currentTool === 'beta') {
    if (colony.length < CONFIG.maxBacteria) colony.push(new Bacterium(x, y, null, 'beta', currentBetaSpecies));
  } else if (currentTool === 'antibiotic') {
    antibiotics.push(new AntibioticZone(x, y));
    playTone('clash');
    showNotification("Внесена зона осквернения");
  }
}

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
  syncSpeciesSlidersUI();
  syncOpponentSelectorLabels();
  setSpeciesConfigLocked(false);

  window.addEventListener('resize', () => {
    resizeCanvases();
    updateChart();
  });

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    initAudio();
    if (cheatsEnabled && (currentTool === 'food' || currentTool === 'antibiotic')) handlePointerAction(e);
  });

  window.addEventListener('mouseup', (e) => {
    if (isMouseDown) {
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) < 8) handleCanvasClick(e);
    }
    isMouseDown = false;
  });
  
  canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown && cheatsEnabled && (currentTool === 'food' || currentTool === 'antibiotic')) handlePointerAction(e);
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); initAudio(); isMouseDown = true;
    const t = e.touches[0];
    pointerDownPos = { x: t.clientX, y: t.clientY };
    if (cheatsEnabled && (currentTool === 'food' || currentTool === 'antibiotic')) handlePointerAction(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isMouseDown && cheatsEnabled && (currentTool === 'food' || currentTool === 'antibiotic')) handlePointerAction(e);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isMouseDown) handleCanvasClick(e);
    isMouseDown = false;
  }, { passive: false });

  if (btnStart) {
    btnStart.addEventListener('click', () => {
      initAudio();
      simStarted = true;
      setSpeciesConfigLocked(true);
      if (startOverlay) {
        startOverlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => startOverlay.classList.add('hidden'), 300);
      }
      setSimulationRunning(true);
      showNotification("Битва началась! Штаммы зафиксированы до конца матча.");
    });
  }

  if (playBtn) playBtn.addEventListener('click', () => setSimulationRunning(!isRunning));

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setSimulationRunning(!isRunning); }
  });

  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      stopVictoryFx();
      simStarted = false;
      matchEnded = false;
      setSpeciesConfigLocked(false);
      initColony();
      syncOpponentSelectorLabels();
      setSimulationRunning(false);
      if (startOverlay) startOverlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
      if (pauseOverlay) pauseOverlay.classList.add('hidden');
      const vModal = document.getElementById('victory-modal');
      if (vModal) vModal.classList.add('hidden');
      showNotification("Арена сброшена к исходному состоянию.");
    });
  }

  const soundBtn = document.getElementById('btn-toggle-sound');
  const soundIcon = document.getElementById('sound-icon');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      initAudio();
      isAudioEnabled = !isAudioEnabled;
      if (isAudioEnabled) {
        if (soundIcon) soundIcon.className = "fa-solid fa-volume-high text-amber-400 text-xs sm:text-sm";
        showNotification("Звуки включены");
      } else {
        if (soundIcon) soundIcon.className = "fa-solid fa-volume-xmark text-slate-400 text-xs sm:text-sm";
        showNotification("Звуки выключены");
      }
    });
  }

  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => {
        b.classList.remove('bg-amber-600/90', 'text-amber-100', 'font-bold');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-amber-600/90', 'text-amber-100', 'font-bold');
      btn.classList.remove('text-slate-400');
      timeScale = parseFloat(btn.dataset.speed);
      showNotification(`Скорость времени: ${timeScale}x`);
    });
  });

  const toggleCheats = document.getElementById('toggle-cheats');
  const cheatToolsGrid = document.getElementById('cheat-tools-grid');
  const toolHint = document.getElementById('tool-hint');
  const toolHintsMap = {
    inspect: "Клик по полю: Пауза / Старт. Клик по бактерии: анализ ТТХ.",
    food: "[ЧИТ] Кликайте или ведите по полю, чтобы вбросить руны биомассы.",
    alpha: "[ЧИТ] Посев бактерий штамма Radiant в указанной точке.",
    beta: "[ЧИТ] Посев бактерий штамма Dire в указанной точке.",
    antibiotic: "[ЧИТ] Создать зону лизиса мембран (осквернение)."
  };

  if (toggleCheats) {
    toggleCheats.addEventListener('change', (e) => {
      cheatsEnabled = e.target.checked;
      if (cheatsEnabled) {
        if (cheatToolsGrid) cheatToolsGrid.classList.remove('opacity-40', 'pointer-events-none');
        showNotification("⚡ Режим читов ВКЛЮЧЕН");
      } else {
        if (cheatToolsGrid) cheatToolsGrid.classList.add('opacity-40', 'pointer-events-none');
        const inspectBtn = document.getElementById('btn-inspect-tool');
        if (inspectBtn) inspectBtn.click();
        showNotification("🔒 Режим читов ВЫКЛЮЧЕН");
      }
    });
  }

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.remove('active', 'border-amber-500', 'bg-amber-500/10', 'text-amber-300');
        b.classList.add('border-slate-800', 'bg-slate-800/40', 'text-slate-300');
      });
      btn.classList.add('active', 'border-amber-500', 'bg-amber-500/10', 'text-amber-300');
      btn.classList.remove('border-slate-800', 'bg-slate-800/40', 'text-slate-300');
      currentTool = btn.dataset.tool;
      if (toolHint) toolHint.innerText = toolHintsMap[currentTool] || "";
    });
  });

  document.querySelectorAll('.tune-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (simStarted) return;
      document.querySelectorAll('.tune-tab-btn').forEach(b => {
        b.classList.remove('bg-amber-600/30', 'text-amber-300', 'font-semibold', 'border', 'border-amber-500/40');
        b.classList.add('text-slate-400');
      });
      btn.classList.add('bg-amber-600/30', 'text-amber-300', 'font-semibold', 'border', 'border-amber-500/40');
      btn.classList.remove('text-slate-400');
      activeTuningSpecies = btn.dataset.tuneSpec;
      syncSpeciesSlidersUI();
    });
  });

  const setupSlider = (id, valId, formatFn, callback) => {
    const slider = document.getElementById(id);
    const valLabel = document.getElementById(valId);
    if (!slider || !valLabel) return;
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valLabel.innerText = formatFn(val);
      callback(val);
    });
  };

  setupSlider('tune-slider-speed', 'tune-val-speed', v => `${v.toFixed(2)}x`, v => { if (!simStarted) SPECIES_CONFIG[activeTuningSpecies].speedBonus = v; });
  setupSlider('tune-slider-damage', 'tune-val-damage', v => `${v.toFixed(2)}x`, v => { if (!simStarted) SPECIES_CONFIG[activeTuningSpecies].damageMult = v; });
  setupSlider('tune-slider-defense', 'tune-val-defense', v => `${Math.round(v * 100)}%`, v => { if (!simStarted) SPECIES_CONFIG[activeTuningSpecies].defenseMult = v; });
  setupSlider('tune-slider-lifespan', 'tune-val-lifespan', v => `${Math.round(v * 100)}%`, v => { if (!simStarted) SPECIES_CONFIG[activeTuningSpecies].lifespanMult = v; });

  setupSlider('slider-lifespan', 'val-lifespan', v => `${v} сек`, v => { CONFIG.lifespanSeconds = v; });
  setupSlider('slider-repro', 'val-repro', v => `${v}%`, v => { CONFIG.reproductionEnergyThreshold = v / 100; });
  setupSlider('slider-feeder-int', 'val-feeder-int', v => `${v.toFixed(1)} сек`, v => { CONFIG.feederInterval = v; });
  setupSlider('slider-damage', 'val-damage', v => `${v.toFixed(1)}x`, v => { CONFIG.combatDamageMultiplier = v; });
  setupSlider('slider-feeder', 'val-feeder', v => v === 0 ? "Выкл" : (v > 5 ? "Обильный" : "Умеренный"), v => { CONFIG.autoFeedRate = v; });

  const btnResetStats = document.getElementById('btn-reset-species-stats');
  if (btnResetStats) {
    btnResetStats.addEventListener('click', () => {
      if (simStarted) return;
      Object.keys(DEFAULT_SPECIES_STATS).forEach(key => {
        SPECIES_CONFIG[key] = JSON.parse(JSON.stringify(DEFAULT_SPECIES_STATS[key]));
      });
      syncSpeciesSlidersUI();
      showNotification("ТТХ видов сброшены к сбалансированным значениям (k=2.20)");
    });
  }

  const btnDefaultParams = document.getElementById('btn-default-params');
  if (btnDefaultParams) {
    btnDefaultParams.addEventListener('click', () => {
      document.getElementById('slider-lifespan').value = 130;
      document.getElementById('val-lifespan').innerText = "130 сек";
      CONFIG.lifespanSeconds = 130;

      document.getElementById('slider-repro').value = 75;
      document.getElementById('val-repro').innerText = "75%";
      CONFIG.reproductionEnergyThreshold = 0.75;

      document.getElementById('slider-feeder-int').value = 4.0;
      document.getElementById('val-feeder-int').innerText = "4.0 сек";
      CONFIG.feederInterval = 4.0;

      document.getElementById('slider-damage').value = 1.8;
      document.getElementById('val-damage').innerText = "1.8x";
      CONFIG.combatDamageMultiplier = 1.8;

      document.getElementById('slider-feeder').value = 3;
      document.getElementById('val-feeder').innerText = "Умеренный";
      CONFIG.autoFeedRate = 3;

      showNotification("Параметры сброшены по умолчанию");
    });
  }

  const btnCloseVict = document.getElementById('btn-close-victory');
  if (btnCloseVict) {
    btnCloseVict.addEventListener('click', () => {
      stopVictoryFx();
      document.getElementById('victory-modal').classList.add('hidden');
      setSpeciesConfigLocked(false);
      showNotification("Вы можете изучить поле, кликнуть по кормушке для смены штамма или нажать «Сброс».");
    });
  }

  const btnNewSim = document.getElementById('btn-new-simulation');
  if (btnNewSim) {
    btnNewSim.addEventListener('click', () => {
      stopVictoryFx();
      document.getElementById('victory-modal').classList.add('hidden');
      simStarted = false;
      matchEnded = false;
      setSpeciesConfigLocked(false);
      initColony();
      syncOpponentSelectorLabels();
      if (btnStart) btnStart.click();
    });
  }

  const victAlpha = document.getElementById('victory-pick-alpha');
  const victBeta = document.getElementById('victory-pick-beta');
  const startAlpha = document.getElementById('start-pick-alpha');
  const startBeta = document.getElementById('start-pick-beta');

  if (victAlpha) victAlpha.addEventListener('click', (e) => { e.stopPropagation(); openFeederModal({ strainType: 'alpha' }); });
  if (victBeta) victBeta.addEventListener('click', (e) => { e.stopPropagation(); openFeederModal({ strainType: 'beta' }); });
  if (startAlpha) startAlpha.addEventListener('click', (e) => { e.stopPropagation(); openFeederModal({ strainType: 'alpha' }); });
  if (startBeta) startBeta.addEventListener('click', (e) => { e.stopPropagation(); openFeederModal({ strainType: 'beta' }); });

  const modalClose = document.getElementById('feeder-modal-close');
  const modalCancel = document.getElementById('btn-modal-cancel');
  if (modalClose) modalClose.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('feeder-modal').classList.add('hidden'); });
  if (modalCancel) modalCancel.addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('feeder-modal').classList.add('hidden'); });

  requestAnimationFrame(animate);
});