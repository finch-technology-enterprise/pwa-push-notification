# Repository Inventory: pwa-push-notification

**Generated**: 2026-07-18
**Root**: `/Users/johnlee/Documents/Repositories/finch-technology-enterprise/pwa-push-notification`

---

## Directory Tree (source files only — excludes node_modules, .git, build/)

```
pwa-push-notification/
├── .dev.vars                         # Local dev secrets (VAPID keys)
├── .gitignore
├── LICENSE                           # Apache 2.0
├── README.md                         # Project documentation
├── opencode.json                     # opencode AI config
├── package.json                      # Workspace root
├── tsconfig.json                     # Root TS config
├── wrangler.toml                     # Cloudflare Workers config
│
├── docs/
│   ├── api-mapping.md                # API parity mapping
│   ├── architecture.md               # System architecture
│   ├── audit.md                      # Previous audit report
│   ├── backend-parity-plan.md        # Backend parity plan
│   ├── database-design.md            # Database schema docs
│   └── audit/                        # NEW: Latest audit reports
│       ├── repository-inventory.md   # This file
│       ├── ntfy-reference-analysis.md
│       ├── current-project-analysis.md
│       ├── latest-audit-report.md
│       └── ui-comparison-report.md
│
├── packages/shared/
│   └── src/index.ts                  # Shared TypeScript types
│
├── worker/                           # Backend — Cloudflare Worker
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── migrations/0001_initial.sql   # SQL schema
│   └── src/
│       ├── index.ts                  # Hono app entry + WebSocket upgrade
│       ├── db.ts                     # D1 schema init + migrations
│       ├── types.ts                  # TypeScript type definitions
│       ├── middleware.ts             # Auth, hashing, tokens, sanitization
│       ├── do/topic.ts              # Topic Durable Object (realtime)
│       ├── routes/
│       │   ├── account.ts            # Account CRUD, tokens, phone, email, password reset
│       │   ├── admin.ts              # Admin user management
│       │   ├── attachment.ts         # R2 file upload/download
│       │   ├── billing.ts            # Tier listing, Stripe stubs
│       │   ├── call.ts               # Twilio phone calls
│       │   ├── cleanup.ts            # Cron cleanup
│       │   ├── config.ts             # /v1/config + /config.js
│       │   ├── email.ts              # Email sending via Cloudflare Email
│       │   ├── fcm.ts                # Firebase Cloud Messaging
│       │   ├── health.ts             # Health, version, stats
│       │   ├── matrix.ts             # Matrix push gateway
│       │   ├── metrics.ts            # Prometheus metrics
│       │   ├── rateLimit.ts          # Rate limiting logic
│       │   ├── topic.ts              # Publish/subscribe/delete/clear
│       │   └── webpush.ts            # Web Push subscriptions
│       └── __tests__/
│           ├── db.test.ts
│           ├── health.test.ts
│           ├── middleware.test.ts
│           └── topic.test.ts
│
└── web/                              # Frontend — React PWA
    ├── index.html
    ├── package.json
    ├── tsconfig.json / jsconfig.json
    ├── vite.config.ts                # Vite + PWA plugin config
    ├── vitest.config.js
    ├── public/                        # Static assets (served as-is)
    │   ├── sw.js                     # Service worker (Workbox)
    │   ├── manifest.webmanifest
    │   └── static/
    │       ├── css/app.css, fonts.css
    │       ├── fonts/ (4 Roboto .woff2)
    │       ├── images/ (10 PWA icons)
    │       └── langs/ (51 i18n .json)
    └── src/
        ├── index.jsx                 # React entry point
        ├── registerSW.js             # SW registration
        ├── img/                      # 14 SVG/PNG icons
        ├── sounds/                   # 7 MP3 notification sounds
        ├── test/setup.js
        ├── app/                      # Application logic (32 files)
        │   ├── AccountApi.js         # Account REST client
        │   ├── AccountApi.test.js
        │   ├── actions.js            # Action constants
        │   ├── Api.js                # HTTP API client
        │   ├── Api.test.js
        │   ├── config.js             # Runtime config
        │   ├── Connection.js         # WebSocket connection
        │   ├── ConnectionManager.js  # Multi-WS manager
        │   ├── db.js                 # Dexie/IndexedDB schema
        │   ├── emojis.js             # Emoji dataset
        │   ├── emojisMapped.js
        │   ├── errors.js             # Error classes
        │   ├── errors.test.js
        │   ├── events.js             # Event constants
        │   ├── i18n.js               # i18next init
        │   ├── i18n-sw.js            # i18n for SW
        │   ├── notificationUtils.js
        │   ├── notificationUtils.test.js
        │   ├── Notifier.js           # Desktop notifications
        │   ├── Poller.js             # HTTP polling fallback
        │   ├── Prefs.js              # Preferences
        │   ├── Prefs.test.js
        │   ├── Pruner.js             # IndexedDB cleanup
        │   ├── Session.js            # Auth session
        │   ├── splash.js             # Splash screen
        │   ├── SubscriptionManager.js
        │   ├── SubscriptionManager.test.js
        │   ├── transition.js         # Page transitions
        │   ├── UserManager.js        # Multi-server users
        │   ├── utils.js              # Utilities
        │   ├── utils.test.js
        │   └── VersionChecker.js     # Config change detection
        └── components/               # React components (34 files)
            ├── Account.jsx
            ├── AccountContext.js
            ├── ActionBar.jsx
            ├── App.jsx               # Root app + routing
            ├── AttachmentIcon.jsx
            ├── AvatarBox.jsx
            ├── DialogFooter.jsx
            ├── EmailVerify.jsx
            ├── EmojiPicker.jsx
            ├── ErrorBoundary.jsx
            ├── hooks.js              # Custom hooks
            ├── Login.jsx
            ├── MarkdownContent.jsx
            ├── Messaging.jsx
            ├── Navigation.jsx        # Side drawer
            ├── Notifications.jsx     # Notification list
            ├── PasswordReset.jsx
            ├── PasswordResetRequest.jsx
            ├── PopupMenu.jsx
            ├── Pref.jsx / PrefCache.jsx
            ├── Preferences.jsx
            ├── PublishDialog.jsx
            ├── ReserveDialogs.jsx
            ├── ReserveIcons.jsx
            ├── ReserveTopicSelect.jsx
            ├── routes.js
            ├── RTLCacheProvider.jsx
            ├── Signup.jsx
            ├── SubscribeDialog.jsx
            ├── SubscriptionPopup.jsx
            ├── styles.js
            ├── theme.js              # MUI theme config
            └── UpgradeDialog.jsx
```

