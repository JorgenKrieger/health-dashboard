// ── Settings (persisted in localStorage) ──────────────────
let GOAL_WEIGHT = parseFloat(localStorage.getItem('hd_goal_weight')) || null;
let GOAL_DATE   = localStorage.getItem('hd_goal_date') ? new Date(localStorage.getItem('hd_goal_date')) : null;
const WAIST_DAYS  = 30;

// ── Theme-aware color tokens ───────────────────────────────
// Updated to match brand identity: Blood/cardio · Body/weight · Activity · Nutrition
const C = {};

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function updateColors() {
  const blood    = cssVar('--color-accent-blood');
  const body     = cssVar('--color-accent-body');
  const activity = cssVar('--color-accent-activity');
  const nutrition= cssVar('--color-accent-nutrition');
  const muted    = cssVar('--color-text-muted');

  // Body / weight family → body blue
  C.weight  = body;
  C.lean    = body;      // shown as lighter via alpha in charts
  C.fat     = blood;     // fat mass as a health-risk metric → blood red
  C.bmi     = body;

  // Cardio family → blood red
  C.hrAvg   = blood;
  C.hrMin   = blood;
  C.hrMax   = blood;
  C.sys     = blood;
  C.dia     = blood;

  // Activity family → activity amber
  C.steps   = activity;
  C.energy  = activity;
  C.dist    = activity;
  C.flights = activity;

  // Nutrition family → nutrition green
  C.diet    = nutrition;
  C.carbs   = body;      // carbs → body blue (macro under body category)
  C.protein = nutrition;
  C.fat2    = activity;  // dietary fat → amber

  // Walking → activity amber
  C.wspeed  = activity;
  C.wstep   = activity;
  C.wasym   = blood;     // asymmetry is a warning → blood red
  C.wdouble = activity;

  // Special
  C.goal    = nutrition; // goal reached = positive = nutrition green
  C.proj    = muted;
}

function applyChartDefaults() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';

  const textMuted   = cssVar('--color-text-muted');
  const border      = cssVar('--color-border');
  const surface     = cssVar('--color-surface');
  const borderStrong= cssVar('--color-border-strong');
  const textPrimary = cssVar('--color-text-primary');

  Chart.defaults.color       = textMuted;
  Chart.defaults.borderColor = border;
  Chart.defaults.font.family = "'Geist', 'Inter', system-ui, sans-serif";
  Chart.defaults.font.size   = 11;

  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.padding  = 12;
  Chart.defaults.plugins.legend.labels.color    = cssVar('--color-text-secondary');

  Chart.defaults.plugins.tooltip.backgroundColor = dark ? '#26241B' : '#FFFFFF';
  Chart.defaults.plugins.tooltip.borderColor     = borderStrong;
  Chart.defaults.plugins.tooltip.borderWidth     = 1;
  Chart.defaults.plugins.tooltip.padding         = 10;
  Chart.defaults.plugins.tooltip.titleColor      = textPrimary;
  Chart.defaults.plugins.tooltip.bodyColor       = cssVar('--color-text-secondary');
  Chart.defaults.plugins.tooltip.titleFont       = { family: "'Geist', system-ui, sans-serif", size: 11, weight: '600' };
  Chart.defaults.plugins.tooltip.bodyFont        = { family: "'Geist', system-ui, sans-serif", size: 12 };
  Chart.defaults.plugins.tooltip.cornerRadius    = 10;
  Chart.defaults.animation.duration              = 300;
}

const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

// ── Global state ───────────────────────────────────────────
let allRows      = [];  // parsed CSV rows (one per date, deduped)
let filteredRows = [];  // after date filter
let activeFilter = 0;   // 0=all, 30, 90
let charts       = {};  // name→Chart instance

// ── CSV Parsing ────────────────────────────────────────────
const COLS = [
  'datetime','activeEnergy','bpSys','bpDia','bmi','carbs','dietEnergy',
  'flights','hrMin','hrMax','hrAvg','leanMass','protein','restingEnergy',
  'steps','toothbrushing','totalFat','waist','distance','walkAsym',
  'walkDouble','walkSpeed','walkStep','water','weight'
];

function parseNum(s){
  if(!s || s.trim()==='') return null;
  const n = parseFloat(s.replace(',','.'));
  return isNaN(n) ? null : n;
}

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2) return [];

  const headers = lines[0].split(',').map(h=>h.trim());

  const idx = {};
  const colMap = {
    'Date/Time':                             'datetime',
    'Active Energy (kJ)':                    'activeEnergy',
    'Blood Pressure [Systolic] (mmHg)':      'bpSys',
    'Blood Pressure [Diastolic] (mmHg)':     'bpDia',
    'Body Mass Index (count)':               'bmi',
    'Carbohydrates (g)':                     'carbs',
    'Dietary Energy (kJ)':                   'dietEnergy',
    'Flights Climbed (count)':               'flights',
    'Heart Rate [Min] (count/min)':          'hrMin',
    'Heart Rate [Max] (count/min)':          'hrMax',
    'Heart Rate [Avg] (count/min)':          'hrAvg',
    'Lean Body Mass (kg)':                   'leanMass',
    'Protein (g)':                           'protein',
    'Resting Energy (kJ)':                   'restingEnergy',
    'Step Count (count)':                    'steps',
    'Toothbrushing (s)':                     'toothbrushing',
    'Total Fat (g)':                         'totalFat',
    'Waist Circumference (cm)':              'waist',
    'Walking + Running Distance (km)':       'distance',
    'Walking Asymmetry Percentage (%)':      'walkAsym',
    'Walking Double Support Percentage (%)': 'walkDouble',
    'Walking Speed (km/hr)':                 'walkSpeed',
    'Walking Step Length (cm)':              'walkStep',
    'Water (mL)':                            'water',
    'Weight (kg)':                           'weight',
  };
  headers.forEach((h, i) => { if(colMap[h]) idx[colMap[h]] = i; });

  const rows = {};
  for(let i = 1; i < lines.length; i++){
    const parts = lines[i].split(',');
    if(!parts[idx['datetime']]) continue;
    const rawDate = parts[idx['datetime']]?.trim() || '';
    const dateStr = rawDate.slice(0, 10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    if(!rows[dateStr]){
      const d = new Date(dateStr + 'T12:00:00');
      const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      rows[dateStr] = { date: d, dateStr, label };
      COLS.slice(2).forEach(k => rows[dateStr][k] = null);
    }
    COLS.slice(2).forEach(k => {
      if(idx[k] !== undefined){
        const v = parseNum(parts[idx[k]]);
        if(v !== null) rows[dateStr][k] = v;
      }
    });
  }
  return Object.values(rows).sort((a, b) => a.date - b.date);
}

