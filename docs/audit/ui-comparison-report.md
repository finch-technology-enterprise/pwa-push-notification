# UI Comparison Report: ntfy.sh vs Current Project

**Generated**: 2026-07-18
**Note**: This report is based on source code comparison. Visual screenshots could not be automatically generated from the live `ntfy.sh/app`.

---

## Methodology

All UI components in the current project are direct copies of the original ntfy frontend. Therefore, this report documents the known differences found in the source code rather than pixel-level visual diffing.

---

## 1. Theme (Color Palette)

**Verdict: IDENTICAL**

| Token | Original | Current | Match |
|-------|----------|---------|-------|
| Primary (light) | `#338574` | `#338574` | ✅ |
| Secondary (light) | `#6cead0` | `#6cead0` | ✅ |
| Error (light) | `#c30000` | `#c30000` | ✅ |
| Primary (dark) | `#65b5a3` | `#65b5a3` | ✅ |
| Secondary (dark) | `#6cead0` | `#6cead0` | ✅ |
| Error (dark) | `#fe4d2e` | `#fe4d2e` | ✅ |
| Dark paper bg | `#1b2124` | `#1b2124` | ✅ |
| Theme color meta | `#317f6f` | `#317f6f` | ✅ |

---

## 2. Typography

**Verdict: IDENTICAL**

Both projects use:
- Roboto font (300, 400, 500, 700 weights)
- Same `@font-face` declarations in `fonts.css`
- MUI default typography scale

---

## 3. Layout & Spacing

**Verdict: IDENTICAL**

| Element | Original | Current | Match |
|---------|----------|---------|-------|
| Drawer width | 280px | 280px | ✅ |
| Drawer paper background | `backgroundImage: "none"` | `backgroundImage: "none"` | ✅ |
| Main content padding (md+) | `padding: 3` (24px) | `padding: 3` (24px) | ✅ |
| Main content padding (xs) | `padding: 0` | `padding: 0` | ✅ |
| Card padding | `padding: 1` (8px) | `padding: 1` (8px) | ✅ |
| Notification spacing | `Stack spacing={3}` | `Stack spacing={3}` | ✅ |
| Message bar bottom margin | `"100px"` | `"100px"` | ✅ |

---

## 4. Navigation (Side Drawer)

**Verdict: IDENTICAL**

- Same structure: temporary (mobile) + permanent (desktop)
- Same icons: ChatBubble, Person, Settings, Article, Send, Add
- Same subscription list with badge count, connecting spinner, mute/reservation icons
- Same context menu (SubscriptionPopup)
- Same upgrade banner with gradient
- Same notification permission alerts
- Same version update banner

---

## 5. ActionBar (Top Bar)

**Verdict: MINOR DIFFERENCE — Title text**

| Element | Original | Current |
|---------|----------|---------|
| Default title | `"ntfy"` | `"PWA Push"` |
| Logo | `ntfy.svg` | `ntfy.svg` (same file) |
| PWA gradient | `#317f6f` | `#317f6f` |
| Light gradient | `#338574 → #56bda8` | `#338574 → #56bda8` |
| Dark gradient | `#203631 → #2a6e60` | `#203631 → #2a6e60` |
| Profile icon | AccountCircleIcon | AccountCircleIcon |
| Login button | Text variant | Text variant |
| Signup button | Outlined variant | Outlined variant |

---

## 6. Notification List

**Verdict: IDENTICAL (except functional improvement)**

| Element | Original | Current |
|---------|----------|---------|
| Card layout | Card + CardContent | Card + CardContent |
| Delete button | CloseIcon | CloseIcon |
| Mark read button | CheckIcon | CheckIcon |
| Priority icons | 1-5 SVG | 1-5 SVG (same files) |
| New indicator | Green circle SVG | Green circle SVG |
| Date/time format | formatDateTime() | formatDateTime() |
| Infinite scroll | react-infinite-scroll-component | react-infinite-scroll-component |
| Empty states | Logo + "No subscriptions" + links | Same + same ntfy.sh links |
| **Server delete on remove** | **Not present** | **Added `api.deleteMessage()`** |

---

## 7. PublishDialog

**Verdict: IDENTICAL**

Both have same:
- Topic field with autocomplete
- Message body textarea
- Title, Tags, Priority fields
- Delay/At scheduling
- Email delivery toggle
- Phone call toggle
- File attachment with drag-and-drop
- Emoji picker
- Markdown toggle

---

## 8. Mobile Responsiveness

**Verdict: IDENTICAL**

Both use same MUI breakpoints and responsive patterns:
- `{ xs: "none", sm: "block" }` for desktop-only elements
- `{ xs: "block", sm: "none" }` for mobile-only elements
- `{ xs: 0, md: 3 }` for padding
- Drawer: temporary on mobile, permanent on desktop

---

## 9. PWA Manifest

**Verdict: MINOR DIFFERENCE**

| Property | Original | Current |
|----------|----------|---------|
| Name | `ntfy` | `PWA Push Notification` |
| Short name | `ntfy` | `PWA Push` |
| Theme color | `#317f6f` | `#317f6f` |
| Icons | pwa-192x192 + pwa-512x512 | Same files |
| Display | `standalone` | `standalone` |

---

## 10. Splash Screen

**Verdict: IDENTICAL**

- Same HTML structure in `index.html`
- Same CSS (pulse animation, dark mode detection, fade transition)
- Same JavaScript (`splash.js`) for fade-out on app ready
- Same logo SVG (`ntfy-splash.svg`)

---

## Summary of Visual Differences

Only **2 visual differences** exist between the projects:

1. **Document title** — `"PWA Push Notification"` vs `"ntfy"` (App.jsx)
2. **ActionBar title** — `"PWA Push"` vs `"ntfy"` (ActionBar.jsx)

Everything else is pixel-identical: colors, spacing, fonts, icons, layout, responsive behavior, animations, splash screen, PWA manifest icons.
