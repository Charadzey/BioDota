/* =========================================================================
   BioDota: Интерфейс пользователя, инспектор, графики, модалки и SVG победы
   ========================================================================= */

function showNotification(text) {
  const el = document.getElementById('lab-notification');
  document.getElementById('lab-notification-text').innerText = text;
  el.classList.remove('opacity-0');
  clearTimeout(window._notifTimer);
  window._notifTimer = setTimeout(() => el.classList.add('opacity-0'), 2000);
}

function updateInspectorUI() {
  const emptyEl = document.getElementById('inspector-empty');
  const dataEl = document.getElementById('inspector-data');
  if (!selectedBacterium || selectedBacterium.dead) {
    emptyEl.classList.remove('hidden');
    dataEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  dataEl.classList.remove('hidden');

  const isAlpha = selectedBacterium.strain === 'alpha';
  const strainEl = document.getElementById('insp-strain');
  strainEl.innerText = isAlpha ? "Radiant" : "Dire";
  strainEl.className = isAlpha ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";

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
  bar.style.width = `${energyPct}%`;
  bar.className = `h-full rounded-full transition-all duration-300 ${energyPct > 50 ? (isAlpha ? 'bg-emerald-500' : 'bg-rose-500') : (energyPct > 25 ? 'bg-amber-500' : 'bg-rose-700')}`;

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
  if (mutList.length > 0) {
    mutEl.innerHTML = mutList.join('<br>');
    mutEl.className = "text-amber-300 font-mono text-[9px] leading-tight font-semibold";
  } else {
    mutEl.innerText = "Базовый геном (без мутаций)";
    mutEl.className = "text-slate-400 font-mono text-[9px] leading-tight";
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
  statusEl.innerText = statusText;
  statusEl.className = statusClass;
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
  
  auraEl.style.backgroundColor = glowColor;

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
  quoteEl.innerText = quoteText;
  titleEl.innerText = characterTitle;
}

function updateChart() {
  const chartCanvas = document.getElementById('chartCanvas');
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