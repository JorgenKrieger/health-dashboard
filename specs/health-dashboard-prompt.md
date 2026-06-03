# Health Dashboard — AI Build Prompt

## Overview
Build a single-file personal health dashboard in **plain HTML/CSS/JS** (no frameworks, no build step). The user pastes a CSV export from Apple Health (via the HealthAutoExport app) directly into the page, and the dashboard renders automatically.

---

## Data Input

- Add a **"Load CSV" button** or a **drag-and-drop zone** at the top of the page.
- Parse the CSV client-side using JavaScript (no server needed).
- The CSV has this header row (columns may be missing or empty on some dates — handle gracefully):

```
Date/Time, Active Energy (kJ), Blood Pressure [Systolic] (mmHg), Blood Pressure [Diastolic] (mmHg), Body Mass Index (count), Carbohydrates (g), Dietary Energy (kJ), Flights Climbed (count), Heart Rate [Min] (count/min), Heart Rate [Max] (count/min), Heart Rate [Avg] (count/min), Lean Body Mass (kg), Protein (g), Resting Energy (kJ), Step Count (count), Toothbrushing (s), Total Fat (g), Waist Circumference (cm), Walking + Running Distance (km), Walking Asymmetry Percentage (%), Walking Double Support Percentage (%), Walking Speed (km/hr), Walking Step Length (cm), Water (mL), Weight (kg)
```

- Parse `Date/Time` as a date (format: `YYYY-MM-DD HH:MM:SS`).
- Treat empty cells as null/missing — never assume 0 for health metrics.

---

## Dashboard Sections

### 1. 🎯 Weight Loss Goal (top of page — most prominent)
- **Goal**: 78.6 kg by **November 1, 2026**
- Show current weight (most recent entry)
- Show kg remaining to goal
- Show days remaining to goal date
- Show a **projected trend line**: fit a linear regression to the weight data, extend it to November 1 — show whether the user is on track
- Show a **progress bar**: from starting weight (first entry) → goal weight
- Use a **line chart** (Chart.js is fine) showing:
  - Daily weight (dots + line)
  - 7-day rolling average
  - Goal line (flat at 78.6 kg)
  - Projected trend line (dashed, extrapolated to goal date)

### 2. 🏋️ Body Composition
- **Weight vs. Lean Body Mass** — dual-line chart over time
- Derived fat mass = Weight − Lean Body Mass — show as a third line or shaded area
- **BMI trend** — line chart (smaller)
- **Waist Circumference** — show last recorded value + date recorded
  - If last measurement is more than **30 days ago**, show a prominent reminder banner: *"⚠️ Waist measurement overdue — last recorded [date]"*

### 3. 🫀 Cardiovascular Health
- **Resting Heart Rate** trend — line chart (use Heart Rate [Avg] as proxy if resting HR not available)
- **Heart Rate range** (min/max) as a band chart — shaded area between min and max, average line through the middle
- **Blood Pressure** — dual line chart (systolic + diastolic), with reference lines at 120/80

### 4. 🏃 Activity
- **Step Count** — bar chart (daily) + 7-day rolling average line overlay
- **Active Energy (kJ)** — bar chart (daily) + 7-day rolling average
- **Walking + Running Distance (km)** — bar chart (daily)
- **Flights Climbed** — small bar chart or sparkline

### 5. 🥗 Nutrition (logged daily)
- **Dietary Energy (kJ)** — bar chart (daily) + 7-day rolling average
- **Macros over time**: Carbohydrates (g), Protein (g), Total Fat (g) — stacked bar chart or grouped bars
- Show a small summary card with **7-day averages** for each macro

### 6. 🚶 Walking Quality
- **Walking Speed** trend — line chart
- **Step Length** trend — line chart
- **Walking Asymmetry %** — line chart (lower = better; flag if consistently above 5%)
- **Double Support %** — line chart (lower = better gait)
- These are subtle fitness indicators — group them together in a collapsible section if needed

---

## General Requirements

- **All charts**: use [Chart.js](https://cdn.jsdelivr.net/npm/chart.js) loaded from CDN.
- **Single HTML file** — all CSS and JS inline.
- **Responsive** — works on desktop and mobile.
- **Handle missing data gracefully**: skip null points in charts, show "No data yet" in cards when a metric has never been recorded.
- **Date filtering**: add a simple date range filter (e.g. "Last 30 days / Last 90 days / All time") that updates all charts simultaneously.
- **Color coding**: use consistent colors per metric across all charts (e.g. weight is always the same blue).
- **Dark or light theme** — your choice, but commit to one and make it look polished.
- No external fonts that require a login or paid CDN — Google Fonts is fine.

---

## UX Notes
- The waist circumference reminder banner should be the **most visually prominent warning** on the page when triggered.
- The weight goal section should feel motivating — show progress clearly.
- Charts should have **tooltips** showing the exact value and date on hover.
- The page should work **entirely offline** after initial load (except CDN assets).
