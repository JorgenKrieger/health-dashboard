# Health Dashboard — Settings & Onboarding Spec

## Overview

The dashboard currently hardcodes the goal weight and goal date in JS. This spec replaces those constants with user-provided values, persisted in `localStorage`. A one-time onboarding screen collects the required details before the file picker is shown. A settings panel allows editing them at any time.

---

## Storage

Use `localStorage` (works with `file://` origins). Keys:

| Key | Value | Example |
|-----|-------|---------|
| `hd_goal_weight` | Float, kg | `78.6` |
| `hd_goal_date` | ISO date string | `2026-11-01` |

No expiry. Values persist until the user clears them via the settings panel or browser storage.

---

## Onboarding Screen

Shown **instead of** the drop zone when either `hd_goal_weight` or `hd_goal_date` is missing from localStorage.

### Layout

Centered card, same visual language as the drop zone. Two fields:

1. **Goal weight** — number input, kg, step 0.1, min 30, max 300, placeholder `e.g. 78.6`
2. **Goal date** — date input, min today, placeholder `e.g. 2026-11-01`

A single **Save & continue** button. On submit:
- Validate both fields are filled and values are sensible (weight > 0, date in the future)
- Save to localStorage
- Transition to the normal drop zone view (no page reload needed)

### Copy

```
Before we start, tell us your goal.

Goal weight (kg)   [________]
Target date        [________]

                   [Save & continue]
```

No skip option — these values are required for the dashboard to be meaningful.

---

## Settings Panel

Accessible at any time via a **Settings** button in the header controls bar (alongside the theme toggle). Opens as a modal overlay.

### Contents

- Same two fields as onboarding, pre-filled with current values
- **Save** button — validates, saves to localStorage, closes modal, re-renders the dashboard with new values
- **Cancel** button — closes without saving
- A **Reset all data** link at the bottom (text link, not a prominent button) — clears both localStorage keys and reloads the page back to the onboarding screen. Requires a confirmation step ("Are you sure? This will clear your settings." + Confirm / Cancel).

### Trigger

A ⚙ icon button or text button labelled "Settings" placed in `#controls`, to the left of the theme toggle.

---

## Integration with Dashboard JS

- On app init, read `hd_goal_weight` and `hd_goal_date` from localStorage and use them in place of the hardcoded `GOAL_WEIGHT` and `GOAL_DATE` constants.
- If either is missing, show the onboarding screen.
- After saving (onboarding or settings), update the in-memory values and call `renderAll()` to reflect changes immediately.
- The constants `GOAL_WEIGHT` and `GOAL_DATE` become `let` variables initialised from localStorage.

---

## Validation Rules

| Field | Rule |
|-------|------|
| Goal weight | Required, numeric, between 30–300 kg |
| Goal date | Required, valid date, must be in the future |

Show inline error messages below each field on failed validation. Do not use browser-native `alert()`.

---

## Design Notes

- Onboarding card should match the drop zone card in size, padding, and visual style
- Modal overlay: dark semi-transparent backdrop, centered card, same card styling as the rest of the UI
- Form inputs should use the existing CSS variable palette for borders, backgrounds, and focus states
- No framework, no build step — plain HTML form elements styled with existing CSS tokens