// ── Math helpers ───────────────────────────────────────────
function rollingAvg(data, values, window = 7){
  return data.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter(v => v !== null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}

function linearRegression(dates, values){
  const pts = dates.map((d, i) => [d.getTime(), values[i]]).filter(p => p[1] !== null);
  if(pts.length < 2) return null;
  const n    = pts.length;
  const sumX  = pts.reduce((a, p) => a + p[0], 0);
  const sumY  = pts.reduce((a, p) => a + p[1], 0);
  const sumXY = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const sumX2 = pts.reduce((a, p) => a + p[0] * p[0], 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, predict: t => slope * t + intercept };
}

function last(arr, key){
  for(let i = arr.length - 1; i >= 0; i--){
    if(arr[i][key] !== null) return arr[i];
  }
  return null;
}

// ── Apply date filter ──────────────────────────────────────
function applyFilter(){
  const now = new Date();
  filteredRows = activeFilter === 0
    ? allRows
    : allRows.filter(r => (now - r.date) / 864e5 <= activeFilter);
  renderAll();
}

// ── Goal section ───────────────────────────────────────────
function renderGoal(){
  if(!GOAL_WEIGHT || !GOAL_DATE) return;
  const rows = filteredRows;
  const weightRows = rows.filter(r => r.weight !== null);
  if(!weightRows.length){
    document.getElementById('goal-cards').innerHTML =
      '<div class="card"><div class="no-data-msg">No weight data yet</div></div>';
    return;
  }

  const latest  = weightRows[weightRows.length - 1];
  const first   = allRows.find(r => r.weight !== null);
  const current = latest.weight;
  const startW  = first ? first.weight : current;
  const kg2go   = current - GOAL_WEIGHT;
  const today   = new Date();
  const daysLeft = Math.max(0, Math.round((GOAL_DATE - today) / 864e5));

  const wAll    = allRows.filter(r => r.weight !== null);
  const cutoff30 = new Date(today.getTime() - 30 * 864e5);
  const wRecent  = wAll.filter(r => r.date >= cutoff30);
  const regAll   = linearRegression(wAll.map(r => r.date), wAll.map(r => r.weight));
  const regRecent= wRecent.length >= 7 ? linearRegression(wRecent.map(r => r.date), wRecent.map(r => r.weight)) : null;

  // Blended slope: average of all-time and recent (or just all-time if not enough recent data)
  const blendedSlope = regAll && regRecent
    ? (regAll.slope + regRecent.slope) / 2
    : regAll ? regAll.slope : null;
  // Anchor the blended line at today's current weight
  const blendedReg = blendedSlope !== null
    ? { slope: blendedSlope, predict: t => current + blendedSlope * (t - today.getTime()) }
    : null;

  // Use blended regression for on-track and projections
  const reg = blendedReg;
  let onTrack    = null;
  let projAtGoal = null;
  if(reg){
    projAtGoal = reg.predict(GOAL_DATE.getTime());
    onTrack    = projAtGoal <= GOAL_WEIGHT + 0.5;
  }

  // Transition date: when blended projection hits 90% of the journey (10% left to goal)
  const transitionThreshold = GOAL_WEIGHT + 0.1 * (startW - GOAL_WEIGHT);
  let transitionDate = null;
  if(blendedReg && blendedSlope < 0){
    const tMs = today.getTime() + (transitionThreshold - current) / blendedSlope;
    const d   = new Date(tMs);
    if(d > today && d < GOAL_DATE) transitionDate = d;
  }

  const el  = document.getElementById('goal-cards');
  const fmt = v => v === null ? '—' : `${v.toFixed(1)} kg`;
  el.innerHTML = `
    <div class="card">
      <div class="card-label">Current weight</div>
      <div class="card-value" style="color:var(--c-weight,${C.weight})">${fmt(current)}</div>
      <div class="card-sub">${latest.dateStr}</div>
    </div>
    <div class="card">
      <div class="card-label">To goal</div>
      <div class="card-value" style="color:${kg2go <= 0 ? C.lean : C.fat}">${kg2go <= 0 ? '✓ Reached!' : fmt(kg2go)}</div>
      <div class="card-sub">Goal: ${GOAL_WEIGHT} kg</div>
    </div>
    <div class="card">
      <div class="card-label">Journey progress</div>
      <div class="card-value" style="color:var(--amber)">${(() => {
        const startDate  = first ? first.date : today;
        const totalWeeks = Math.round((GOAL_DATE - startDate) / (7 * 864e5));
        const weeksDone  = Math.min(totalWeeks, Math.round((today - startDate) / (7 * 864e5)));
        return `wk ${weeksDone} / ${totalWeeks}`;
      })()}</div>
      <div class="card-sub">${daysLeft} days to go</div>
    </div>
    <div class="card">
      <div class="card-label">Start transitioning</div>
      <div class="card-value" style="color:${transitionDate ? 'var(--color-accent-activity)' : 'var(--color-text-muted)'}">
        ${transitionDate ? transitionDate.toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '—'}
      </div>
      <div class="card-sub">${transitionDate ? `~${transitionThreshold.toFixed(1)} kg — ease into maintenance` : projAtGoal !== null ? 'already within 10% of goal' : 'not enough data'}</div>
    </div>
  `;

  const badge = document.getElementById('on-track-badge');
  if(onTrack === null) badge.innerHTML = '';
  else if(onTrack) badge.innerHTML = '<span class="badge badge-green">On track ✓</span>';
  else badge.innerHTML = '<span class="badge badge-red">Behind target</span>';

  const total = startW - GOAL_WEIGHT;
  const done  = startW - current;
  const pct   = total > 0 ? Math.min(100, Math.max(0, done / total * 100)) : 0;
  document.getElementById('goal-progress-fill').style.width = pct.toFixed(1) + '%';
  document.getElementById('prog-start').textContent = `${startW.toFixed(1)} kg start`;

  const dates   = rows.map(r => r.label);
  const weights = rows.map(r => r.weight);
  const avg7    = rollingAvg(rows, weights);

  const extDates   = [...dates];
  const extWeights = [...weights];
  const extAvg7    = [...avg7];
  const extGoal    = rows.map(() => GOAL_WEIGHT);
  const extProj    = rows.map(() => null);

  if(reg){
    const lastDate    = wAll[wAll.length - 1].date;
    const projHorizon = new Date(lastDate);
    projHorizon.setDate(projHorizon.getDate() + 60);

    let d = new Date(lastDate);
    d.setDate(d.getDate() + 1);
    while(d <= projHorizon){
      const ds = d.toISOString().slice(0, 10);
      extDates.push(ds);
      extWeights.push(null);
      extAvg7.push(null);
      extGoal.push(GOAL_WEIGHT);
      extProj.push(null);
      d = new Date(d);
      d.setDate(d.getDate() + 1);
    }

    const lastDs = wAll[wAll.length - 1].dateStr;
    const li     = extDates.indexOf(lastDs);
    if(li >= 0) extProj[li] = wAll[wAll.length - 1].weight;
    extDates.forEach((ds, i) => {
      if(i <= li) return;
      const t = new Date(ds + 'T12:00:00').getTime();
      extProj[i] = parseFloat(reg.predict(t).toFixed(2));
    });
  }

  destroyChart('weight');
  charts.weight = new Chart(document.getElementById('chart-weight'), {
    type: 'line',
    data: {
      labels: extDates,
      datasets: [
        { label: 'Weight (kg)', data: extWeights, borderColor: C.weight, backgroundColor: alpha(C.weight, 0.08), borderWidth: 1.5, pointRadius: 2, pointHoverRadius: 4, spanGaps: false, fill: true, tension: 0.3, order: 1 },
        { label: '7d avg',      data: extAvg7,    borderColor: alpha(C.weight, 0.8), backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, spanGaps: true, tension: 0.4, order: 2 },
        { label: 'Goal (78.6 kg)', data: extGoal, borderColor: C.goal, backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, spanGaps: true, order: 3 },
        { label: 'Projection',  data: extProj,    borderColor: C.proj, backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, spanGaps: true, tension: 0.1, order: 4 },
      ]
    },
    options: { ...chartOpts({ yLabel: 'kg' }), maintainAspectRatio: false }
  });
}

// ── Body Composition ───────────────────────────────────────
function renderBodyComp(){
  const rows  = filteredRows;
  const dates = rows.map(r => r.label);

  const weights = rows.map(r => r.weight);
  const leans   = rows.map(r => r.leanMass);
  const fats    = rows.map(r => {
    if(r.weight !== null && r.leanMass !== null) return parseFloat((r.weight - r.leanMass).toFixed(2));
    return null;
  });
  const bmis = rows.map(r => r.bmi);

  destroyChart('bodyComp');
  charts.bodyComp = new Chart(document.getElementById('chart-body-comp'), {
    type: 'line',
    data: { labels: dates, datasets: [
      { label: 'Weight (kg)',   data: weights, borderColor: C.weight, backgroundColor: alpha(C.weight, 0.06), borderWidth: 2, pointRadius: 2, spanGaps: false, fill: false, tension: 0.3 },
      { label: 'Lean Mass (kg)', data: leans,  borderColor: C.lean,   backgroundColor: alpha(C.lean,   0.06), borderWidth: 2, pointRadius: 2, spanGaps: false, fill: false, tension: 0.3 },
      { label: 'Fat Mass (kg)', data: fats,    borderColor: C.fat,    backgroundColor: alpha(C.fat,    0.1),  borderWidth: 2, pointRadius: 2, spanGaps: false, fill: true,  tension: 0.3 },
    ]},
    options: chartOpts({ yLabel: 'kg' })
  });

  destroyChart('bmi');
  charts.bmi = new Chart(document.getElementById('chart-bmi'), {
    type: 'line',
    data: { labels: dates, datasets: [
      { label: 'BMI', data: bmis, borderColor: C.bmi, backgroundColor: alpha(C.bmi, 0.08), borderWidth: 2, pointRadius: 2, spanGaps: false, fill: true, tension: 0.3 }
    ]},
    options: chartOpts({ yLabel: 'count' })
  });

  const lastWaist = last(allRows, 'waist');
  const waistEl   = document.getElementById('waist-cards');
  if(lastWaist){
    const ago = Math.round((new Date() - lastWaist.date) / 864e5);
    waistEl.innerHTML = `
      <div class="card">
        <div class="card-label">Waist Circumference</div>
        <div class="card-value" style="color:var(--cyan)">${lastWaist.waist.toFixed(1)} cm</div>
        <div class="card-sub">Recorded ${lastWaist.dateStr} (${ago}d ago)</div>
      </div>`;

    const banner     = document.getElementById('waist-banner');
    const bannerText = document.getElementById('waist-banner-text');
    if(ago >= WAIST_DAYS){
      bannerText.innerHTML = `<strong>Waist measurement overdue</strong> — last recorded ${lastWaist.dateStr} (${ago} days ago). Measure your waist to keep your data current.`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  } else {
    waistEl.innerHTML = '<div class="card"><div class="card-label">Waist Circumference</div><div class="card-sub no-data-msg">No data yet</div></div>';
  }
}

// ── Cardiovascular ─────────────────────────────────────────
function renderCardio(){
  const rows  = filteredRows;
  const dates = rows.map(r => r.label);

  const hrAvg = rows.map(r => r.hrAvg);
  const hrMin = rows.map(r => r.hrMin);
  const hrMax = rows.map(r => r.hrMax);
  const bpSys = rows.map(r => r.bpSys);
  const bpDia = rows.map(r => r.bpDia);

  destroyChart('hrResting');
  charts.hrResting = new Chart(document.getElementById('chart-hr-resting'), {
    type: 'line',
    data: { labels: dates, datasets: [
      { label: 'HR Avg (bpm)', data: hrAvg, borderColor: C.hrAvg, backgroundColor: alpha(C.hrAvg, 0.1), borderWidth: 2, pointRadius: 2, spanGaps: false, fill: true, tension: 0.3 }
    ]},
    options: chartOpts({ yLabel: 'bpm' })
  });

  destroyChart('hrRange');
  charts.hrRange = new Chart(document.getElementById('chart-hr-range'), {
    type: 'line',
    data: { labels: dates, datasets: [
      { label: 'HR Max', data: hrMax, borderColor: alpha(C.hrMax, 0.4), backgroundColor: alpha(C.hrMax, 0.12), borderWidth: 1, pointRadius: 0, spanGaps: false, fill: '+1', tension: 0.3 },
      { label: 'HR Min', data: hrMin, borderColor: alpha(C.hrMin, 0.4), backgroundColor: 'transparent',         borderWidth: 1, pointRadius: 0, spanGaps: false, fill: false, tension: 0.3 },
      { label: 'HR Avg', data: hrAvg, borderColor: C.hrAvg,             backgroundColor: 'transparent',         borderWidth: 2, pointRadius: 0, spanGaps: false, fill: false, tension: 0.3 },
    ]},
    options: chartOpts({ yLabel: 'bpm' })
  });

  destroyChart('bp');
  const bpVals   = [...bpSys, ...bpDia].filter(v => v !== null);
  const bpYMin   = bpVals.length ? Math.floor(Math.min(...bpVals) - 10) : 0;
  const bpYMax   = bpVals.length ? Math.ceil(Math.max(...bpVals)  + 10) : 200;

  charts.bp = new Chart(document.getElementById('chart-bp'), {
    type: 'line',
    data: { labels: dates, datasets: [
      { label: 'Systolic',  data: bpSys, borderColor: C.sys,             backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, spanGaps: false, fill: false, tension: 0.3 },
      { label: 'Diastolic', data: bpDia, borderColor: alpha(C.dia, 0.5), backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, spanGaps: false, fill: false, tension: 0.3 },
    ]},
    options: {
      ...chartOpts({ yLabel: 'mmHg' }),
      scales: { ...chartOpts({ yLabel: 'mmHg' }).scales, y: { ...chartOpts({ yLabel: 'mmHg' }).scales.y, min: bpYMin, max: bpYMax } },
      plugins: {
        ...chartOpts({ yLabel: 'mmHg' }).plugins,
        annotation: (() => {
          const nutrition = cssVar('--color-accent-nutrition');
          const activity  = cssVar('--color-accent-activity');
          const blood     = cssVar('--color-accent-blood');
          const surface   = cssVar('--color-surface');
          const font9     = { size: 9, family: "'Geist', system-ui, sans-serif" };
          const pad       = { x: 4, y: 2 };
          return {
            annotations: {
              dia80: { type: 'line', yMin: 80, yMax: 80, borderColor: alpha(activity, 0.6), borderWidth: 1, borderDash: [4,4],
                label: { content: 'dia 80 · stage 1', display: true, position: 'start', color: activity, font: font9, padding: pad, backgroundColor: alpha(surface, 0.85) } },
              dia90: { type: 'line', yMin: 90, yMax: 90, borderColor: alpha(blood, 0.6), borderWidth: 1, borderDash: [4,4],
                label: { content: 'dia 90 · stage 2', display: true, position: 'start', color: blood,    font: font9, padding: pad, backgroundColor: alpha(surface, 0.85) } },
              sys120: { type: 'line', yMin: 120, yMax: 120, borderColor: alpha(activity, 0.6), borderWidth: 1,   borderDash: [4,4],
                label: { content: 'sys 120 · elevated', display: true, position: 'end', color: activity, font: font9, padding: pad, backgroundColor: alpha(surface, 0.85) } },
              sys130: { type: 'line', yMin: 130, yMax: 130, borderColor: alpha(blood, 0.5), borderWidth: 1,   borderDash: [4,4],
                label: { content: 'sys 130 · stage 1',  display: true, position: 'end', color: blood,    font: font9, padding: pad, backgroundColor: alpha(surface, 0.85) } },
              sys140: { type: 'line', yMin: 140, yMax: 140, borderColor: alpha(blood, 0.8), borderWidth: 1.5, borderDash: [4,4],
                label: { content: 'sys 140 · stage 2',  display: true, position: 'end', color: blood,    font: font9, padding: pad, backgroundColor: alpha(surface, 0.85) } },
            }
          };
        })()
      }
    }
  });
}

// ── Activity ───────────────────────────────────────────────
function renderActivity(){
  const rows   = filteredRows;
  const dates  = rows.map(r => r.label);
  const steps   = rows.map(r => r.steps);
  const energy  = rows.map(r => r.activeEnergy);
  const dist    = rows.map(r => r.distance);
  const flights = rows.map(r => r.flights);

  const stepsAvg  = rollingAvg(rows, steps);
  const energyAvg = rollingAvg(rows, energy);

  destroyChart('steps');
  charts.steps = barWithAvg('chart-steps', dates, steps, stepsAvg, C.steps, 'Steps');

  destroyChart('activeEnergy');
  charts.activeEnergy = barWithAvg('chart-active-energy', dates, energy, energyAvg, C.energy, 'Active kJ');

  destroyChart('distance');
  charts.distance = new Chart(document.getElementById('chart-distance'), {
    type: 'bar',
    data: { labels: dates, datasets: [{ label: 'km', data: dist, backgroundColor: alpha(C.dist, 0.7), borderColor: C.dist, borderWidth: 1, borderRadius: 3 }]},
    options: chartOpts({ yLabel: 'km', barChart: true })
  });

  destroyChart('flights');
  charts.flights = new Chart(document.getElementById('chart-flights'), {
    type: 'bar',
    data: { labels: dates, datasets: [{ label: 'Flights', data: flights, backgroundColor: alpha(C.flights, 0.7), borderColor: C.flights, borderWidth: 1, borderRadius: 3 }]},
    options: chartOpts({ yLabel: 'flights', barChart: true })
  });
}

// ── Nutrition ──────────────────────────────────────────────
function renderNutrition(){
  const rows   = filteredRows;
  const dates  = rows.map(r => r.label);
  const diet    = rows.map(r => r.dietEnergy);
  const carbs   = rows.map(r => r.carbs);
  const protein = rows.map(r => r.protein);
  const fat     = rows.map(r => r.totalFat);
  const dietAvg = rollingAvg(rows, diet);

  const recent = rows.slice(-7);
  const avg7 = key => {
    const vals = recent.map(r => r[key]).filter(v => v !== null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0) : null;
  };
  document.getElementById('macro-summary').innerHTML = `
    <div class="macro-card"><div class="mc-label">Dietary Energy</div><div class="mc-val" style="color:${C.diet}">${avg7('dietEnergy') ?? '—'}</div><div class="mc-sub">kJ avg 7d</div></div>
    <div class="macro-card"><div class="mc-label">Carbs</div><div class="mc-val" style="color:${C.protein}">${avg7('carbs') ?? '—'}</div><div class="mc-sub">g avg 7d</div></div>
    <div class="macro-card"><div class="mc-label">Protein</div><div class="mc-val" style="color:${C.fat2}">${avg7('protein') ?? '—'}</div><div class="mc-sub">g avg 7d</div></div>
    <div class="macro-card"><div class="mc-label">Total Fat</div><div class="mc-val" style="color:${C.fat}">${avg7('totalFat') ?? '—'}</div><div class="mc-sub">g avg 7d</div></div>
  `;

  destroyChart('dietEnergy');
  charts.dietEnergy = barWithAvg('chart-diet-energy', dates, diet, dietAvg, C.diet, 'kJ');

  destroyChart('macros');
  charts.macros = new Chart(document.getElementById('chart-macros'), {
    type: 'bar',
    data: { labels: dates, datasets: [
      { label: 'Carbs (g)',   data: carbs,   backgroundColor: alpha(C.protein, 0.75), borderColor: C.protein, borderWidth: 0, borderRadius: 2, stack: 'macro' },
      { label: 'Protein (g)', data: protein, backgroundColor: alpha(C.fat2,    0.75), borderColor: C.fat2,    borderWidth: 0, borderRadius: 2, stack: 'macro' },
      { label: 'Fat (g)',     data: fat,     backgroundColor: alpha(C.fat,     0.75), borderColor: C.fat,     borderWidth: 0, borderRadius: 2, stack: 'macro' },
    ]},
    options: chartOpts({ yLabel: 'g', barChart: true, stacked: true })
  });
}

// ── Walking Quality ────────────────────────────────────────
function renderWalking(){
  const rows  = filteredRows;
  const dates = rows.map(r => r.label);

  const makeLineChart = (id, key, color, yLabel, refLine = null) => {
    const data = rows.map(r => r[key]);
    const opts = chartOpts({ yLabel });
    if(refLine !== null){
      opts.plugins = {
        ...opts.plugins,
        annotation: { annotations: {
          ref: { type: 'line', yMin: refLine, yMax: refLine, borderColor: '#ef444466', borderWidth: 1.5, borderDash: [5, 4],
            label: { content: `${refLine}%`, enabled: true, position: 'end', color: '#ef4444', font: { size: 10 } } }
        }}
      };
    }
    return new Chart(document.getElementById(id), {
      type: 'line',
      data: { labels: dates, datasets: [{ label: yLabel, data, borderColor: color, backgroundColor: alpha(color, 0.1), borderWidth: 2, pointRadius: 2, spanGaps: false, fill: true, tension: 0.3 }]},
      options: opts
    });
  };

  destroyChart('wspeed');  charts.wspeed  = makeLineChart('chart-wspeed',  'walkSpeed', C.wspeed,  'km/h');
  destroyChart('wstep');   charts.wstep   = makeLineChart('chart-wstep',   'walkStep',  C.wstep,   'cm');
  destroyChart('wasym');   charts.wasym   = makeLineChart('chart-wasym',   'walkAsym',  C.wasym,   '%', 5);
  destroyChart('wdouble'); charts.wdouble = makeLineChart('chart-wdouble', 'walkDouble', C.wdouble, '%');
}

// ── Chart helpers ──────────────────────────────────────────
function destroyChart(key){
  if(charts[key]){ charts[key].destroy(); delete charts[key]; }
}

function barWithAvg(id, labels, barData, avgData, color, yLabel){
  return new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets: [
      { type: 'bar',  label: yLabel,   data: barData, backgroundColor: alpha(color, 0.55), borderColor: alpha(color, 0.8), borderWidth: 1, borderRadius: 3 },
      { type: 'line', label: '7d avg', data: avgData, borderColor: color, backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, spanGaps: true, tension: 0.4, order: 0 },
    ]},
    options: chartOpts({ yLabel, barChart: true })
  });
}

