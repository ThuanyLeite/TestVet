/* ============================================================
   PetCare Monitor — script.js
   Monitorização de saúde para cães e gatos
   ============================================================ */

'use strict';

/* ── Storage helpers ── */
const DB = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k)
};

/* ── Veterinary data ── */
const VET_DATA = {
  dog: {
    lifeStages: [
      { name: 'Filhote', emoji: '🐾', badge: 'badge-puppy', from: 0, to: 0.5, desc: 'Período de socialização e vacinações essenciais. Alimentação 3-4x/dia com ração específica para filhotes.' },
      { name: 'Júnior', emoji: '🌱', badge: 'badge-junior', from: 0.5, to: 1, desc: 'Fase de crescimento acelerado. Manter vacinações em dia e iniciar treino básico.' },
      { name: 'Adulto', emoji: '💪', badge: 'badge-adult', from: 1, to: 7, desc: 'Fase mais estável. Exames anuais, vacinações de reforço e controlo de parasitas.' },
      { name: 'Maduro', emoji: '🍂', badge: 'badge-mature', from: 7, to: 10, desc: 'Início de transição para sénior. Consultas semestrais recomendadas. Monitorizar peso.' },
      { name: 'Sénior', emoji: '🌟', badge: 'badge-senior', from: 10, to: 14, desc: 'Período sénior. Dieta especial, exercício moderado, exames de sangue anuais essenciais.' },
      { name: 'Geriátrico', emoji: '👴', badge: 'badge-geriatric', from: 14, to: 999, desc: 'Cuidados intensivos recomendados. Atenção a artrite, perda de visão/audição e incontinência.' }
    ],
    smallBreed: { seniorAge: 10, maxAge: 18 },
    mediumBreed: { seniorAge: 9, maxAge: 15 },
    largeBreed: { seniorAge: 8, maxAge: 13 },
    giantBreed: { seniorAge: 6, maxAge: 11 },
    waterMl: (kg) => Math.round(60 * kg),
    dailyFeedings: { puppy: 4, junior: 3, adult: 2, senior: 3 },
    foodGrams: (kg, stage) => {
      const base = 20 + kg * 30;
      if (stage === 'Sénior' || stage === 'Geriátrico') return Math.round(base * 0.85);
      if (stage === 'Filhote') return Math.round(base * 1.4);
      return Math.round(base);
    }
  },
  cat: {
    lifeStages: [
      { name: 'Filhote', emoji: '🐾', badge: 'badge-puppy', from: 0, to: 0.5, desc: 'Socialização crítica. Vacinações obrigatórias. Amamentação ou leite para gatinhos.' },
      { name: 'Júnior', emoji: '🌱', badge: 'badge-junior', from: 0.5, to: 2, desc: 'Crescimento e desenvolvimento. Considerar castração entre 4-6 meses.' },
      { name: 'Adulto', emoji: '💪', badge: 'badge-adult', from: 2, to: 7, desc: 'Fase estável. Manter ração de qualidade, exercício e enriquecimento ambiental.' },
      { name: 'Maduro', emoji: '🍂', badge: 'badge-mature', from: 7, to: 11, desc: 'Equivalente a 44-60 anos humanos. Atenção ao peso e saúde dentária.' },
      { name: 'Sénior', emoji: '🌟', badge: 'badge-senior', from: 11, to: 15, desc: 'Consultas semestrais essenciais. Risco aumentado de doenças renais e hipertiroidismo.' },
      { name: 'Geriátrico', emoji: '👴', badge: 'badge-geriatric', from: 15, to: 999, desc: 'Monitorização constante. Exames regulares de sangue e urina altamente recomendados.' }
    ],
    waterMl: (kg) => Math.round(50 * kg),
    dailyFeedings: { kitten: 4, junior: 3, adult: 2, senior: 3 },
    foodGrams: (kg, stage) => {
      const base = 15 + kg * 22;
      if (stage === 'Sénior' || stage === 'Geriátrico') return Math.round(base * 0.9);
      if (stage === 'Filhote') return Math.round(base * 1.5);
      return Math.round(base);
    }
  }
};

/* ── Stool/Vomit assessment ── */
const HEALTH_ALERTS = {
  fecesColors: [
    { color: '#8B4513', label: 'Castanho normal', risk: 'low', msg: 'Cor normal — tudo bem! ✓' },
    { color: '#A0522D', label: 'Castanho claro', risk: 'low', msg: 'Normal. Pode indicar dieta alta em fibras.' },
    { color: '#556B2F', label: 'Esverdeado', risk: 'medium', msg: 'Pode indicar ingestão de erva em excesso ou infecção. Observar.' },
    { color: '#FF6347', label: 'Avermelhado', risk: 'high', msg: '⚠️ Sangue vermelho vivo — consulte o veterinário urgentemente!' },
    { color: '#1C1C1C', label: 'Preto/Alcatrão', risk: 'high', msg: '⚠️ Possível hemorragia interna! Consulta veterinária URGENTE.' },
    { color: '#FFFACD', label: 'Amarelo/Bege', risk: 'medium', msg: 'Pode indicar problema no fígado ou pâncreas. Monitore e consulte.' },
    { color: '#FF69B4', label: 'Rosado', risk: 'high', msg: '⚠️ Sangue — consulte o veterinário o mais brevemente possível.' }
  ],
  fecesConsistency: [
    { id: 'pellets', label: 'Bolinhas/Pellets', risk: 'medium', msg: 'Fezes duras — possível desidratação. Aumentar ingestão de água.' },
    { id: 'firm', label: 'Firmes/Normal', risk: 'low', msg: 'Consistência ideal! ✓' },
    { id: 'soft', label: 'Moles/Pastosas', risk: 'medium', msg: 'Fezes moles — pode ser mudança de dieta ou stress. Observe por 24h.' },
    { id: 'liquid', label: 'Líquidas/Diarreia', risk: 'high', msg: '⚠️ Diarreia — assegure hidratação. Se persistir >24h, consulte veterinário.' },
    { id: 'blood', label: 'Com sangue', risk: 'high', msg: '🚨 Sangue nas fezes — consulta veterinária URGENTE.' },
    { id: 'mucus', label: 'Com muco', risk: 'medium', msg: 'Muco nas fezes pode indicar inflamação intestinal. Monitore.' }
  ],
  vomitColors: [
    { color: '#F5F5DC', label: 'Espuma branca', risk: 'medium', msg: 'Pode indicar estômago vazio ou refluxo. Se recorrente, consulte.' },
    { color: '#FFFF00', label: 'Amarelo/Bile', risk: 'medium', msg: 'Vómito bilioso — comum em jejum prolongado. Ajuste horários.' },
    { color: '#228B22', label: 'Verde', risk: 'high', msg: '⚠️ Possível ingestão de veneno ou obstrução. Consulte urgentemente.' },
    { color: '#FF6347', label: 'Sangue vivo', risk: 'high', msg: '🚨 Sangue no vómito — emergência veterinária IMEDIATA.' },
    { color: '#8B4513', label: 'Castanho', risk: 'high', msg: '🚨 Vómito castanho pode indicar obstrução intestinal. URGENTE.' },
    { color: '#D2691E', label: 'Comida não digerida', risk: 'low', msg: 'Comum se comeu muito rápido. Tente alimentação mais lenta.' }
  ]
};