---

## File Counts by Category

| Category | Count | Notes |
|----------|-------|-------|
| Worker source (TS) | 21 | Includes index, db, types, middleware, DO, 14 route files |
| Worker tests | 4 | Vitest |
| SQL migrations | 1 | 0001_initial.sql |
| Web source (JS/JSX) | 66 | 32 app + 34 components |
| Web tests | 8 | Vitest |
| Web static assets | 72 | 4 fonts, 10 images, 51 langs, 3 CSS, 1 SW, 1 manifest, 2 HTML |
| Web build output | 37 | Built assets (not source) |
| Shared package | 2 | index.ts + configs |
| Config files | 14 | wrangler, package.json × 3, tsconfig × 3, vite/vitest, etc. |
| Documentation | 10 | README.md + 5 docs/ + 5 docs/audit/ |
| Root files | 8 | LICENSE, .gitignore, opencode.json, etc. |
| **Total source** | **~218** | Excluding node_modules, .git, build/ |

---

## Ownership Mapping

| Category | Origin | Details |
|----------|--------|---------|
| All frontend components | Direct copy from ntfy | 34 components, theme, styles, routes, hooks |
| All app logic | Direct copy from ntfy | 32 modules with minor modifications |
| Static assets | Direct copy from ntfy | SVGs, icons, fonts, sounds, i18n files |
| Service worker | Adapted from ntfy | Workbox-based, i18n import differs |
| PWA manifest | Custom | Name changed to "PWA Push Notification" |
| Backend routes | Custom reimplementation | Cloudflare Workers, not Go |
| Database schema | Adapted from ntfy | 16 tables, D1 dialect |
| Durable Object | Custom | No Go equivalent |
| Documentation | Custom | All docs written for this project |
| Configuration | Custom | wrangler.toml vs ntfy server.yml |
