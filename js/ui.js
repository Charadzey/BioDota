/* =========================================================================
   BioDota: Интерфейс пользователя, инспектор, графики, модалки и SVG победы
   ========================================================================= */

let victoryParticles = [];
let victoryFxAnimationId = null;

function showNotification(text) {
  const el = document.getElementById('lab-notification');
  if (!el) return;
  document.getElementById('lab-notification-text').innerText = text;
  el.classList.remove('opacity-0');
  clearTimeout(window._notifTimer);
  window._notifTimer = setTimeout(() => el.classList.add('opacity-0'), 2000);
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

function updateInspectorUI() {
  const emptyEl = document.getElementById('inspector-empty');
  const dataEl = document.getElementById('inspector-data');
  if (!emptyEl || !dataEl) return;

  if (!selectedBacterium || selectedBacterium.dead) {
    emptyEl.classList.remove('hidden');
    dataEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  dataEl.classList.remove('hidden');

  const isAlpha = selectedBacterium.strain === 'alpha';
  const strainEl = document.getElementById('insp-strain');
  if (strainEl) {
    strainEl.innerText = isAlpha ? "Radiant" : "Dire";
    strainEl.className = isAlpha ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";
  }

  const speciesEl = document.getElementById('insp-species');
  if (speciesEl) {
    speciesEl.innerText = `${selectedBacterium.spec.badge}`;
    speciesEl.className = isAlpha ? "text-emerald-300 font-bold" : "text-rose-300 font-bold";
  }

  document.getElementById('insp-age').innerText = `${Math.floor(selectedBacterium.age)}с / ${Math.floor(selectedBacterium.lifespan)}с`;
  document.getElementById('insp-kills').innerText = selectedBacterium.kills;

  const energyPct = Math.round(selectedBacterium.energy * 100);
  document.getElementById('insp-energy-text').innerText = `${energyPct}%`;
  const bar = document.getElementById('insp-energy-bar');
  if (bar) {
    bar.style.width = `${energyPct}%`;
    bar.className = `h-full rounded-full transition-all duration-300 ${energyPct > 50 ? (isAlpha ? 'bg-emerald-500' : 'bg-rose-500') : (energyPct > 25 ? 'bg-amber-500' : 'bg-rose-700')}`;
  }

  const mutList = [];
  const m = selectedBacterium.mutations;
  if (m.damageBonus > 0) mutList.push(`⚔️ Урон +${Math.round(m.damageBonus * 100)}%`);
  if (m.defenseBonus > 0) mutList.push(`🛡️ Броня +${Math.round(m.defenseBonus * 100)}%`);
  if (m.speedBonus > 0) mutList.push(`⚡ Скорость +${Math.round(m.speedBonus * 100)}%`);
  if (m.lifespanBonus > 0) mutList.push(`⏳ Срок +${Math.round(m.lifespanBonus * 100)}%`);
  if (selectedBacterium.timeEvoBonus > 0.01) {
    mutList.push(`⏳ Эволюция времени: +${Math.round(selectedBacterium.timeEvoBonus * 100)}%`);
  }
  
  const mutEl = document.getElementById('insp-mutations');
  if (mutEl) {
    if (mutList.length > 0) {
      mutEl.innerHTML = mutList.join('<br>');
      mutEl.className = "text-amber-300 font-mono text-[9px] leading-tight font-semibold";
    } else {
      mutEl.innerText = "Базовый геном (без мутаций)";
      mutEl.className = "text-slate-400 font-mono text-[9px] leading-tight";
    }
  }

  let statusText = "Поиск";
  let statusClass = "text-cyan-400";
  const b = selectedBacterium;

  if (b.inCombat) {
    statusText = "⚔️ В бою!"; statusClass = "text-rose-400 font-bold animate-pulse";
  } else if (b.isDividing) {
    statusText = "🧬 Деление клетки"; statusClass = "text-emerald-300 font-bold";
  } else if (b.currentBehavior === 'guard_defense') {
    statusText = "🛡️ Страж кормушки: отражение атаки на трон!"; statusClass = "text-amber-400 font-bold animate-pulse";
  } else if (b.isFeederGuard) {
    const poleNum = (b.guardPole === 0) ? "Полюс 1" : "Полюс 2";
    statusText = `🛡️ Страж кормушки (${poleNum}): сбор урожая и деление`; statusClass = "text-emerald-300 font-semibold";
  } else if (b.currentBehavior === 'swarm_invasion') {
    statusText = `🚨 Великий поход (${b.groupSize}): Вторжение на базу врага!`; statusClass = "text-amber-300 font-bold animate-pulse";
  } else if (b.currentBehavior === 'swarm_assault_tower') {
    statusText = `🚨 Орда (${b.groupSize}): Сокрушение башни на пути!`; statusClass = "text-purple-400 font-bold animate-pulse";
  } else if (b.currentBehavior === 'swarm_attack_enemy') {
    statusText = `🚨 Орда (${b.groupSize}): Сметание защитников!`; statusClass = "text-rose-400 font-bold animate-pulse";
  } else if (b.currentBehavior === 'flee') {
    statusText = "🏃 Одиночка (избегает боя)"; statusClass = "text-amber-400 font-bold";
  } else if (b.currentBehavior === 'flee_neutral') {
    statusText = "⚠️ Лесной страж силен (обход)"; statusClass = "text-purple-300 font-semibold";
  } else if (b.currentBehavior === 'flee_tower') {
    statusText = "⚠️ Башня опасна (отход)"; statusClass = "text-amber-300 font-semibold";
  } else if (b.currentBehavior === 'forage_group') {
    statusText = `🌾 Стая (${b.groupSize}): тяга к корму`; statusClass = "text-yellow-300 font-semibold";
  } else if (b.currentBehavior === 'forage') {
    statusText = "🌾 Одиночка: тяга к корму"; statusClass = "text-yellow-300 font-semibold";
  } else if (b.currentBehavior === 'attack_enemy') {
    statusText = `⚔️ Стая (${b.groupSize}): атака врагов`; statusClass = "text-rose-400 font-bold";
  } else if (b.currentBehavior === 'attack_neutral') {
    statusText = `🌲 Стая (${b.groupSize}): штурм лагеря (сила > 50% HP)`; statusClass = "text-purple-400 font-bold";
  } else if (b.currentBehavior === 'attack_tower') {
    statusText = `💥 Стая (${b.groupSize}): штурм башни (сила > 50% HP)`; statusClass = "text-purple-400 font-bold";
  } else if (b.currentBehavior === 'push_base') {
    statusText = `🏰 Стая (${b.groupSize}): пожирание кормушки!`; statusClass = "text-amber-400 font-bold";
  } else if (b.currentBehavior === 'seek_allies') {
    statusText = "👥 Одиночка: поиск стаи"; statusClass = "text-cyan-300";
  }

  const statusEl = document.getElementById('insp-status');
  if (statusEl) {
    statusEl.innerText = statusText;
    statusEl.className = statusClass;
  }
}

function syncSpeciesSlidersUI() {
  const spec = SPECIES_CONFIG[activeTuningSpecies];
  const tuneSliderSpeed = document.getElementById('tune-slider-speed');
  const tuneSliderDamage = document.getElementById('tune-slider-damage');
  const tuneSliderDefense = document.getElementById('tune-slider-defense');
  const tuneSliderLifespan = document.getElementById('tune-slider-lifespan');

  const tuneValSpeed = document.getElementById('tune-val-speed');
  const tuneValDamage = document.getElementById('tune-val-damage');
  const tuneValDefense = document.getElementById('tune-val-defense');
  const tuneValLifespan = document.getElementById('tune-val-lifespan');

  if (tuneSliderSpeed) tuneSliderSpeed.value = spec.speedBonus;
  if (tuneSliderDamage) tuneSliderDamage.value = spec.damageMult;
  if (tuneSliderDefense) tuneSliderDefense.value = spec.defenseMult;
  if (tuneSliderLifespan) tuneSliderLifespan.value = spec.lifespanMult;

  if (tuneValSpeed) tuneValSpeed.innerText = `${spec.speedBonus.toFixed(2)}x`;
  if (tuneValDamage) tuneValDamage.innerText = `${spec.damageMult.toFixed(2)}x`;
  if (tuneValDefense) tuneValDefense.innerText = `${Math.round(spec.defenseMult * 100)}%`;
  if (tuneValLifespan) tuneValLifespan.innerText = `${Math.round(spec.lifespanMult * 100)}%`;
}

function syncOpponentSelectorLabels() {
  const alphaSpec = SPECIES_CONFIG[currentAlphaSpecies];
  const betaSpec = SPECIES_CONFIG[currentBetaSpecies];

  const startAlpha = document.getElementById('start-alpha-name');
  const startBeta = document.getElementById('start-beta-name');
  const victAlpha = document.getElementById('victory-alpha-name');
  const victBeta = document.getElementById('victory-beta-name');

  if (startAlpha && alphaSpec) startAlpha.innerText = alphaSpec.badge;
  if (startBeta && betaSpec) startBeta.innerText = betaSpec.badge;
  if (victAlpha && alphaSpec) victAlpha.innerText = alphaSpec.badge;
  if (victBeta && betaSpec) victBeta.innerText = betaSpec.badge;
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
    if (lockBadge) lockBadge.classList.remove('hidden');
    if (lockedNotice) lockedNotice.classList.remove('hidden');
    if (controlsBox) controlsBox.classList.add('opacity-60', 'pointer-events-none');
    if (btnResetStats) btnResetStats.classList.add('opacity-40', 'pointer-events-none');
    sliders.forEach(s => { if (s) s.disabled = true; });
  } else {
    if (lockBadge) lockBadge.classList.add('hidden');
    if (lockedNotice) lockedNotice.classList.add('hidden');
    if (controlsBox) controlsBox.classList.remove('opacity-60', 'pointer-events-none');
    if (btnResetStats) btnResetStats.classList.remove('opacity-40', 'pointer-events-none');
    sliders.forEach(s => { if (s) s.disabled = false; });
  }
}

function renderSpeciesList(strainType) {
  const list = document.getElementById('modal-species-list');
  if (!list) return;
  const currentSelected = (strainType === 'alpha') ? currentAlphaSpecies : currentBetaSpecies;
  list.innerHTML = '';

  Object.values(SPECIES_CONFIG).forEach(spec => {
    const isSelected = (spec.id === currentSelected);
    const btn = document.createElement('div');
    btn.className = `p-2 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
      isSelected 
        ? (strainType === 'alpha' ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-md shadow-emerald-500/20' : 'bg-rose-950/60 border-rose-400 text-white shadow-md shadow-rose-500/20')
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
      if (simStarted && !matchEnded) return;
      if (strainType === 'alpha') currentAlphaSpecies = spec.id;
      else currentBetaSpecies = spec.id;
      
      syncOpponentSelectorLabels();

      const victoryModal = document.getElementById('victory-modal');
      if (victoryModal && !victoryModal.classList.contains('hidden')) {
        const isRadiant = document.getElementById('victory-title').innerText.includes('RADIANT');
        const winningStrain = isRadiant ? 'alpha' : 'beta';
        const winningSpeciesId = isRadiant ? currentAlphaSpecies : currentBetaSpecies;
        renderSlyWinnerBacterium(winningSpeciesId, winningStrain);
      }

      document.getElementById('feeder-modal').classList.add('hidden');
      showNotification(`Для фракции ${strainType === 'alpha' ? 'Radiant' : 'Dire'} установлен вид: ${spec.name}`);
    });

    list.appendChild(btn);
  });
}

function openFeederModal(feeder) {
  if (simStarted && !matchEnded) {
    showNotification("🔒 Выбор вида заблокирован во время матча. Нажмите «Сброс»!");
    return;
  }
  const modal = document.getElementById('feeder-modal');
  const title = document.getElementById('modal-feeder-title');
  const dot = document.getElementById('modal-feeder-dot');
  const isAlpha = feeder.strainType === 'alpha';

  if (title) title.innerText = `Выбор штамма: ${isAlpha ? 'Radiant (Зеленый)' : 'Dire (Красный)'}`;
  if (dot) dot.className = `w-2.5 h-2.5 rounded-full ${isAlpha ? 'bg-emerald-400' : 'bg-rose-400'}`;

  renderSpeciesList(feeder.strainType);
  if (modal) modal.classList.remove('hidden');
}

function renderSlyWinnerBacterium(speciesId, winnerStrain, reason) {
  const container = document.getElementById('sly-character-svg');
  const quoteEl = document.getElementById('sly-character-quote');
  const titleEl = document.getElementById('sly-character-title');
  const auraEl = document.getElementById('sly-character-aura');
  if (!container) return;

  const isRadiant = (winnerStrain === 'alpha');
  const mainColor = isRadiant ? '#34d399' : '#f43f5e';
  const secColor = isRadiant ? '#10b981' : '#e11d48';
  const glowColor = isRadiant ? 'rgba(52, 211, 153, 0.45)' : 'rgba(244, 63, 94, 0.45)';
  
  if (auraEl) auraEl.style.backgroundColor = glowColor;

  let svgHTML = '';
  let quoteText = '';
  let characterTitle = '';

  if (speciesId === 'warrior') {
    characterTitle = isRadiant ? '⚔️ Хитрый Военачальник Radiant' : '⚔️ Хитрый Военачальник Dire';
    quoteText = reason === 'feeder_eaten' 
      ? '«Ха! Мы не просто вас разбили — мы с аппетитом сожрали ваш трон!»' 
      : '«Твой штамм даже не успел понять, отчего лопнули их мембраны!»';

    svgHTML = `
      <svg viewBox="0 0 160 120" class="w-full h-full filter drop-shadow-[0_0_15px_${mainColor}]">
        <defs>
          <linearGradient id="warriorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${mainColor}" />
            <stop offset="50%" stop-color="${secColor}" />
            <stop offset="100%" stop-color="#0f172a" />
          </linearGradient>
        </defs>
        <path d="M 28 60 Q 15 45 22 25" stroke="${mainColor}" stroke-width="3" fill="none" stroke-linecap="round" />
        <path d="M 30 70 Q 10 75 16 95" stroke="${mainColor}" stroke-width="3" fill="none" stroke-linecap="round" />
        <rect x="36" y="32" width="88" height="56" rx="28" fill="url(#warriorGrad)" stroke="#fbbf24" stroke-width="2.5" />
        <path d="M 40 45 Q 80 40 120 45" stroke="#334155" stroke-width="6" fill="none" />
        <polygon points="76,33 84,33 80,24" fill="#fbbf24" />
        <path d="M 98 34 L 108 58" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
        <path d="M 56 54 Q 66 48 74 54" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" />
        <circle cx="103" cy="51" r="7.5" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5" />
        <ellipse cx="104" cy="51" rx="2.5" ry="5.5" fill="#0f172a" />
        <circle cx="106" cy="48" r="1.5" fill="#ffffff" />
        <path d="M 64 69 Q 82 82 102 68" stroke="#0f172a" stroke-width="3" fill="#881337" />
        <polygon points="94,69 98,76 102,69" fill="#ffffff" />
        <g transform="translate(118, 55)">
          <path d="M 0 5 Q 12 12 24 2" stroke="${mainColor}" stroke-width="3.5" fill="none" />
          <polygon points="20,-12 38,-3 20,4 23,-3" fill="#38bdf8" stroke="#ffffff" stroke-width="1.2" class="animate-pulse" />
          <circle cx="38" cy="-3" r="3" fill="#fde047" class="animate-sly-glint" />
        </g>
      </svg>`;
  } else if (speciesId === 'forager') {
    characterTitle = isRadiant ? '🌾 Ловкий Вор Биомассы Radiant' : '🌾 Ловкий Вор Биомассы Dire';
    quoteText = reason === 'feeder_eaten'
      ? '«Я просто лакомился рунами, а потом случайно сгрыз весь ваш трон целиком!»'
      : '«Пока вы гонялись за фрагами, я тихо сожрал все ресурсы на арене!»';

    svgHTML = `
      <svg viewBox="0 0 160 120" class="w-full h-full filter drop-shadow-[0_0_15px_${mainColor}]">
        <defs>
          <linearGradient id="foragerGrad" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="50%" stop-color="${mainColor}" />
            <stop offset="100%" stop-color="#047857" />
          </linearGradient>
        </defs>
        <path d="M 20 85 Q 40 40 70 70 T 120 50" stroke="url(#foragerGrad)" stroke-width="26" stroke-linecap="round" fill="none" />
        <path d="M 120 50 Q 135 45 142 35" stroke="${mainColor}" stroke-width="14" stroke-linecap="round" fill="none" />
        <path d="M 68 56 Q 96 46 122 52" stroke="#0f172a" stroke-width="14" stroke-linecap="round" fill="none" />
        <path d="M 78 55 Q 86 49 92 56" stroke="#f8fafc" stroke-width="3" fill="none" stroke-linecap="round" />
        <circle cx="110" cy="52" r="5" fill="#fde047" />
        <circle cx="111" cy="51" r="2.5" fill="#0f172a" />
        <circle cx="112" cy="49" r="1.2" fill="#ffffff" />
        <path d="M 88 68 Q 98 75 108 67" stroke="#0f172a" stroke-width="2.5" fill="none" />
        <path d="M 97 70 Q 101 80 106 72" fill="#f43f5e" stroke="#881337" stroke-width="1.2" />
        <g transform="translate(42, 62)">
          <circle cx="12" cy="12" r="14" fill="#fbbf24" stroke="#f59e0b" stroke-width="2" class="animate-sly-spores text-amber-400" />
          <polygon points="12,4 18,12 12,20 6,12" fill="#fef08a" />
          <circle cx="18" cy="6" r="2.5" fill="#ffffff" class="animate-sly-glint" />
        </g>
      </svg>`;
  } else if (speciesId === 'tank') {
    characterTitle = isRadiant ? '🛡️ Неуязвимый Авторитет Radiant' : '🛡️ Неуязвимый Авторитет Dire';
    quoteText = reason === 'feeder_eaten'
      ? '«Вы ковыряли мою броню, пока я методично продавливал вашу базу!»'
      : '«Били-били — не пробили! Вы лишь слегка почесали мою мембрану, салаги.»';

    svgHTML = `
      <svg viewBox="0 0 160 120" class="w-full h-full filter drop-shadow-[0_0_15px_${mainColor}]">
        <defs>
          <radialGradient id="tankGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#94a3b8" />
            <stop offset="50%" stop-color="${secColor}" />
            <stop offset="100%" stop-color="#020617" />
          </radialGradient>
        </defs>
        <circle cx="80" cy="60" r="42" fill="url(#tankGrad)" stroke="#e2e8f0" stroke-width="3" />
        <circle cx="50" cy="35" r="2.5" fill="#cbd5e1" stroke="#334155" stroke-width="1" />
        <circle cx="110" cy="35" r="2.5" fill="#cbd5e1" stroke="#334155" stroke-width="1" />
        <circle cx="44" cy="72" r="2.5" fill="#cbd5e1" stroke="#334155" stroke-width="1" />
        <circle cx="116" cy="72" r="2.5" fill="#cbd5e1" stroke="#334155" stroke-width="1" />
        <g transform="translate(52, 44)">
          <polygon points="0,4 24,0 26,14 2,16" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.5" />
          <polygon points="30,0 54,4 52,16 28,14" fill="#0f172a" stroke="#e2e8f0" stroke-width="1.5" />
          <line x1="24" y1="5" x2="30" y2="5" stroke="#e2e8f0" stroke-width="2" />
          <line x1="5" y1="6" x2="16" y2="12" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
          <line x1="35" y1="6" x2="46" y2="12" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" />
        </g>
        <path d="M 62 76 Q 80 88 100 76" stroke="#0f172a" stroke-width="3.5" fill="#450a0a" />
        <rect x="74" y="77" width="6" height="6" fill="#fbbf24" stroke="#ca8a04" stroke-width="1" />
        <polygon points="77,75 79,73 81,75 79,77" fill="#ffffff" class="animate-sly-glint" />
        <g transform="translate(98, 73) rotate(-15)">
          <rect x="0" y="0" width="18" height="5" rx="1.5" fill="#78350f" stroke="#451a03" stroke-width="0.8" />
          <rect x="15" y="0" width="3" height="5" fill="#ef4444" class="animate-pulse" />
          <circle cx="24" cy="-4" r="3" fill="#94a3b8" class="animate-sly-smoke" />
        </g>
      </svg>`;
  } else {
    characterTitle = isRadiant ? '☣️ Коварный Токсичный Гений Radiant' : '☣️ Коварный Токсичный Гений Dire';
    quoteText = reason === 'feeder_eaten'
      ? '«Мои токсины разъели вашу цитадель до последнего пептида!»'
      : '«Один микрограмм моего фермента — и ваша культура превратилась в суп!»';

    svgHTML = `
      <svg viewBox="0 0 160 120" class="w-full h-full filter drop-shadow-[0_0_8px_#c084fc]">
        <defs>
          <linearGradient id="toxicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#a855f7" />
            <stop offset="50%" stop-color="#6b21a8" />
            <stop offset="100%" stop-color="#090514" />
          </linearGradient>
        </defs>
        <circle cx="46" cy="36" r="6" fill="#22c55e" class="animate-sly-spores text-emerald-400" />
        <circle cx="118" cy="38" r="7" fill="#c084fc" class="animate-sly-spores text-purple-400" />
        <circle cx="34" cy="74" r="5" fill="#a855f7" />
        <circle cx="126" cy="76" r="5" fill="#22c55e" />
        <path d="M 44 48 C 65 30 105 32 120 56 C 110 88 65 92 44 74 C 36 66 36 56 44 48 Z" fill="url(#toxicGrad)" stroke="#4ade80" stroke-width="2.5" />
        <path d="M 54 44 L 72 49" stroke="#4ade80" stroke-width="3" stroke-linecap="round" />
        <path d="M 106 44 L 88 49" stroke="#4ade80" stroke-width="3" stroke-linecap="round" />
        <ellipse cx="66" cy="54" rx="7.5" ry="6" fill="#4ade80" />
        <ellipse cx="66" cy="54" rx="2" ry="5.5" fill="#052e16" />
        <ellipse cx="94" cy="54" rx="7.5" ry="6" fill="#4ade80" />
        <ellipse cx="94" cy="54" rx="2" ry="5.5" fill="#052e16" />
        <path d="M 52 68 Q 80 92 110 68 Q 80 78 52 68 Z" fill="#22c55e" stroke="#14532d" stroke-width="1.5" />
        <line x1="62" y1="71" x2="65" y2="76" stroke="#ffffff" stroke-width="2" />
        <line x1="72" y1="73" x2="74" y2="79" stroke="#ffffff" stroke-width="2" />
        <line x1="80" y1="74" x2="80" y2="80" stroke="#ffffff" stroke-width="2" />
        <line x1="88" y1="73" x2="86" y2="79" stroke="#ffffff" stroke-width="2" />
        <line x1="98" y1="71" x2="95" y2="76" stroke="#ffffff" stroke-width="2" />
        <circle cx="112" cy="74" r="2.5" fill="#4ade80" class="animate-bounce" />
      </svg>`;
  }

  container.innerHTML = svgHTML;
  if (quoteEl) quoteEl.innerText = quoteText;
  if (titleEl) titleEl.innerText = characterTitle;
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
  if (victoryFxAnimationId) { cancelAnimationFrame(victoryFxAnimationId); victoryFxAnimationId = null; }
  const victoryFxCanvas = document.getElementById('victoryFxCanvas');
  if (victoryFxCanvas) {
    const ctx = victoryFxCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, victoryFxCanvas.width, victoryFxCanvas.height);
  }
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

function drawVictoryChart() {
  const victoryChartCanvas = document.getElementById('victoryChartCanvas');
  if (!victoryChartCanvas) return;
  const victoryChartCtx = victoryChartCanvas.getContext('2d');
  const rect = victoryChartCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = rect.width > 0 ? rect.width : 400;
  const h = rect.height > 0 ? rect.height : 110;

  victoryChartCanvas.width = Math.round(w * dpr);
  victoryChartCanvas.height = Math.round(h * dpr);

  victoryChartCtx.setTransform(1, 0, 0, 1, 0, 0);
  victoryChartCtx.scale(dpr, dpr);
  victoryChartCtx.clearRect(0, 0, w, h);

  victoryChartCtx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
  victoryChartCtx.lineWidth = 1;
  victoryChartCtx.beginPath();
  for (let y = 0; y < h; y += h / 3) {
    victoryChartCtx.moveTo(0, y);
    victoryChartCtx.lineTo(w, y);
  }
  victoryChartCtx.stroke();

  const alphaData = fullMatchHistory.alpha.length < 2 ? [fullMatchHistory.alpha[0] || 16, fullMatchHistory.alpha[0] || 16] : fullMatchHistory.alpha;
  const betaData = fullMatchHistory.beta.length < 2 ? [fullMatchHistory.beta[0] || 16, fullMatchHistory.beta[0] || 16] : fullMatchHistory.beta;
  const len = alphaData.length;
  const maxVal = Math.max(30, ...alphaData, ...betaData);

  victoryChartCtx.beginPath();
  alphaData.forEach((val, idx) => {
    const x = (idx / (len - 1)) * w;
    const y = h - (val / maxVal) * (h - 16) - 8;
    if (idx === 0) victoryChartCtx.moveTo(x, y);
    else victoryChartCtx.lineTo(x, y);
  });
  victoryChartCtx.strokeStyle = '#10b981';
  victoryChartCtx.lineWidth = 3;
  victoryChartCtx.stroke();

  victoryChartCtx.beginPath();
  betaData.forEach((val, idx) => {
    const x = (idx / (len - 1)) * w;
    const y = h - (val / maxVal) * (h - 16) - 8;
    if (idx === 0) victoryChartCtx.moveTo(x, y);
    else victoryChartCtx.lineTo(x, y);
  });
  victoryChartCtx.strokeStyle = '#f43f5e';
  victoryChartCtx.lineWidth = 3;
  victoryChartCtx.stroke();
}

function updateChart() {
  const chartCanvas = document.getElementById('chartCanvas');
  if (!chartCanvas) return;
  const chartCtx = chartCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = chartCanvas.width / dpr;
  const h = chartCanvas.height / dpr;

  chartCtx.clearRect(0, 0, w, h);
  chartCtx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  for (let y = 0; y < h; y += h / 3) {
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(w, y);
  }
  chartCtx.stroke();

  if (chartHistory.alpha.length < 2) return;
  const maxVal = Math.max(30, ...chartHistory.alpha, ...chartHistory.beta);

  chartCtx.beginPath();
  chartHistory.alpha.forEach((val, idx) => {
    const x = (idx / (chartHistory.capacity - 1)) * w;
    const y = h - (val / maxVal) * (h - 10) - 5;
    if (idx === 0) chartCtx.moveTo(x, y); else chartCtx.lineTo(x, y);
  });
  chartCtx.strokeStyle = '#10b981';
  chartCtx.lineWidth = 2;
  chartCtx.stroke();

  chartCtx.beginPath();
  chartHistory.beta.forEach((val, idx) => {
    const x = (idx / (chartHistory.capacity - 1)) * w;
    const y = h - (val / maxVal) * (h - 10) - 5;
    if (idx === 0) chartCtx.moveTo(x, y); else chartCtx.lineTo(x, y);
  });
  chartCtx.strokeStyle = '#f43f5e';
  chartCtx.lineWidth = 2;
  chartCtx.stroke();
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