/* ── App State ── */
let state = {
  pets: DB.get('petcare_pets') || [],
  logs: DB.get('petcare_logs') || {},
  activePetId: DB.get('petcare_active') || null,
  currentScreen: 'home'
};

/* ── Save state ── */
function saveState() {
  DB.set('petcare_pets', state.pets);
  DB.set('petcare_logs', state.logs);
  DB.set('petcare_active', state.activePetId);
}

/* ── Utils ── */
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function today() { return new Date().toISOString().split('T')[0]; }

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function ageLabel(years) {
  if (years < 1) return Math.round(years * 12) + ' meses';
  if (years === 1) return '1 ano';
  return years + ' anos';
}

function getLifeStage(pet) {
  const stages = VET_DATA[pet.type]?.lifeStages || [];
  return stages.find(s => pet.age >= s.from && pet.age < s.to) || stages[stages.length - 1];
}

function getRecommendations(pet) {
  const stage = getLifeStage(pet);
  const data = VET_DATA[pet.type];
  const waterMl = data.waterMl ? data.waterMl(pet.weight || 5) : 250;
  const foodG = data.foodGrams ? data.foodGrams(pet.weight || 5, stage.name) : 100;
  return { stage, waterMl, foodG };
}

function getOrCreateLog(petId, date) {
  if (!state.logs[petId]) state.logs[petId] = {};
  if (!state.logs[petId][date]) {
    state.logs[petId][date] = {
      date,
      water: { glasses: 0, notes: '' },
      food: { ate: null, type: '', notes: '', feedingCount: 0 },
      feces: { occurred: null, consistency: '', color: '', notes: '' },
      vomit: { occurred: false, count: 0, color: '', notes: '' },
      meds: [],
      mood: '',
      activity: '',
      weight: null,
      seniorCheck: {},
      generalNotes: ''
    };
  }
  return state.logs[petId][date];
}

function getActivePet() {
  return state.pets.find(p => p.id === state.activePetId) || state.pets[0] || null;
}

/* ── Toast notifications ── */
function showToast(msg, duration = 2500) {
  const wrap = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 350);
  }, duration);
}

/* ── Navigation ── */
function navigate(screen, petId) {
  if (petId) state.activePetId = petId;
  state.currentScreen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + screen);
  if (target) target.classList.add('active');
  // Tab bar
  document.querySelectorAll('.tab-item').forEach(t => {
    t.classList.toggle('active', t.dataset.screen === screen);
  });
  document.querySelectorAll('.desktop-nav-link').forEach(t => {
    t.classList.toggle('active', t.dataset.screen === screen);
  });
  // Render
  if (screen === 'home') renderHome();
  if (screen === 'daily') renderDaily();
  if (screen === 'profile') renderProfile();
  if (screen === 'history') renderHistory();
  window.scrollTo(0, 0);
}