function chartOpts({ yLabel = '', barChart = false, stacked = false } = {}){
  const gridColor  = cssVar('--color-border');
  const tickColor  = cssVar('--color-text-muted');
  const labelColor = cssVar('--color-text-muted');

  return {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid:  { color: gridColor },
        ticks: { maxTicksLimit: 10, maxRotation: 0, color: tickColor, font: { size: 10 } }
      },
      y: {
        grid:  { color: gridColor },
        ticks: { color: tickColor, font: { size: 10 } },
        title: { display: !!yLabel, text: yLabel, color: labelColor, font: { size: 10 } },
        stacked: stacked || undefined,
      }
    },
    plugins: {
      legend: {
        display: true,
        labels: { color: cssVar('--color-text-secondary'), boxWidth: 12, padding: 10 }
      },
      tooltip: {
        callbacks: {
          title: items => items[0]?.label || '',
          label: item => {
            const v = item.raw;
            if(v === null || v === undefined) return null;
            return ` ${item.dataset.label}: ${typeof v === 'number' ? v.toFixed(1) : v}`;
          }
        }
      }
    }
  };
}

// ── Insights engine ────────────────────────────────────────
function nAvg(rows, key, n){
  const vals = rows.slice(-n).map(r => r[key]).filter(v => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function windowAvg(rows, key, offsetFromEnd, count){
  const s    = Math.max(0, rows.length - offsetFromEnd - count);
  const e    = Math.max(0, rows.length - offsetFromEnd);
  const vals = rows.slice(s, e).map(r => r[key]).filter(v => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function dataCount(rows, key){ return rows.filter(r => r[key] !== null).length; }

function slopePerDay(rows, key, n){
  const pts = rows.slice(-n).filter(r => r[key] !== null)
    .map(r => [r.date.getTime() / 864e5, r[key]]);
  if(pts.length < 4) return null;
  const mx  = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my  = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
  const den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  return den ? num / den : null;
}

function fmt1(n){ return n !== null ? n.toFixed(1) : '—'; }
function fmtDate(d){ return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

function block(type, html){ return `<div class="insight-block insight-${type}">${html}</div>`; }
function pos(html)     { return block('positive', html); }
function warn(html)    { return block('warning',  html); }
function neutral(html) { return block('neutral',  html); }

function setInsight(id, blocks){
  const el = document.getElementById(id);
  if(el) el.innerHTML = blocks.join('');
}

function renderInsights(){
  const rows = filteredRows;

  // 1. Weight Loss Goal
  (() => {
    const out   = [];
    const wRows = rows.filter(r => r.weight !== null);
    if(wRows.length < 7){ setInsight('insight-goal', out); return; }

    const slope7 = slopePerDay(rows, 'weight', 14);
    const rate7w = slope7 !== null ? slope7 * 7 : null;

    if(rate7w !== null){
      if(rate7w > -0.1 && rate7w <= 0.05){
        out.push(warn(`Your weight has been <strong>fairly stable</strong> over the past week — if that's intentional, great. If not, it might be worth taking a closer look at your activity and intake.`));
      } else if(rate7w < -0.7){
        out.push(warn(`You're losing weight at quite a <strong>fast pace</strong> right now (around ${Math.abs(rate7w).toFixed(1)} kg/week). Losing weight this quickly can sometimes mean you're shedding muscle alongside fat — it's worth keeping an eye on your lean mass and making sure your protein intake is adequate.`));
      } else if(rate7w < -0.3){
        out.push(pos(`You're in the <strong>ideal loss range</strong> — fast enough to make real progress, gentle enough to preserve muscle. Keep it up.`));
      } else if(rate7w < -0.1){
        out.push(pos(`You're making <strong>steady, sustainable progress</strong>. Slow and steady is genuinely one of the most effective approaches for long-term weight loss.`));
      }
    }

    const wAll    = allRows.filter(r => r.weight !== null);
    const reg     = linearRegression(wAll.map(r => r.date), wAll.map(r => r.weight));
    if(reg && reg.slope < 0 && GOAL_WEIGHT && GOAL_DATE){
      const etaDate  = new Date((GOAL_WEIGHT - reg.intercept) / reg.slope);
      const today    = new Date();
      const goalFmt  = GOAL_DATE.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const goalWFmt = `${GOAL_WEIGHT} kg`;
      if(etaDate > today){
        if(etaDate < new Date(GOAL_DATE.getTime() - 42 * 864e5)){
          out.push(pos(`At your current trend, you're on pace to reach <strong>${goalWFmt} around ${fmtDate(etaDate)}</strong> — well ahead of your ${goalFmt} goal. That's great, though it's worth making sure the pace feels sustainable.`));
        } else if(etaDate > GOAL_DATE){
          out.push(warn(`At your current trend, you're projected to reach ${goalWFmt} around <strong>${fmtDate(etaDate)}</strong> — a little behind your ${goalFmt} target. No need to panic; trends can shift, but it might be worth a small nudge in activity or intake.`));
        } else {
          out.push(neutral(`At your current trend, you're on pace to reach <strong>${goalWFmt} around ${fmtDate(etaDate)}</strong> — right around your ${goalFmt} goal.`));
        }
      }
    }

    setInsight('insight-goal', out);
  })();

  // 2. Body Composition
  (() => {
    const out  = [];
    const hasW = dataCount(rows, 'weight')   >= 14;
    const hasL = dataCount(rows, 'leanMass') >= 14;

    if(!hasW || !hasL){
      if(hasW && !hasL) out.push(neutral(`<em>Lean mass data isn't available yet — without it we can't tell whether you're losing fat or muscle. Logging body composition data will unlock this insight.</em>`));
      setInsight('insight-body', out); return;
    }

    const wSlope = slopePerDay(rows, 'weight',   14);
    const lSlope = slopePerDay(rows, 'leanMass', 14);

    if(wSlope !== null && lSlope !== null && wSlope < -0.01){
      const leanLossFraction = lSlope / wSlope;
      if(leanLossFraction > 0.4){
        out.push(warn(`There's a pattern worth watching: your <strong>lean mass has been declining</strong> alongside your weight. This can happen when losing weight quickly or when protein intake is on the lower side. It's not cause for alarm yet, but bumping up your protein could help protect that muscle.`));
      } else if(lSlope >= -0.01){
        out.push(pos(`Good sign — your <strong>lean mass looks stable</strong> while your weight is coming down. That's the ideal scenario: you're losing fat, not muscle.`));
      }
    }

    const bmiRows = rows.filter(r => r.bmi !== null);
    if(bmiRows.length >= 2){
      const recent = bmiRows[bmiRows.length - 1].bmi;
      const older  = bmiRows[Math.max(0, bmiRows.length - 14)].bmi;
      [[30, 'obese', 'overweight'], [25, 'overweight', 'normal']].forEach(([threshold, from, to]) => {
        if(older >= threshold && recent < threshold){
          out.push(pos(`Your BMI has just moved from the <strong>${from}</strong> range into <strong>${to}</strong> — a meaningful milestone worth acknowledging.`));
        }
      });
    }

    setInsight('insight-body', out);
  })();

  // 3. Cardiovascular
  (() => {
    const out = [];

    if(dataCount(rows, 'hrAvg') >= 14){
      const last7 = nAvg(rows, 'hrAvg', 7);
      const prev7 = windowAvg(rows, 'hrAvg', 7, 7);
      if(last7 !== null && prev7 !== null){
        const delta = last7 - prev7;
        if(delta < -3){
          out.push(pos(`Your average <strong>heart rate has been trending downward</strong> — a sign your cardiovascular fitness is improving. Keep up the consistency.`));
        } else if(delta > 5){
          out.push(warn(`Your <strong>resting heart rate has crept up</strong> a little over the past two weeks. This sometimes reflects fatigue, stress, or a dip in activity — nothing to worry about from a short window, but worth keeping in mind.`));
        }
      }
    }

    if(dataCount(rows, 'bpSys') >= 7 && dataCount(rows, 'bpDia') >= 7){
      const sysAvg = nAvg(rows, 'bpSys', 7);
      const diaAvg = nAvg(rows, 'bpDia', 7);
      const prevSys = windowAvg(rows, 'bpSys', 7, 7);

      if(sysAvg !== null && diaAvg !== null){
        if(sysAvg >= 130 || diaAvg >= 85){
          out.push(warn(`Your blood pressure has been sitting in the <strong>elevated range</strong> more often than not lately (recent avg: ${fmt1(sysAvg)}/${fmt1(diaAvg)} mmHg). This is a trend worth keeping an eye on — if it continues, it would be worth mentioning to your doctor.`));
        } else if(sysAvg < 120 && diaAvg < 80){
          out.push(pos(`Blood pressure is looking <strong>consistently healthy</strong> (recent avg: ${fmt1(sysAvg)}/${fmt1(diaAvg)} mmHg) — that's great to see.`));
        }

        if(prevSys !== null && sysAvg - prevSys > 5){
          const wSlope = slopePerDay(rows, 'weight', 14);
          if(wSlope !== null && wSlope < -0.05){
            out.push(warn(`Interesting pattern: your weight is coming down but your <strong>blood pressure has been nudging up</strong>. This doesn't always mean something is wrong — it can sometimes reflect dietary changes or stress — but it's worth keeping an eye on.`));
          }
        }
      }
    }

    setInsight('insight-cardio', out);
  })();

  // 4. Activity
  (() => {
    const out = [];

    if(dataCount(rows, 'steps') >= 14){
      const last14 = nAvg(rows, 'steps', 14);
      const prev14 = windowAvg(rows, 'steps', 14, 14);

      if(last14 !== null){
        if(last14 < 5000){
          out.push(warn(`Your daily step count has been <strong>on the lower side</strong> lately (avg ${Math.round(last14).toLocaleString()} steps). Even a short walk each day can make a meaningful difference — both for weight loss and cardiovascular health.`));
        } else if(prev14 !== null){
          const change = (last14 - prev14) / prev14;
          if(change > 0.1){
            out.push(pos(`You've been <strong>noticeably more active</strong> lately — your step count is up ${Math.round(change * 100)}% compared to the two weeks before. That's going to compound your progress.`));
          } else if(change < -0.2){
            out.push(warn(`Your <strong>activity level has dipped</strong> compared to the previous two weeks (down ${Math.round(Math.abs(change) * 100)}%). Life happens — but if it continues it'll make progress harder to sustain.`));
          }
        }
      }
    }

    if(dataCount(rows, 'dietEnergy') >= 7 && dataCount(rows, 'activeEnergy') >= 7){
      const dietAvg   = nAvg(rows, 'dietEnergy',   7);
      const activeAvg = nAvg(rows, 'activeEnergy',  7);
      const wSlope    = slopePerDay(rows, 'weight', 14);
      if(dietAvg !== null && activeAvg !== null && wSlope !== null){
        if(dietAvg > 10000 && activeAvg < 1500 && Math.abs(wSlope * 7) < 0.1){
          out.push(warn(`There might be an <strong>imbalance between intake and output</strong> — intake is on the higher side while active energy burn is relatively low, and weight hasn't been moving much. Neither number is bad on its own, but together they could be making progress harder.`));
        }
      }
    }

    setInsight('insight-activity', out);
  })();

  // 5. Nutrition
  (() => {
    const out = [];

    if(rows.length >= 5){
      let gap = 0, maxGap = 0;
      rows.slice(-14).forEach(r => { r.dietEnergy === null ? gap++ : (maxGap = Math.max(maxGap, gap), gap = 0); });
      maxGap = Math.max(maxGap, gap);
      if(maxGap >= 5){
        out.push(neutral(`Nutrition data appears to be <strong>missing for several days</strong> in a row, so conclusions here are limited. Logging consistently — even roughly — makes these insights much more useful.`));
        setInsight('insight-nutrition', out); return;
      }
    }

    if(dataCount(rows, 'dietEnergy') < 7){ setInsight('insight-nutrition', out); return; }

    const dietAvg = nAvg(rows, 'dietEnergy', 7);
    if(dietAvg !== null && dietAvg < 5000){
      out.push(warn(`Your logged calorie intake has been <strong>quite low</strong> this week (avg ${Math.round(dietAvg).toLocaleString()} kJ). While eating less drives weight loss, going too low for too long can slow your metabolism and lead to muscle loss. Make sure you're eating enough to fuel your body.`));
    }

    if(dataCount(rows, 'protein') >= 7){
      const protAvg   = nAvg(rows, 'protein', 7);
      const curWeight = rows.filter(r => r.weight !== null).slice(-1)[0]?.weight;
      if(protAvg !== null && curWeight !== null){
        const ratio  = protAvg / curWeight;
        const target = Math.round(curWeight * 1.6 / 5) * 5;
        if(ratio < 1.2){
          out.push(warn(`Your <strong>protein intake looks a little low</strong> relative to your body weight (avg ${Math.round(protAvg)}g/day, ~${ratio.toFixed(1)}g per kg). During weight loss, protein is your best ally for preserving muscle — aiming for around <strong>${target}g/day</strong> would be a good target.`));
        } else {
          out.push(pos(`Your <strong>protein intake is solid</strong> (avg ${Math.round(protAvg)}g/day, ~${ratio.toFixed(1)}g per kg) — that's going to help you hold onto muscle as you lose weight.`));
        }
      }
    }

    setInsight('insight-nutrition', out);
  })();

  // 6. Walking Quality
  (() => {
    const out = [];

    if(dataCount(rows, 'walkAsym') >= 7){
      const asymAvg = nAvg(rows, 'walkAsym', 7);
      if(asymAvg !== null && asymAvg > 5){
        out.push(warn(`Your <strong>walking asymmetry has been above 5%</strong> on average lately (avg ${fmt1(asymAvg)}%). A small amount is perfectly normal, but a persistent imbalance can sometimes point to a subtle gait difference or muscle imbalance on one side — might be worth mentioning to a physio if it sticks around.`));
      }
    }

    if(dataCount(rows, 'walkSpeed') >= 14){
      const slopeSpeed = slopePerDay(rows, 'walkSpeed', 14);
      const slopeStep  = slopePerDay(rows, 'walkStep',  14);
      if(slopeSpeed !== null && slopeStep !== null){
        const speedDrop = slopeSpeed * 14;
        const stepGain  = slopeStep  * 14;
        if(speedDrop < -0.3){
          out.push(warn(`Your <strong>walking speed has gradually slowed</strong> over the past couple of weeks (down ~${Math.abs(speedDrop).toFixed(1)} km/h). This can just be day-to-day variation, but a sustained decline is occasionally an early sign of fatigue or reduced fitness.`));
        } else if(speedDrop > 0.1 || stepGain > 2){
          out.push(pos(`Your <strong>walking metrics are looking stronger</strong> — speed and stride trending in the right direction. A good sign of improving fitness.`));
        }
      }
    }

    setInsight('insight-walking', out);
  })();
}

// ── Render all sections ────────────────────────────────────
function renderAll(){
  // Refresh theme-aware colors and Chart.js defaults before rendering
  updateColors();
  applyChartDefaults();

  const range = filteredRows.length;
  const first = filteredRows[0]?.dateStr || '—';
  const last2 = filteredRows[filteredRows.length - 1]?.dateStr || '—';
  document.getElementById('data-range-label').textContent =
    range ? `${first} → ${last2} · ${range} days` : 'No data';

  renderGoal();
  renderBodyComp();
  renderCardio();
  renderActivity();
  renderNutrition();
  renderWalking();
  renderInsights();

  // Apply accordion states without animation after each render
  SECTIONS.forEach(k => applyAccordionState(k, false));
}

// ── Load CSV file ──────────────────────────────────────────
function loadFile(file){
  if(!file || !file.name.endsWith('.csv')){ alert('Please load a .csv file.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    allRows = parseCSV(e.target.result);
    if(!allRows.length){ alert('No data found. Check your CSV format.'); return; }
    activeFilter = 0;
    setActiveFilterBtn(0);
    document.getElementById('dropzone').style.display  = 'none';
    document.getElementById('dashboard').style.display = 'block';
    applyFilter();
  };
  reader.readAsText(file);
}

// ── Filter buttons ─────────────────────────────────────────
function setActiveFilterBtn(days){
  document.querySelectorAll('.filter-btn[data-days]').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.days) === days);
  });
}

document.querySelectorAll('.filter-btn[data-days]').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = parseInt(btn.dataset.days);
    setActiveFilterBtn(activeFilter);
    applyFilter();
  });
});

