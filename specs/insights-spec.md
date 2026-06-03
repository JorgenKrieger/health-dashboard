# Health Dashboard — Coaching Insights Spec

## Overview

Each dashboard section gets an **insights block** rendered directly below the section title, above the charts. No cards — plain prose with light typographic emphasis. Think of it as a coach who has looked at your data and has a quick word before you dive into the graphs.

---

## Design & Typography

- Rendered as one or more short paragraphs (1–3 sentences each), not bullet lists
- Positive insights in a subtle green accent; warnings in amber; no red (red is reserved for the waist banner — a more urgent UI element)
- A small coloured left-border or leading dot to distinguish insight type at a glance, but no box/card chrome
- Font: Fira Sans, slightly smaller than body (0.9rem), color `--text-2` with keywords bolded in `--text`
- If there is nothing meaningful to say (too little data, all metrics nominal), show nothing — no "everything looks fine" filler

---

## Minimum Data Requirements

Do not emit an insight unless the relevant metric has **at least 7 days** of data. Insights that compare two windows (e.g. "last 14 vs previous 14 days") require **14 days** minimum. State the limitation inline if data is close but not quite there:

> *"Check back in a few days — not enough data yet to spot a trend here."*

---

## Section-by-section Rules

### 🎯 Weight Loss Goal

**Loss rate** — computed as kg/week over the last 7 days:

| Rate | Insight |
|------|---------|
| < 0.1 kg/week (sustained 14d) | *"Your weight has been fairly stable lately — if that's intentional, great. If not, it might be worth looking at your activity and intake this week."* |
| 0.1–0.3 kg/week | *"You're making steady, sustainable progress. Slow and steady is genuinely the most effective approach here."* |
| 0.3–0.7 kg/week | *"You're in the ideal loss range — fast enough to make real progress, gentle enough to preserve muscle."* |
| > 0.7 kg/week | *"Your pace is quite high right now. Losing weight this quickly can sometimes mean you're losing muscle alongside fat — worth keeping an eye on your lean mass and protein intake."* |

**Goal ETA** — always show a dynamic sentence:

> *"At your current 4-week trend, you're on pace to reach 78.6 kg around [date]."*

With a follow-up note if that date is ahead of or behind November 1, 2026.

**Rapid early arrival** (ETA more than 6 weeks before goal date):

> *"You're tracking to hit your goal well ahead of schedule. That's great — though it's worth asking whether this pace feels sustainable long-term."*

---

### 🏋️ Body Composition

**Muscle preservation** — requires both weight and lean mass data; compare rates of change over 14 days:

- If lean mass is falling at more than 40% the rate of total weight loss:
  > *"There's a pattern worth watching: your lean mass has been dipping alongside your weight. This can happen when losing weight quickly or when protein intake is low. It's not cause for alarm yet, but bumping up your protein could help protect that muscle."*

- If lean mass is stable or rising while weight falls:
  > *"Good sign: your lean mass looks stable while your weight is coming down. That's the ideal scenario — you're losing fat, not muscle."*

**BMI milestone** — one-time note when the 7-day average BMI crosses 30 or 25 for the first time in the dataset:

> *"Your BMI has moved into the [overweight / normal] range — a meaningful milestone."*

---

### 🫀 Cardiovascular Health

**Resting HR trend** — compare last 7-day average to previous 7-day average:

- Improving (down > 3 bpm):
  > *"Your average heart rate has been trending downward — a sign your cardiovascular fitness is improving."*

- Worsening (up > 5 bpm sustained):
  > *"Your resting heart rate has crept up a little over the past two weeks. This sometimes reflects fatigue, stress, or reduced activity — nothing to worry about from a single reading, but worth noticing."*

**BP zone** — based on 7-day average:

- Sys avg ≥ 130 or dia avg ≥ 85 sustained:
  > *"Your blood pressure readings have been sitting in the elevated range more often than not lately. This is a trend worth keeping an eye on — if it continues, it would be worth mentioning to your doctor."*

- Sys avg < 120 and dia avg < 80 consistently:
  > *"Blood pressure is looking consistently healthy — that's great to see."*

**BP + weight divergence** — weight falling but systolic BP rising over 14 days:

> *"Interesting pattern: your weight is coming down but your blood pressure has been nudging up. This doesn't always mean something is wrong, but it can sometimes reflect dietary changes or stress. Keep an eye on it."*

---

### 🏃 Activity

**Step count trend** — compare last 14-day average to previous 14-day average:

| Condition | Insight |
|-----------|---------|
| Rising > 10% | *"You've been noticeably more active lately — your step count is up. That's going to compound your progress."* |
| Falling > 20% | *"Your activity level has dipped compared to the previous two weeks. Life happens — but if it continues it'll be harder to hit your goal."* |
| Sustained avg < 5 000/day | *"Your daily steps have been on the lower side. Even a short walk can make a meaningful difference — both for weight loss and cardiovascular health."* |

**Activity vs intake imbalance** — if all three conditions are true simultaneously:
- 7-day avg dietary energy > 10 000 kJ, AND
- 7-day avg active energy < 1 500 kJ, AND
- weight not moving (< 0.1 kg/week change)

> *"There might be an imbalance between how much you're eating and how much you're moving. Neither number is bad on its own, but together they could be making progress harder."*

---

### 🥗 Nutrition

**Dietary energy too low** — 7-day avg < 5 000 kJ:

> *"Your logged calorie intake has been quite low this week. While eating less does drive weight loss, going too low for too long can make it harder for your body to function well and can lead to muscle loss. Make sure you're eating enough."*

**Protein adequacy** — if (7-day avg protein in grams) / current weight (kg) < 1.2:

> *"Your protein intake relative to your body weight looks a little low. During weight loss, protein is your best friend for preserving muscle — aiming for around [target]g/day would be a good place to start."*

Target = current weight (kg) × 1.6, rounded to nearest 5g.

**Logging gaps** — 5 or more consecutive days with no nutrition data:

> *"Nutrition data is missing for the past several days, so conclusions here are limited. Logging consistently — even roughly — gives much more useful insights."*

---

### 🚶 Walking Quality

**Asymmetry sustained > 5%** — 7-day average above threshold:

> *"Your walking asymmetry has been above 5% for a while. A small amount is normal, but a persistent imbalance can sometimes point to a subtle gait issue or muscle imbalance on one side. Might be worth mentioning to a physio if it continues."*

**Walking speed declining** — > 0.3 km/h drop over 14-day trend:

> *"Your walking speed has gradually slowed over the past couple of weeks. This can just be day-to-day variation, but a sustained decline is occasionally an early sign of fatigue or reduced fitness."*

**Improving gait** — speed or step length trending up over 14 days:

> *"Your walking metrics are looking stronger — speed and stride length both trending in the right direction."*

---

## Rules: What to Never Do

- Do not produce an insight from a single data point or a spike — minimum windows apply
- Do not use clinical language ("hypertension", "sarcopenia", "your BMI of X indicates") — describe the observation, not a diagnosis
- Do not show conflicting insights in the same section — if two conditions are simultaneously true, pick the most important one
- Do not repeat an insight that has been stable for weeks in a way that feels alarming — persistent conditions should feel like a standing note, not a fresh warning