/* ─────────────────────────────────────────────
   RENDER: HOME
───────────────────────────────────────────── */
function renderHome() {
  const el = document.getElementById('home-pets-grid');
  if (!el) return;

  if (state.pets.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <img src="images/add-pet.svg" alt="" style="width:80px;height:80px;margin:0 auto 1rem;display:block;opacity:.35">
        <h3>Nenhum pet adicionado</h3>
        <p>Clique em "Adicionar Pet" para começar a monitorizar o seu animal.</p>
        <button class="btn-primary btn-sm" style="margin-top:1rem" onclick="openAddPetModal()">
          + Adicionar Pet
        </button>
      </div>`;
    return;
  }

  el.innerHTML = state.pets.map(pet => {
    const { stage } = getRecommendations(pet);
    const avatarHtml = pet.photo
      ? `<img src="${pet.photo}" alt="${pet.name}">`
      : `<img src="images/${pet.type}.svg" alt="${pet.type}" style="width:48px;height:48px;padding:8px">`;
    return `
      <div class="pet-card ${state.activePetId === pet.id ? 'selected' : ''}" onclick="selectAndGo('${pet.id}')">
        <div class="pet-card-avatar">${avatarHtml}</div>
        <div class="pet-card-name">${pet.name}</div>
        <div class="pet-card-info">${pet.breed || 'Sem raça definida'} · ${ageLabel(pet.age)}</div>
        <div class="pet-stage-badge ${stage.badge}">${stage.emoji} ${stage.name}</div>
      </div>`;
  }).join('') + `
    <div class="add-pet-card" onclick="openAddPetModal()">
      <img src="images/add-pet.svg" alt="Adicionar" style="width:40px;height:40px;margin-bottom:.5rem;color:inherit">
      <span style="font-size:.85rem;font-weight:600">Adicionar Pet</span>
    </div>`;

  // Today summary for active pet
  renderHomeSummary();
}

function selectAndGo(petId) {
  state.activePetId = petId;
  saveState();
  navigate('daily');
}

function renderHomeSummary() {
  const pet = getActivePet();
  const sumEl = document.getElementById('home-today-summary');
  if (!sumEl || !pet) return;
  const log = getOrCreateLog(pet.id, today());
  const { waterMl } = getRecommendations(pet);
  const waterPct = Math.min(100, Math.round((log.water.glasses * (waterMl / 8)) / waterMl * 100));

  sumEl.innerHTML = `
    <div class="card-section">
      <div class="card-section-title">
        <img src="images/health.svg" style="width:20px;height:20px"> Resumo de Hoje — ${pet.name}
      </div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">💧 Água</div>
          <div class="stat-value">${log.water.glasses}<span class="stat-unit"> copos</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-label">🍽️ Alimentação</div>
          <div class="stat-value" style="font-size:1rem">${log.food.ate === true ? '✅ Comeu' : log.food.ate === false ? '❌ Recusou' : '— Não registado'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">💩 Fezes</div>
          <div class="stat-value" style="font-size:1rem">${log.feces.occurred === true ? '✅ Normal' : log.feces.occurred === false ? '❌ Não defecou' : '— Não registado'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">🤢 Vómito</div>
          <div class="stat-value" style="font-size:1rem">${log.vomit.occurred ? `⚠️ ${log.vomit.count}x` : '✅ Nenhum'}</div>
        </div>
      </div>
      <button class="btn-primary btn-full" onclick="navigate('daily')">
        📝 Registar Dia de Hoje
      </button>
    </div>`;
}

/* ─────────────────────────────────────────────
   RENDER: DAILY LOG
───────────────────────────────────────────── */
function renderDaily() {
  const pet = getActivePet();
  const el = document.getElementById('daily-content');
  if (!el) return;

  if (!pet) {
    el.innerHTML = `<div class="empty-state"><h3>Nenhum pet selecionado</h3><button class="btn-primary" onclick="openAddPetModal()">Adicionar Pet</button></div>`;
    return;
  }

  const log = getOrCreateLog(pet.id, today());
  const { stage, waterMl, foodG } = getRecommendations(pet);
  const isSenior = stage.name === 'Sénior' || stage.name === 'Geriátrico';

  el.innerHTML = `
    <div class="daily-header">
      <div class="daily-date">${formatDate(today())}</div>
      <div class="daily-pet-name">${pet.name} ${stage.emoji}</div>
      <div class="daily-subtitle">${stage.name} · ${ageLabel(pet.age)} · ${pet.weight || '?'} kg</div>
    </div>

    ${renderStageAlert(stage, pet)}

    <!-- ÁGUA -->
    <div class="card-section">
      <div class="card-section-title"><img src="images/water.svg" style="width:22px;height:22px"> Ingestão de Água</div>
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem">Consumo recomendado: <strong>${waterMl} ml/dia</strong> (≈ ${Math.ceil(waterMl / 250)} copos de 250ml)</p>

      <div style="margin-bottom:.75rem">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem">
          <span style="font-size:.85rem;font-weight:600">Copos bebidos (250ml cada)</span>
          <span style="font-size:1.1rem;font-weight:700;color:var(--blue)">${log.water.glasses} / ${Math.ceil(waterMl / 250)}</span>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <button class="btn-secondary btn-sm" onclick="adjustWater(-1)">−</button>
          <div style="flex:1;height:10px;background:var(--bg2);border-radius:99px;overflow:hidden">
            <div style="height:100%;width:${Math.min(100, Math.round(log.water.glasses / Math.ceil(waterMl / 250) * 100))}%;background:linear-gradient(90deg,#60a5fa,#3b82f6);border-radius:99px;transition:width .4s"></div>
          </div>
          <button class="btn-primary btn-sm" onclick="adjustWater(1)">+</button>
        </div>
      </div>

      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
        <button class="toggle-btn ${log.water.urineCount >= 1 ? 'active' : ''}" onclick="toggleWaterUrine(1)">🚽 1x urinou</button>
        <button class="toggle-btn ${log.water.urineCount >= 2 ? 'active' : ''}" onclick="toggleWaterUrine(2)">🚽 2x urinou</button>
        <button class="toggle-btn ${log.water.urineCount >= 3 ? 'active' : ''}" onclick="toggleWaterUrine(3)">🚽 3x+ urinou</button>
      </div>

      <textarea class="form-control" rows="2" placeholder="Observações sobre água/urina..." onchange="updateLogField('water','notes',this.value)">${log.water.notes || ''}</textarea>
    </div>

    <!-- ALIMENTAÇÃO -->
    <div class="card-section">
      <div class="card-section-title"><img src="images/food.svg" style="width:22px;height:22px"> Alimentação</div>
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem">Quantidade recomendada: <strong>≈ ${foodG}g/dia</strong></p>

      <div class="form-group">
        <label class="form-label">Comeu hoje?</label>
        <div class="toggle-group">
          <button class="toggle-btn ${log.food.ate === true ? 'active' : ''}" onclick="setFoodAte(true)">✅ Comeu tudo</button>
          <button class="toggle-btn ${log.food.ate === 'partial' ? 'active' : ''}" onclick="setFoodAte('partial')">🍽️ Comeu parte</button>
          <button class="toggle-btn ${log.food.ate === false ? 'active' : ''}" onclick="setFoodAte(false)">❌ Recusou</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Tipo de alimentação</label>
        <div class="toggle-group">
          <button class="toggle-btn ${log.food.foodType === 'dry' ? 'active' : ''}" onclick="setFoodType('dry')">🥜 Ração seca</button>
          <button class="toggle-btn ${log.food.foodType === 'wet' ? 'active' : ''}" onclick="setFoodType('wet')">🥫 Comida húmida</button>
          <button class="toggle-btn ${log.food.foodType === 'mixed' ? 'active' : ''}" onclick="setFoodType('mixed')">🍱 Misto</button>
          <button class="toggle-btn ${log.food.foodType === 'raw' ? 'active' : ''}" onclick="setFoodType('raw')">🥩 BARF/Natural</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Marca/Ração específica</label>
        <input class="form-control" type="text" placeholder="Ex: Royal Canin Adult, Hills Science..." value="${log.food.brand || pet.defaultFood || ''}" onchange="updateLogField('food','brand',this.value);updatePetDefault('defaultFood',this.value)">
      </div>

      <div class="form-group">
        <label class="form-label">Modo de alimentação</label>
        <div class="toggle-group">
          <button class="toggle-btn ${log.food.mode === 'scheduled' ? 'active' : ''}" onclick="setFoodMode('scheduled')">⏰ Horário fixo</button>
          <button class="toggle-btn ${log.food.mode === 'free' ? 'active' : ''}" onclick="setFoodMode('free')">🍽️ Comida livre</button>
        </div>
      </div>

      ${log.food.mode === 'scheduled' ? `
      <div class="form-group">
        <label class="form-label">Nº de refeições hoje</label>
        <div style="display:flex;gap:.5rem;align-items:center">
          <button class="btn-secondary btn-sm" onclick="adjustFeedings(-1)">−</button>
          <span style="font-size:1.2rem;font-weight:700;padding:0 .75rem">${log.food.feedingCount || 0}</span>
          <button class="btn-primary btn-sm" onclick="adjustFeedings(1)">+</button>
        </div>
      </div>` : ''}

      <textarea class="form-control" rows="2" placeholder="Observações sobre alimentação..." onchange="updateLogField('food','notes',this.value)">${log.food.notes || ''}</textarea>
    </div>

    <!-- FEZES -->
    <div class="card-section">
      <div class="card-section-title"><img src="images/poop.svg" style="width:22px;height:22px"> Fezes / Digestão</div>

      <div class="form-group">
        <label class="form-label">Defecou hoje?</label>
        <div class="toggle-group">
          <button class="toggle-btn ${log.feces.occurred === true ? 'active' : ''}" onclick="setFeces('occurred',true)">✅ Sim</button>
          <button class="toggle-btn ${log.feces.occurred === false ? 'active' : ''}" onclick="setFeces('occurred',false)">❌ Não</button>
        </div>
      </div>

      ${log.feces.occurred === true ? `
      <div class="form-group">
        <label class="form-label">Consistência</label>
        <div class="toggle-group">
          ${HEALTH_ALERTS.fecesConsistency.map(c => `
            <button class="toggle-btn ${log.feces.consistency === c.id ? 'active' : ''}" onclick="setFeces('consistency','${c.id}')">${c.label}</button>
          `).join('')}
        </div>
        ${log.feces.consistency ? renderFecesAlert(log.feces.consistency) : ''}
      </div>

      <div class="form-group">
        <label class="form-label">Cor das fezes</label>
        <div class="color-grid">
          ${HEALTH_ALERTS.fecesColors.map((c, i) => `
            <div class="color-swatch ${log.feces.colorIndex === i ? 'selected' : ''}"
              style="background:${c.color}"
              title="${c.label}"
              onclick="setFecesColor(${i})"></div>
          `).join('')}
        </div>
        ${log.feces.colorIndex !== undefined ? `<p style="font-size:.8rem;margin-top:.4rem;color:var(--text-muted)">${HEALTH_ALERTS.fecesColors[log.feces.colorIndex].label}</p>` : ''}
        ${log.feces.colorIndex !== undefined ? renderColorAlert('feces', log.feces.colorIndex) : ''}
      </div>` : ''}

      ${log.feces.occurred === false ? `
      <div class="alert-banner warning">
        <img src="images/warning.svg" style="width:20px;height:20px;flex-shrink:0">
        <div><strong>Sem defecação hoje</strong><p>Se o animal não defecar por mais de 48h (cão) ou 24-36h (gato), consulte um veterinário. Pode indicar obstipação ou obstrução.</p></div>
      </div>` : ''}

      <textarea class="form-control" rows="2" placeholder="Observações sobre fezes..." onchange="updateLogField('feces','notes',this.value)">${log.feces.notes || ''}</textarea>
    </div>

    <!-- VÓMITO -->
    <div class="card-section">
      <div class="card-section-title">🤢 Vómito</div>

      <div class="form-group">
        <label class="form-label">Houve vómito hoje?</label>
        <div class="toggle-group">
          <button class="toggle-btn ${log.vomit.occurred === true ? 'active' : ''}" onclick="setVomit('occurred',true)">⚠️ Sim</button>
          <button class="toggle-btn ${log.vomit.occurred === false ? 'active' : ''}" onclick="setVomit('occurred',false)">✅ Não</button>
        </div>
      </div>

      ${log.vomit.occurred === true ? `
      <div class="form-group">
        <label class="form-label">Quantas vezes?</label>
        <div style="display:flex;gap:.5rem;align-items:center">
          <button class="btn-secondary btn-sm" onclick="adjustVomit(-1)">−</button>
          <span style="font-size:1.2rem;font-weight:700;padding:0 .75rem">${log.vomit.count}</span>
          <button class="btn-primary btn-sm" onclick="adjustVomit(1)">+</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Cor do vómito</label>
        <div class="color-grid">
          ${HEALTH_ALERTS.vomitColors.map((c, i) => `
            <div class="color-swatch ${log.vomit.colorIndex === i ? 'selected' : ''}"
              style="background:${c.color};border:1.5px solid #ccc"
              title="${c.label}"
              onclick="setVomitColor(${i})"></div>
          `).join('')}
        </div>
        ${log.vomit.colorIndex !== undefined ? `<p style="font-size:.8rem;margin-top:.4rem;color:var(--text-muted)">${HEALTH_ALERTS.vomitColors[log.vomit.colorIndex].label}</p>` : ''}
        ${log.vomit.colorIndex !== undefined ? renderColorAlert('vomit', log.vomit.colorIndex) : ''}
      </div>

      ${log.vomit.count >= 3 ? `
      <div class="alert-banner danger">
        <img src="images/vet.svg" style="width:20px;height:20px;flex-shrink:0">
        <div><strong>Vómitos frequentes!</strong><p>3 ou mais vómitos num dia podem indicar problema sério. Consulte o veterinário hoje.</p></div>
      </div>` : ''}` : ''}

      <textarea class="form-control" rows="2" placeholder="Observações sobre vómito..." onchange="updateLogField('vomit','notes',this.value)">${log.vomit.notes || ''}</textarea>
    </div>

    <!-- MEDICAÇÃO -->
    <div class="card-section">
      <div class="card-section-title"><img src="images/medication.svg" style="width:22px;height:22px"> Medicação</div>
      ${renderMedsSection(pet, log)}
    </div>

    <!-- HUMOR/ATIVIDADE -->
    <div class="card-section">
      <div class="card-section-title">😊 Humor & Atividade</div>

      <div class="form-group">
        <label class="form-label">Como estava o humor hoje?</label>
        <div class="toggle-group">
          ${['😊 Animado', '😴 Letárgico', '😰 Ansioso', '😾 Irritável', '😶 Normal'].map(m => `
            <button class="toggle-btn ${log.mood === m ? 'active' : ''}" onclick="setMood('${m}')">${m}</button>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Nível de atividade física</label>
        <div class="toggle-group">
          ${['🏃 Alto', '🚶 Normal', '😴 Baixo', '🛋️ Muito baixo'].map(a => `
            <button class="toggle-btn ${log.activity === a ? 'active' : ''}" onclick="setActivity('${a}')">${a}</button>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Peso medido hoje (kg)</label>
        <input class="form-control" type="number" step="0.1" min="0.1" max="100" placeholder="Opcional" value="${log.weight || ''}" onchange="updateLogField('weight',null,parseFloat(this.value)||null)" style="max-width:150px">
      </div>
    </div>

    <!-- SÉNIOR CHECK (apenas para séniores) -->
    ${isSenior ? renderSeniorCheck(pet, log) : ''}

    <!-- NOTAS GERAIS -->
    <div class="card-section">
      <div class="card-section-title">📝 Notas Gerais</div>
      <textarea class="form-control" rows="4" placeholder="Outras observações sobre o dia do ${pet.name}..." onchange="updateLogField('generalNotes',null,this.value)">${log.generalNotes || ''}</textarea>
    </div>

    <button class="btn-primary btn-full" style="margin-bottom:1rem" onclick="saveLog()">
      💾 Guardar Registo de Hoje
    </button>
  `;
}

function renderStageAlert(stage, pet) {
  if (stage.name === 'Sénior' || stage.name === 'Geriátrico') {
    return `<div class="alert-banner" style="background:var(--purple-light);border-color:#c4b5fd;color:#4c1d95;margin-bottom:1rem">
      <span style="font-size:1.3rem">⭐</span>
      <div><strong>${stage.name}! ${stage.emoji}</strong><p>${stage.desc}</p></div>
    </div>`;
  }
  if (stage.name === 'Filhote') {
    return `<div class="alert-banner info" style="margin-bottom:1rem">
      <span style="font-size:1.3rem">🐣</span>
      <div><strong>Filhote em crescimento!</strong><p>${stage.desc}</p></div>
    </div>`;
  }
  return '';
}

function renderFecesAlert(consistencyId) {
  const c = HEALTH_ALERTS.fecesConsistency.find(x => x.id === consistencyId);
  if (!c) return '';
  const cls = c.risk === 'low' ? 'success' : c.risk === 'medium' ? 'warning' : 'danger';
  return `<div class="alert-banner ${cls}" style="margin-top:.5rem"><div><p>${c.msg}</p></div></div>`;
}

function renderColorAlert(type, idx) {
  const arr = type === 'feces' ? HEALTH_ALERTS.fecesColors : HEALTH_ALERTS.vomitColors;
  const c = arr[idx];
  if (!c) return '';
  const cls = c.risk === 'low' ? 'success' : c.risk === 'medium' ? 'warning' : 'danger';
  return `<div class="alert-banner ${cls}" style="margin-top:.4rem"><div><p>${c.msg}</p></div></div>`;
}

function renderMedsSection(pet, log) {
  const meds = pet.medications || [];
  if (meds.length === 0) {
    return `
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:.75rem">Nenhuma medicação cadastrada para ${pet.name}.</p>
      <button class="btn-secondary btn-sm" onclick="openMedsModal('${pet.id}')">+ Adicionar Medicação</button>`;
  }
  return `
    ${meds.map((m, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid var(--border)">
        <div>
          <strong style="font-size:.9rem">${m.name}</strong>
          <div style="font-size:.75rem;color:var(--text-muted)">${m.dose} · ${m.frequency}</div>
        </div>
        <button class="toggle-btn ${(log.meds[i] && log.meds[i].given) ? 'active' : ''}" onclick="toggleMedGiven(${i})" style="font-size:.8rem">
          ${(log.meds[i] && log.meds[i].given) ? '✅ Dada' : '⬜ Dar'}
        </button>
      </div>`).join('')}
    <button class="btn-secondary btn-sm" style="margin-top:.75rem" onclick="openMedsModal('${pet.id}')">+ Adicionar Medicação</button>`;
}

function renderSeniorCheck(pet, log) {
  const sc = log.seniorCheck || {};
  return `
    <div class="card-section" style="border-color:var(--purple-light)">
      <div class="card-section-title" style="color:var(--purple)">👴 Controlo Sénior</div>
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:1rem">Para animais séniores, monitorize estas condições regularmente:</p>

      ${[
      { key: 'diaper', label: 'Usa fraldas?', icon: '🩲' },
      { key: 'blind', label: 'Perda de visão?', icon: '👁️' },
      { key: 'deaf', label: 'Perda de audição?', icon: '👂' },
      { key: 'mobility', label: 'Dificuldade de mobilidade/articulações?', icon: '🦴' },
      { key: 'incontinence', label: 'Incontinência urinária?', icon: '💧' },
      { key: 'confusion', label: 'Desorientação/confusão?', icon: '🌀' },
      { key: 'appetite_loss', label: 'Perda de apetite significativa?', icon: '😿' }
    ].map(item => `
        <div class="check-item" onclick="toggleSeniorCheck('${item.key}')">
          <input type="checkbox" id="sc-${item.key}" ${sc[item.key] ? 'checked' : ''} onclick="event.stopPropagation();toggleSeniorCheck('${item.key}')">
          <label for="sc-${item.key}">${item.icon} ${item.label}</label>
        </div>`).join('')}

      ${Object.values(sc).some(Boolean) ? `
        <div class="alert-banner warning" style="margin-top:.75rem">
          <img src="images/vet.svg" style="width:20px;height:20px;flex-shrink:0">
          <div><strong>Consulta veterinária recomendada</strong><p>Algumas condições séniores detetadas. Consulte o seu veterinário para avaliação e plano de cuidados adequado.</p></div>
        </div>` : ''}
    </div>`;
}

/* ─────────────────────────────────────────────
   RENDER: PROFILE
───────────────────────────────────────────── */
function renderProfile() {
  const pet = getActivePet();
  const el = document.getElementById('profile-content');
  const genderIcon = pet.gender === 'macho' ? '♂️' : pet.gender === 'femea' ? '♀️' : '';

  el.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${avatarHtml}</div>
      <div>
        <div class="profile-name">${pet.name} ${genderIcon}</div> 
        <div class="profile-breed">${pet.type === 'dog' ? '🐕 Cão' : '🐱 Gato'} · ${pet.breed || 'Sem raça definida'}</div>
        ```
  if (!el) return;

  if (!pet) {
    el.innerHTML = `<div class="empty-state"><h3>Nenhum pet selecionado</h3></div>`;
    return;
  }

  const { stage, waterMl, foodG } = getRecommendations(pet);
  const stages = VET_DATA[pet.type]?.lifeStages || [];
  const stageIdx = stages.findIndex(s => s.name === stage.name);
  const progress = Math.min(100, Math.round((pet.age / (pet.type === 'dog' ? 16 : 20)) * 100));
  const avatarHtml = pet.photo
    ? `<img src="${pet.photo}" alt="${pet.name}">`
    : `<img src="images/${pet.type}.svg" alt="${pet.type}" style="width:60px;height:60px;padding:10px">`;

  el.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar">${avatarHtml}</div>
      <div>
        <div class="profile-name">${pet.name}</div>
        <div class="profile-breed">${pet.type === 'dog' ? '🐕 Cão' : '🐱 Gato'} · ${pet.breed || 'Sem raça definida'}</div>
        <div class="pet-stage-badge ${stage.badge}">${stage.emoji} ${stage.name}</div>
        ${pet.castrated ? '<div class="chip" style="margin-top:.4rem">✂️ Castrado(a)</div>' : ''}
      </div>
    </div>

    <!-- Stats -->
    <div class="stat-grid" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-label">📅 Idade</div><div class="stat-value">${ageLabel(pet.age)}</div></div>
      <div class="stat-card"><div class="stat-label">⚖️ Peso</div><div class="stat-value">${pet.weight || '—'}<span class="stat-unit"> kg</span></div></div>
      <div class="stat-card"><div class="stat-label">💧 Água/dia</div><div class="stat-value">${waterMl}<span class="stat-unit"> ml</span></div></div>
      <div class="stat-card"><div class="stat-label">🍽️ Ração/dia</div><div class="stat-value">${foodG}<span class="stat-unit"> g</span></div></div>
    </div>

    <!-- Life Stage -->
    <div class="stage-bar-wrap" style="margin-bottom:1rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">
        <strong style="font-size:.9rem">Fase de vida</strong>
        <span class="pet-stage-badge ${stage.badge}">${stage.emoji} ${stage.name}</span>
      </div>
      <div class="stage-bar">
        <div class="stage-fill" style="width:${progress}%"></div>
        <div class="stage-marker" style="left:${progress}%"></div>
      </div>
      <div class="stage-labels">
        ${stages.map(s => `<span>${s.emoji}</span>`).join('')}
      </div>
      <p style="font-size:.8rem;color:var(--text-muted);margin-top:.5rem">${stage.desc}</p>
    </div>

    <!-- Info sections -->
    <div class="card-section">
      <div class="card-section-title">📋 Informações de Saúde</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem 1rem;font-size:.85rem">
        <div><span style="color:var(--text-muted)">Castrado(a):</span> <strong>${pet.castrated ? 'Sim ✂️' : 'Não'}</strong></div>
        <div><span style="color:var(--text-muted)">Tipo de ração:</span> <strong>${pet.defaultFoodType || 'Não definido'}</strong></div>
        <div><span style="color:var(--text-muted)">Ração:</span> <strong>${pet.defaultFood || 'Não definido'}</strong></div>
        <div><span style="color:var(--text-muted)">Alimentação:</span> <strong>${pet.feedingMode || 'Horário fixo'}</strong></div>
        ${pet.allergies ? `<div style="grid-column:1/-1"><span style="color:var(--text-muted)">Alergias:</span> <strong>${pet.allergies}</strong></div>` : ''}
        ${pet.conditions ? `<div style="grid-column:1/-1"><span style="color:var(--text-muted)">Condições:</span> <strong>${pet.conditions}</strong></div>` : ''}
      </div>
    </div>

    <!-- Medicações -->
    <div class="card-section">
      <div class="card-section-title"><img src="images/medication.svg" style="width:20px;height:20px"> Medicações Actuais</div>
      ${(pet.medications || []).length === 0
      ? `<p style="font-size:.85rem;color:var(--text-muted)">Nenhuma medicação registada.</p>`
      : (pet.medications || []).map((m, i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
            <div>
              <strong>${m.name}</strong>
              <div style="font-size:.75rem;color:var(--text-muted)">${m.dose} · ${m.frequency}${m.notes ? ' · ' + m.notes : ''}</div>
            </div>
            <button class="btn-icon" onclick="removeMed('${pet.id}',${i})" title="Remover">🗑️</button>
          </div>`).join('')
    }
      <button class="btn-secondary btn-sm" style="margin-top:.75rem" onclick="openMedsModal('${pet.id}')">+ Adicionar Medicação</button>
    </div>

    <!-- Deficiências séniores -->
    ${(stage.name === 'Sénior' || stage.name === 'Geriátrico') && pet.seniorConditions ? `
    <div class="card-section" style="border-color:var(--purple-light)">
      <div class="card-section-title" style="color:var(--purple)">👴 Condições Séniores Registadas</div>
      ${Object.entries(pet.seniorConditions || {}).filter(([, v]) => v).map(([k]) => {
      const labels = { diaper: 'Usa fraldas', blind: 'Perda de visão', deaf: 'Perda de audição', mobility: 'Dificuldade de mobilidade', incontinence: 'Incontinência', confusion: 'Desorientação', appetite_loss: 'Perda de apetite' };
      return `<div class="chip" style="margin:.2rem">${labels[k] || k}</div>`;
    }).join('')}
    </div>` : ''}

    <!-- Actions -->
    <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem">
      <button class="btn-secondary" onclick="openEditPetModal('${pet.id}')">✏️ Editar Perfil</button>
      <button class="btn-danger" onclick="confirmDeletePet('${pet.id}')">🗑️ Remover Pet</button>
    </div>

    <!-- Veterinário contacto -->
    <div class="card-section">
      <div class="card-section-title"><img src="images/vet.svg" style="width:20px;height:20px"> Contacto Veterinário</div>
      <div class="form-group">
        <label class="form-label">Nome do veterinário / clínica</label>
        <input class="form-control" type="text" placeholder="Ex: Dr. Silva · Clínica VetCare" value="${pet.vetName || ''}" onchange="updatePetField('${pet.id}','vetName',this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Telefone</label>
        <input class="form-control" type="tel" placeholder="+351 000 000 000" value="${pet.vetPhone || ''}" onchange="updatePetField('${pet.id}','vetPhone',this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Próxima consulta</label>
        <input class="form-control" type="date" value="${pet.nextVetVisit || ''}" onchange="updatePetField('${pet.id}','nextVetVisit',this.value)">
      </div>
      ${pet.nextVetVisit && new Date(pet.nextVetVisit) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? `
        <div class="alert-banner info">
          <img src="images/vet.svg" style="width:18px;height:18px;flex-shrink:0">
          <div><strong>Consulta próxima!</strong><p>A próxima consulta de ${pet.name} é em ${new Date(pet.nextVetVisit).toLocaleDateString('pt-PT')}.</p></div>
        </div>` : ''}
    </div>
  `;
}

/* ─────────────────────────────────────────────
   RENDER: HISTORY
───────────────────────────────────────────── */
function renderHistory() {
  const pet = getActivePet();
  const el = document.getElementById('history-content');
  if (!el) return;

  if (!pet) {
    el.innerHTML = `<div class="empty-state"><h3>Nenhum pet selecionado</h3></div>`;
    return;
  }

  const petLogs = state.logs[pet.id] || {};
  const dates = Object.keys(petLogs).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <img src="images/health.svg" style="width:70px;height:70px;margin:0 auto 1rem;display:block;opacity:.3">
        <h3>Sem histórico ainda</h3>
        <p>Comece a registar os dias de ${pet.name} e o histórico aparecerá aqui.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="card-section" style="margin-bottom:1rem">
      <div class="card-section-title">📊 ${pet.name} — Histórico de Saúde</div>
      <div class="seg-control" id="history-filter">
        <button class="seg-btn active" data-filter="all" onclick="filterHistory('all',this)">Todos</button>
        <button class="seg-btn" data-filter="alerts" onclick="filterHistory('alerts',this)">⚠️ Alertas</button>
        <button class="seg-btn" data-filter="week" onclick="filterHistory('week',this)">Esta semana</button>
      </div>
    </div>
    <div class="timeline" id="history-timeline">
      ${dates.map(date => renderHistoryItem(pet, petLogs[date], date)).join('')}
    </div>`;
}

function renderHistoryItem(pet, log, date) {
  const alerts = [];
  if (log.vomit?.occurred && log.vomit.count >= 2) alerts.push('🤢 Vómitos');
  if (log.feces?.consistency === 'liquid') alerts.push('💩 Diarreia');
  if (log.feces?.occurred === false) alerts.push('❌ Sem fezes');
  if (log.food?.ate === false) alerts.push('❌ Não comeu');
  if (log.feces?.colorIndex !== undefined && HEALTH_ALERTS.fecesColors[log.feces.colorIndex]?.risk === 'high') alerts.push('⚠️ Fezes anormais');

  return `
    <div class="timeline-item" data-date="${date}" data-alerts="${alerts.length > 0 ? 'true' : 'false'}">
      <div class="timeline-dot" style="${alerts.length > 0 ? 'background:var(--red)' : ''}"></div>
      <div class="timeline-date">${formatDate(date)}</div>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.3rem">
        ${log.water?.glasses ? `<span class="chip">💧 ${log.water.glasses} copos</span>` : ''}
        ${log.food?.ate === true ? `<span class="chip" style="color:var(--green)">✅ Comeu</span>` : ''}
        ${log.food?.ate === false ? `<span class="chip" style="color:var(--red)">❌ Não comeu</span>` : ''}
        ${log.vomit?.occurred ? `<span class="chip" style="color:var(--red)">🤢 Vómito ${log.vomit.count}x</span>` : ''}
        ${log.mood ? `<span class="chip">${log.mood}</span>` : ''}
        ${log.weight ? `<span class="chip">⚖️ ${log.weight}kg</span>` : ''}
      </div>
      ${alerts.length > 0 ? `
        <div class="alert-banner warning" style="margin-top:.5rem;padding:.6rem .8rem">
          <div><strong>Alertas:</strong> <span style="font-size:.8rem">${alerts.join(' · ')}</span></div>
        </div>` : ''}
      ${log.generalNotes ? `<p style="font-size:.8rem;color:var(--text-muted);margin-top:.4rem;font-style:italic">"${log.generalNotes}"</p>` : ''}
    </div>`;
}

function filterHistory(filter, btn) {
  document.querySelectorAll('#history-filter .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.timeline-item').forEach(item => {
    const date = item.dataset.date;
    const hasAlerts = item.dataset.alerts === 'true';
    const isThisWeek = new Date(date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (filter === 'all') item.style.display = '';
    else if (filter === 'alerts') item.style.display = hasAlerts ? '' : 'none';
    else if (filter === 'week') item.style.display = isThisWeek ? '' : 'none';
  });
}

/* ─────────────────────────────────────────────
   MODAL: ADD / EDIT PET
───────────────────────────────────────────── */
function openAddPetModal() {
  renderAddPetModal(null);
  openModal('modal-add-pet');
}

function openEditPetModal(petId) {
  const pet = state.pets.find(p => p.id === petId);
  renderAddPetModal(pet);
  openModal('modal-add-pet');
}

let currentAvatarData = null;

function renderAddPetModal(pet) {
  const isEdit = !!pet;
  currentAvatarData = pet?.photo || null;
  const el = document.getElementById('modal-add-pet-body');
  if (!el) return;

  el.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title">${isEdit ? '✏️ Editar ' + pet.name : '🐾 Novo Pet'}</div>

    <!-- Avatar -->
    <div style="text-align:center;margin-bottom:1.25rem">
      <div class="avatar-upload" onclick="document.getElementById('avatar-input').click()">
        <div class="avatar-upload-preview" id="avatar-preview">
          ${currentAvatarData
      ? `<img src="${currentAvatarData}" alt="foto">`
      : `<img src="images/${pet?.type || 'dog'}.svg" alt="pet" id="avatar-default-icon" style="width:60px;height:60px;padding:10px">`}
        </div>
        <div class="avatar-upload-btn">📷</div>
      </div>
      <p style="font-size:.75rem;color:var(--text-muted);margin-top:.4rem">Toque para adicionar foto</p>
      <input type="file" id="avatar-input" accept="image/*" onchange="handleAvatarUpload(this)">
    </div>

    <!-- Tipo de animal -->
    <div class="form-group">
      <label class="form-label">Tipo de animal</label>
      <div class="animal-type-grid">
        <div class="animal-type-btn ${(!pet || pet.type === 'dog') ? 'selected' : ''}" id="type-dog" onclick="selectAnimalType('dog')">
          <img src="images/dog.svg" style="width:56px;height:56px;color:#c97d3e">
          <span>🐕 Cão</span>
        </div>
        <div class="animal-type-btn ${pet?.type === 'cat' ? 'selected' : ''}" id="type-cat" onclick="selectAnimalType('cat')">
          <img src="images/cat.svg" style="width:56px;height:56px;color:#c97d3e">
          <span>🐱 Gato</span>
        </div>
      </div>
    </div>

    <input type="hidden" id="pet-type-val" value="${pet?.type || 'dog'}">

     <div class="form-group">
      <label class="form-label">Nome do pet</label>
      <input class="form-control" type="text" id="pet-name" placeholder="Ex: Rex, Mimi, Bolinha..." value="${pet?.name || ''}">
    </div>

    <div class="form-group">
      <label class="form-label">Gênero</label>
      <div class="toggle-group">
        <button class="toggle-btn ${pet?.gender === 'macho' ? 'active' : ''}" id="gender-macho" onclick="selectGender('macho')">♂️ Macho</button>
        <button class="toggle-btn ${pet?.gender === 'femea' ? 'active' : ''}" id="gender-femea" onclick="selectGender('femea')">♀️ Fêmea</button>
      </div>
      <input type="hidden" id="pet-gender-val" value="${pet?.gender || ''}">
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="form-group">
        <label class="form-label">Idade (anos)</label>
        <input class="form-control" type="number" id="pet-age" min="0" max="30" step="0.5" placeholder="Ex: 3" value="${pet?.age || ''}">
        <div class="form-control-hint">Use .5 para meio-ano</div>
      </div>
      <div class="form-group">
        <label class="form-label">Peso (kg)</label>
        <input class="form-control" type="number" id="pet-weight" min="0.1" max="100" step="0.1" placeholder="Ex: 5.2" value="${pet?.weight || ''}">
      </div>
    </div>

    <div class="form-group">
      <div class="check-item">
        <input type="checkbox" id="pet-castrated" ${pet?.castrated ? 'checked' : ''}>
        <label for="pet-castrated">✂️ Animal castrado/esterilizado</label>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Ração habitual</label>
      <input class="form-control" type="text" id="pet-food" placeholder="Ex: Royal Canin Adult..." value="${pet?.defaultFood || ''}">
    </div>

    <div class="form-group">
      <label class="form-label">Tipo de alimentação principal</label>
      <select class="form-control" id="pet-food-type">
        <option value="" ${!pet?.defaultFoodType ? 'selected' : ''}>Selecionar...</option>
        <option value="Ração seca" ${pet?.defaultFoodType === 'Ração seca' ? 'selected' : ''}>🥜 Ração seca</option>
        <option value="Comida húmida" ${pet?.defaultFoodType === 'Comida húmida' ? 'selected' : ''}>🥫 Comida húmida</option>
        <option value="Misto" ${pet?.defaultFoodType === 'Misto' ? 'selected' : ''}>🍱 Misto</option>
        <option value="BARF/Natural" ${pet?.defaultFoodType === 'BARF/Natural' ? 'selected' : ''}>🥩 BARF/Natural</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Alergias / intolerâncias conhecidas</label>
      <input class="form-control" type="text" id="pet-allergies" placeholder="Ex: frango, glúten..." value="${pet?.allergies || ''}">
    </div>

    <div class="form-group">
      <label class="form-label">Condições de saúde pré-existentes</label>
      <textarea class="form-control" id="pet-conditions" rows="2" placeholder="Ex: diabetes, hipotiroidismo...">${pet?.conditions || ''}</textarea>
    </div>

    <div style="display:flex;gap:.75rem;margin-top:.5rem">
      <button class="btn-secondary btn-full" onclick="closeModal('modal-add-pet')">Cancelar</button>
      <button class="btn-primary btn-full" onclick="savePet('${pet?.id || ''}')">
        ${isEdit ? '💾 Guardar' : '🐾 Adicionar Pet'}
      </button>
    </div>
  `;
}

function selectAnimalType(type) {
  document.getElementById('pet-type-val').value = type;
  document.getElementById('type-dog').classList.toggle('selected', type === 'dog');
  document.getElementById('type-cat').classList.toggle('selected', type === 'cat');
  const icon = document.getElementById('avatar-default-icon');
  if (icon && !currentAvatarData) icon.src = `images/${type}.svg`;
}
function selectGender(gender) {
  document.getElementById('pet-gender-val').value = gender;
  document.getElementById('gender-macho').classList.toggle('active', gender === 'macho');
  document.getElementById('gender-femea').classList.toggle('active', gender === 'femea');
}

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    currentAvatarData = e.target.result;
    const preview = document.getElementById('avatar-preview');
    if (preview) preview.innerHTML = `<img src="${currentAvatarData}" alt="foto">`;
  };
  reader.readAsDataURL(file);
}

function savePet(editId) {
  const name = document.getElementById('pet-name')?.value.trim();
  const age = parseFloat(document.getElementById('pet-age')?.value);
  if (!name) { showToast('⚠️ Insira o nome do pet'); return; }
  if (isNaN(age) || age < 0) { showToast('⚠️ Insira a idade corretamente'); return; }

  const data = {
    /* ... dentro da função savePet(editId) ... */
    id: editId || genId(),
    type: document.getElementById('pet-type-val')?.value || 'dog',
    name,
    gender: document.getElementById('pet-gender-val')?.value || '', // Adicionado aqui
    breed: document.getElementById('pet-breed')?.value.trim() || '',
    age,
    weight: parseFloat(document.getElementById('pet-weight')?.value) || null,
    castrated: document.getElementById('pet-castrated')?.checked || false,
    defaultFood: document.getElementById('pet-food')?.value.trim() || '',
    defaultFoodType: document.getElementById('pet-food-type')?.value || '',
    allergies: document.getElementById('pet-allergies')?.value.trim() || '',
    conditions: document.getElementById('pet-conditions')?.value.trim() || '',
    photo: currentAvatarData,
    medications: editId ? (state.pets.find(p => p.id === editId)?.medications || []) : [],
    vetName: editId ? (state.pets.find(p => p.id === editId)?.vetName || '') : '',
    vetPhone: editId ? (state.pets.find(p => p.id === editId)?.vetPhone || '') : '',
    nextVetVisit: editId ? (state.pets.find(p => p.id === editId)?.nextVetVisit || '') : '',
    createdAt: editId ? (state.pets.find(p => p.id === editId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };

  if (editId) {
    const idx = state.pets.findIndex(p => p.id === editId);
    if (idx !== -1) state.pets[idx] = data;
  } else {
    state.pets.push(data);
    state.activePetId = data.id;
  }

  saveState();
  closeModal('modal-add-pet');
  showToast(editId ? `✅ ${name} atualizado!` : `🐾 ${name} adicionado com sucesso!`);

  // Stage notification
  const { stage } = getRecommendations(data);
  if (stage.name === 'Sénior' || stage.name === 'Geriátrico') {
    setTimeout(() => showToast(`⭐ ${name} é um animal sénior — veja as recomendações especiais!`, 4000), 500);
  }

  navigate(state.currentScreen);
}

/* ── Medications Modal ── */
function openMedsModal(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  const el = document.getElementById('modal-meds-body');
  if (!el) return;

  el.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-title"><img src="images/medication.svg" style="width:22px;height:22px"> Medicação de ${pet.name}</div>

    <div class="form-group">
      <label class="form-label">Nome do medicamento</label>
      <input class="form-control" id="med-name" type="text" placeholder="Ex: Frontline, Milbemax...">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      <div class="form-group">
        <label class="form-label">Dose</label>
        <input class="form-control" id="med-dose" type="text" placeholder="Ex: 1 comprimido">
      </div>
      <div class="form-group">
        <label class="form-label">Frequência</label>
        <input class="form-control" id="med-freq" type="text" placeholder="Ex: 1x/dia">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Observações</label>
      <input class="form-control" id="med-notes" type="text" placeholder="Ex: em jejum, com comida...">
    </div>
    <div style="display:flex;gap:.75rem">
      <button class="btn-secondary btn-full" onclick="closeModal('modal-meds')">Cancelar</button>
      <button class="btn-primary btn-full" onclick="addMedication('${petId}')">+ Adicionar</button>
    </div>
  `;
  openModal('modal-meds');
}

function addMedication(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  const name = document.getElementById('med-name')?.value.trim();
  if (!name) { showToast('⚠️ Insira o nome do medicamento'); return; }
  if (!pet.medications) pet.medications = [];
  pet.medications.push({
    name,
    dose: document.getElementById('med-dose')?.value.trim() || '',
    frequency: document.getElementById('med-freq')?.value.trim() || '',
    notes: document.getElementById('med-notes')?.value.trim() || ''
  });
  saveState();
  closeModal('modal-meds');
  showToast('💊 Medicação adicionada!');
  navigate(state.currentScreen);
}

function removeMed(petId, idx) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet || !pet.medications) return;
  pet.medications.splice(idx, 1);
  saveState();
  renderProfile();
  showToast('🗑️ Medicação removida');
}

/* ── Modal helpers ── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ── Log update helpers ── */
function getCurrentLog() {
  const pet = getActivePet();
  if (!pet) return null;
  return getOrCreateLog(pet.id, today());
}

function updateLogField(section, field, value) {
  const log = getCurrentLog();
  if (!log) return;
  if (field === null) log[section] = value;
  else {
    if (!log[section]) log[section] = {};
    log[section][field] = value;
  }
  saveState();
}

function adjustWater(delta) {
  const log = getCurrentLog();
  if (!log) return;
  log.water.glasses = Math.max(0, (log.water.glasses || 0) + delta);
  saveState();
  renderDaily();
}

function toggleWaterUrine(count) {
  const log = getCurrentLog();
  if (!log) return;
  log.water.urineCount = (log.water.urineCount === count) ? 0 : count;
  saveState();
  renderDaily();
}

function setFoodAte(val) {
  const log = getCurrentLog();
  if (!log) return;
  log.food.ate = val;
  saveState();
  renderDaily();
}

function setFoodType(val) {
  const log = getCurrentLog();
  if (!log) return;
  log.food.foodType = val;
  saveState();
  renderDaily();
}

function setFoodMode(val) {
  const log = getCurrentLog();
  if (!log) return;
  log.food.mode = val;
  saveState();
  renderDaily();
}

function adjustFeedings(delta) {
  const log = getCurrentLog();
  if (!log) return;
  log.food.feedingCount = Math.max(0, (log.food.feedingCount || 0) + delta);
  saveState();
  renderDaily();
}

function setFeces(field, val) {
  const log = getCurrentLog();
  if (!log) return;
  log.feces[field] = val;
  saveState();
  renderDaily();
}

function setFecesColor(idx) {
  const log = getCurrentLog();
  if (!log) return;
  log.feces.colorIndex = idx;
  saveState();
  renderDaily();
}

function setVomit(field, val) {
  const log = getCurrentLog();
  if (!log) return;
  log.vomit[field] = val;
  if (field === 'occurred' && val && !log.vomit.count) log.vomit.count = 1;
  saveState();
  renderDaily();
}

function adjustVomit(delta) {
  const log = getCurrentLog();
  if (!log) return;
  log.vomit.count = Math.max(0, (log.vomit.count || 0) + delta);
  saveState();
  renderDaily();
}

function setVomitColor(idx) {
  const log = getCurrentLog();
  if (!log) return;
  log.vomit.colorIndex = idx;
  saveState();
  renderDaily();
}

function setMood(val) {
  const log = getCurrentLog();
  if (!log) return;
  log.mood = val;
  saveState();
  renderDaily();
}

function setActivity(val) {
  const log = getCurrentLog();
  if (!log) return;
  log.activity = val;
  saveState();
  renderDaily();
}

function toggleMedGiven(idx) {
  const log = getCurrentLog();
  if (!log) return;
  if (!log.meds[idx]) log.meds[idx] = {};
  log.meds[idx].given = !log.meds[idx].given;
  saveState();
  renderDaily();
}

function toggleSeniorCheck(key) {
  const log = getCurrentLog();
  if (!log) return;
  if (!log.seniorCheck) log.seniorCheck = {};
  log.seniorCheck[key] = !log.seniorCheck[key];
  saveState();
  renderDaily();
}

function updatePetDefault(field, value) {
  const pet = getActivePet();
  if (!pet) return;
  pet[field] = value;
  saveState();
}

function updatePetField(petId, field, value) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  pet[field] = value;
  saveState();
  showToast('✅ Guardado');
}

function saveLog() {
  saveState();
  showToast('✅ Registo de hoje guardado!');
  // Quick health summary
  const log = getCurrentLog();
  const alerts = [];
  if (log?.vomit?.occurred && log.vomit.count >= 3) alerts.push('Vómitos frequentes!');
  if (log?.feces?.consistency === 'liquid') alerts.push('Diarreia detectada!');
  if (log?.feces?.colorIndex !== undefined && HEALTH_ALERTS.fecesColors[log.feces.colorIndex]?.risk === 'high') alerts.push('Cor das fezes anormal!');
  if (alerts.length > 0) {
    setTimeout(() => showToast('⚠️ Atenção: ' + alerts.join(' | '), 4000), 800);
  }
}

function confirmDeletePet(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (confirm(`Tem certeza que deseja remover ${pet.name}? Todos os dados serão perdidos.`)) {
    state.pets = state.pets.filter(p => p.id !== petId);
    delete state.logs[petId];
    if (state.activePetId === petId) state.activePetId = state.pets[0]?.id || null;
    saveState();
    showToast('🗑️ Pet removido');
    navigate('home');
  }
}

/* ─────────────────────────────────────────────
   Pet selector in daily/profile/history headers
───────────────────────────────────────────── */
function renderPetSelector(containerId) {
  const el = document.getElementById(containerId);
  if (!el || state.pets.length <= 1) { if (el) el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="overflow-x:auto;padding-bottom:.25rem">
      <div style="display:flex;gap:.5rem;min-width:max-content">
        ${state.pets.map(p => `
          <button class="toggle-btn ${state.activePetId === p.id ? 'active' : ''}" onclick="switchPet('${p.id}')">
            ${p.type === 'dog' ? '🐕' : '🐱'} ${p.name}
          </button>`).join('')}
      </div>
    </div>`;
}

function switchPet(petId) {
  state.activePetId = petId;
  saveState();
  navigate(state.currentScreen);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  // Tab bar clicks
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.screen));
  });

  // Desktop nav
  document.querySelectorAll('.desktop-nav-link').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); navigate(link.dataset.screen); });
  });

  // Modal overlays close on bg click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Navigate to home
  navigate('home');
});