document.getElementById('reload-btn').addEventListener('click', () => {
  document.getElementById('dashboard').style.display  = 'none';
  document.getElementById('dropzone').style.display   = 'block';
  document.getElementById('waist-banner').style.display = 'none';
  allRows = []; filteredRows = [];
  Object.keys(charts).forEach(k => destroyChart(k));
});

// ── Drag-and-drop ──────────────────────────────────────────
const dz = document.getElementById('dropzone');
dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', ()  => dz.classList.remove('drag-over'));
dz.addEventListener('drop',      e => { e.preventDefault(); dz.classList.remove('drag-over'); loadFile(e.dataTransfer.files[0]); });
dz.addEventListener('click',     ()  => document.getElementById('file-input').click());
dz.addEventListener('keydown',   e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); document.getElementById('file-input').click(); } });

document.getElementById('browse-btn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', e => loadFile(e.target.files[0]));

// ── Section accordions ─────────────────────────────────────
// All default closed. Insights + stat cards always visible; only charts collapse.
const SECTIONS = ['goal', 'body', 'cardio', 'activity', 'nutrition', 'walking'];
const accordionOpen = {};
SECTIONS.forEach(k => accordionOpen[k] = false);

function applyAccordionState(key, animate) {
  const header  = document.getElementById(`toggle-${key}`);
  const chevron = document.getElementById(`chevron-${key}`);
  if(!header) return;

  const open    = accordionOpen[key];
  const section = header.closest('.section');

  if(!animate) {
    // Suppress CSS transitions for instant state changes (initial render)
    section?.classList.add('no-transition');
    requestAnimationFrame(() => section?.classList.remove('no-transition'));
  }

  // All visual state (height, margin-top, overflow) is driven by CSS via this class
  section?.classList.toggle('is-collapsed', !open);
  chevron?.classList.toggle('open', open);
  header.setAttribute('aria-expanded', String(open));

  // Resize charts after the open animation completes
  if(animate && open) {
    setTimeout(() => Object.values(charts).forEach(c => { try { c.resize(); } catch(_){} }), 400);
  }
}

SECTIONS.forEach(key => {
  const header = document.getElementById(`toggle-${key}`);
  if(!header) return;

  header.addEventListener('click', () => {
    accordionOpen[key] = !accordionOpen[key];
    applyAccordionState(key, true);
  });
  header.addEventListener('keydown', e => {
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); header.click(); }
  });
});

// ── Theme toggle ───────────────────────────────────────────
function setTheme(dark) {
  if(dark){
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-toggle').textContent = '☀ Light';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-toggle').textContent = '⏾ Dark';
  }
  localStorage.setItem('hd-theme', dark ? 'dark' : 'light');
  // Re-render charts with new theme colors if data is loaded
  if(filteredRows.length) renderAll();
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(!isDark);
});

// Restore saved preference — default to dark
const savedTheme = localStorage.getItem('hd-theme');
setTheme(savedTheme ? savedTheme === 'dark' : true);

// ── Settings helpers ───────────────────────────────────────
function saveSettings(weight, dateStr) {
  GOAL_WEIGHT = weight;
  GOAL_DATE   = new Date(dateStr);
  localStorage.setItem('hd_goal_weight', weight);
  localStorage.setItem('hd_goal_date',   dateStr);
}

function validateSettingsForm(weightInput, dateInput) {
  const weightErr = weightInput.parentElement.querySelector('.field-error');
  const dateErr   = dateInput.parentElement.querySelector('.field-error');
  let valid = true;

  const w = parseFloat(weightInput.value);
  if(!weightInput.value || isNaN(w) || w < 30 || w > 300) {
    weightErr.textContent = 'Enter a weight between 30 and 300 kg.';
    valid = false;
  } else {
    weightErr.textContent = '';
  }

  const d = new Date(dateInput.value);
  if(!dateInput.value || isNaN(d.getTime()) || d <= new Date()) {
    dateErr.textContent = 'Enter a date in the future.';
    valid = false;
  } else {
    dateErr.textContent = '';
  }

  return valid;
}

// ── Onboarding screen ──────────────────────────────────────
function showOnboarding() {
  const ob = document.getElementById('onboarding');
  ob.style.display = 'flex';
  document.getElementById('dropzone').style.display   = 'none';
  document.getElementById('dashboard').style.display  = 'none';

  document.getElementById('ob-form').addEventListener('submit', e => {
    e.preventDefault();
    const wInput = document.getElementById('ob-weight');
    const dInput = document.getElementById('ob-date');
    if(!validateSettingsForm(wInput, dInput)) return;
    saveSettings(parseFloat(wInput.value), dInput.value);
    ob.style.display = 'none';
    document.getElementById('dropzone').style.display = 'block';
  });
}

// ── Settings modal ─────────────────────────────────────────
function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal.style.display = 'flex';
  document.getElementById('st-weight').value = GOAL_WEIGHT || '';
  document.getElementById('st-date').value   = localStorage.getItem('hd_goal_date') || '';

  // Clear any previous errors
  modal.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('st-cancel').addEventListener('click', closeSettings);

document.getElementById('settings-modal').addEventListener('click', e => {
  if(e.target === document.getElementById('settings-modal')) closeSettings();
});

document.getElementById('st-form').addEventListener('submit', e => {
  e.preventDefault();
  const wInput = document.getElementById('st-weight');
  const dInput = document.getElementById('st-date');
  if(!validateSettingsForm(wInput, dInput)) return;
  saveSettings(parseFloat(wInput.value), dInput.value);
  closeSettings();
  if(filteredRows.length) renderAll();
});

document.getElementById('st-reset').addEventListener('click', () => {
  const confirm = document.getElementById('st-reset-confirm');
  confirm.style.display = confirm.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('st-reset-yes').addEventListener('click', () => {
  localStorage.removeItem('hd_goal_weight');
  localStorage.removeItem('hd_goal_date');
  GOAL_WEIGHT = null;
  GOAL_DATE   = null;
  closeSettings();
  document.getElementById('dashboard').style.display  = 'none';
  document.getElementById('dropzone').style.display   = 'none';
  showOnboarding();
});

document.getElementById('st-reset-no').addEventListener('click', () => {
  document.getElementById('st-reset-confirm').style.display = 'none';
});

// ── Init ───────────────────────────────────────────────────
if(!GOAL_WEIGHT || !GOAL_DATE) {
  showOnboarding();
}
