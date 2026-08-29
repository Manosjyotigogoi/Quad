# Quad — Campus Marketplace (Fixed Version)

This is the fixed version of the Quad campus marketplace. All security
issues, bugs, and requested features from the security audit have been
addressed.

## ⚠️ Before you run this

### 1. Rotate your leaked secrets

The original `backend/.env` shipped with live secrets (MongoDB, Cloudinary,
Gmail SMTP, JWT). **Treat all of those as compromised** and rotate them
before running this project:

1. **MongoDB Atlas**: change the database user's password.
2. **Cloudinary**: regenerate the API secret in the Cloudinary dashboard.
3. **Gmail**: revoke the old App Password and create a new one.
4. **JWT_SECRET**: generate a new long random string (`openssl rand -hex 32`).

Then fill in the new values in `backend/.env` (which is now git-ignored
and ships with placeholder values).

### 2. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Seed categories

```bash
cd backend
npm run seed:categories
```

### 4. Run

```bash
# Terminal 1 — backend
cd backend
npm run dev

# Terminal 2 — frontend
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173`, the backend on `http://localhost:5000`.

### 5. Run tests (backend)

```bash
cd backend
npm test
```

## What was fixed

### Security (Priority 1)
- ✅ `.env` secrets replaced with placeholders; `.gitignore` added to both
  frontend and backend so secrets are never committed again.
- ✅ **Rate limiting** (`express-rate-limit`) on all auth routes — strict
  on `/login`, `/verify-otp`, `/reset-password`; looser on `/resend-otp`
  and `/forgot-password` to prevent email-bombing.
- ✅ **Helmet** for HTTP security headers (CSP, X-Frame-Options, etc.).
- ✅ **`express-mongo-sanitize`** strips `$` and `.` operators from
  request bodies/queries to prevent NoSQL injection.
- ✅ **CSRF protection** via the custom-header pattern — every
  state-changing request must carry `X-Requested-With: XMLHttpRequest`,
  which browser-initiated cross-site form POSTs can't set. The frontend
  `api.js` wrapper sets this automatically.
- ✅ **OTP brute-force lockout** — 5 wrong attempts invalidates the OTP
  and forces a resend.
- ✅ **Login brute-force lockout** — 5 wrong passwords locks the account
  for 15 minutes.
- ✅ **Account-enumeration fixes** — login/register/verify-otp now
  return generic messages instead of revealing whether an email is
  registered.
- ✅ `rel="noreferrer noopener"` on all admin document-view links.
- ✅ Stack traces no longer leak in production (proper `NODE_ENV` check).
- ❌ `COLLEGE_EMAIL_DOMAIN` left as `gmail.com` per project owner's
  request — switch to `lpu.in` (or your real college domain) before
  launching publicly.

### Bugs (Priority 2)
- ✅ **`/api/admin/verify-via-email` route is now registered** — the
  one-click admin email approval links work.
- ✅ **Password reset flow** — `POST /auth/forgot-password` +
  `POST /auth/reset-password` + `/forgot-password` + `/reset-password`
  frontend pages.
- ✅ **Atomic stock decrement** in `acceptOrder` — uses
  `findOneAndUpdate` with a `$gte` guard so two concurrent accepts
  can't oversell.
- ✅ **Reviews now require a completed order** — buyers can only review
  sellers they've actually bought from and received items from.
- ✅ **`status` removed from `updateListing`'s editable list** — sellers
  can't revive sold listings.
- ✅ **`getListingById` now populates `verification.status`** — detail
  page shows the correct verified badge.
- ✅ **Categories fetched from the API** instead of hardcoded.
- ✅ **Fake marketing numbers removed** — "1,169 items live" and
  "$182,400 in move-out sales" replaced with real, API-backed counts
  (or removed).
- ✅ **`itemsSold` double-counting fixed** — `markListingSold` now
  checks `status !== 'sold'` before incrementing.
- ✅ **Cart cache cleared on logout** — `AuthContext.logout` removes
  the per-user cart cache so the next user doesn't see it.
- ✅ **"In-app payment" claim removed** from the landing page + profile
  bio (was a design error — no payment processor exists).

### New Features (Priority 3)
- ✅ **Real-time messaging** via Socket.io — messages, typing indicators,
  read receipts, conversation-list updates. Falls back to 8s polling if
  the socket disconnects.
- ✅ **Image upload validation** — backend checks dimensions (100–4000px),
  restricts to JPEG/PNG/WebP, handles MulterError (file size, count).
- ✅ **Email + in-app notifications** for:
  - Verification result (approved/rejected)
  - Order status changes (accepted/rejected/cancelled/completed)
  - New listings matching a saved search
- ✅ **Saved searches (watch alerts)** — users can save a search query
  and/or category and get notified when matching listings are posted.
- ✅ **Advanced search filters** — price range, condition (multi-select),
  verified-sellers-only toggle, and sort (newest / price low / price high).
- ✅ **Listing detail page** (`/listings/:id`) — full image gallery,
  seller card, description, message/add-to-cart/save actions.
- ✅ **Edit + delete listings from Profile** — owner gets Edit / Mark
  sold / Delete buttons on each of their own listings.
- ✅ **Toast notifications** (Sonner) for cart actions, profile updates,
  order status changes, listing posts, etc.
- ✅ **Dark / light theme toggle** in the navbar.
- ✅ **i18n** (react-i18next) with English + Hindi translations set up.
  Add more languages by dropping a JSON file in `frontend/src/i18n/`.
- ✅ **PWA** (vite-plugin-pwa) — installable, offline-capable app shell.
- ✅ **Order completion flow** — buyer can mark an accepted order as
  "received", which unlocks the ability to review the seller.

### Polish (Priority 4)
- ✅ **ESLint + Prettier config** for both frontend and backend.
- ✅ **Minimal test suite** (Vitest + Supertest) covering the error
  handler, OTP/token utilities, and CSRF middleware.
- ❌ Docker, single-dev-command, and structured logging deferred per
  project owner's request.

## Architecture notes

### Real-time (Socket.io)
The Express server now creates an HTTP server and attaches Socket.io to
it (see `backend/server.js`). The socket auth middleware verifies the
JWT from the httpOnly cookie on the initial handshake. Each user joins
a personal room (`user:<id>`) and per-conversation rooms
(`conversation:<id>`).

Controllers emit events via the `emitToUser` / `emitToConversation`
helpers in `backend/realtime/socket.js` — no direct socket references
in the controller layer.

### Notifications
Notifications are stored on the User document (`user.notifications[]`)
and delivered in three ways simultaneously:
1. **In-app** — fetched by `GET /api/users/me/notifications` and shown
  in the navbar bell dropdown.
2. **Real-time** — emitted via Socket.io (`notification:new` event).
3. **Email** — sent via Nodemailer (best-effort; failures don't block
  the action).

### Cart + checkout safety
- Cart items are validated server-side on every cart read — stale
  listings (sold, removed, stock depleted) are silently pruned.
- Checkout groups items by seller into one Order per seller.
- Stock is only touched at `acceptOrder` time (not request time), and
  the decrement is atomic.

## File structure

```
quad-fullstack-fixed/
├── .prettierrc.json
├── backend/
│   ├── .env / .env.example / .gitignore / .eslintrc.json
│   ├── package.json
│   ├── server.js               # Express + Helmet + Socket.io
│   ├── vitest.config.js
│   ├── config/
│   │   ├── cloudinary.js       # + format detection
│   │   └── db.js
│   ├── controllers/
│   │   ├── adminController.js   # + email notifications, +register verify-via-email
│   │   ├── authController.js    # + lockout, +password reset, +change password
│   │   ├── cartController.js
│   │   ├── categoryController.js
│   │   ├── listingController.js # + filters, +saved-search notifications
│   │   ├── messageController.js# + Socket.io emit
│   │   ├── orderController.js   # +atomic stock, +complete, +notifications
│   │   ├── reviewController.js  # +gate on completed order
│   │   └── userController.js    # +saved searches, +notifications
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── csrf.js              # NEW
│   │   ├── errorHandler.js      # +normalization
│   │   ├── rateLimiter.js       # NEW
│   │   └── upload.js            # +dimension validation
│   ├── models/
│   │   ├── Cart.js
│   │   ├── Category.js
│   │   ├── Conversation.js
│   │   ├── Listing.js           # +indexes
│   │   ├── Message.js
│   │   ├── Order.js             # +completed status
│   │   ├── Review.js
│   │   └── User.js              # +lockout, +reset token, +notifications, +savedSearches
│   ├── realtime/
│   │   └── socket.js             # NEW — Socket.io setup
│   ├── routes/
│   │   ├── adminRoutes.js       # +verify-via-email route
│   │   ├── authRoutes.js        # +password reset, +rate limiters
│   │   ├── cartRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── listingRoutes.js     # +image upload on edit
│   │   ├── messageRoutes.js     # +mark read
│   │   ├── orderRoutes.js       # +complete
│   │   ├── reviewRoutes.js
│   │   └── userRoutes.js        # +saved searches, +notifications
│   ├── seed/
│   │   └── seedCategories.js
│   ├── tests/                   # NEW
│   │   ├── csrf.test.js
│   │   ├── errorHandler.test.js
│   │   └── tokens.test.js
│   └── utils/
│       ├── asyncHandler.js
│       ├── generateToken.js     # +env cookie name
│       ├── otp.js               # +timingSafeEqual, +MAX_OTP_ATTEMPTS
│       ├── passwordResetToken.js# NEW
│       └── sendEmail.js         # +reset/result/order emails
└── frontend/
    ├── .env / .gitignore / .eslintrc.json
    ├── package.json
    ├── vite.config.js           # +PWA plugin
    ├── tailwind.config.js       # +darkMode: 'class'
    ├── index.html               # +PWA meta
    ├── public/
    │   ├── favicon.svg           # NEW
    │   ├── pwa-192.png           # NEW
    │   ├── pwa-512.png           # NEW
    │   ├── apple-touch-icon.png  # NEW
    │   └── *.jpg (sample listing images)
    └── src/
        ├── index.jsx            # +ThemeProvider, +NotificationProvider, +Toaster, +i18n
        ├── App.jsx              # +new routes
        ├── index.css            # +light theme, +styled-scroll
        ├── i18n/                # NEW
        │   ├── index.js
        │   ├── en.json
        │   └── hi.json
        ├── context/
        │   ├── AuthContext.jsx   # +cart cache fix, +socket connect
        │   ├── CartContext.jsx   # +cache safety comment
        │   ├── NotificationContext.jsx # NEW
        │   └── ThemeContext.jsx  # NEW
        ├── utils/
        │   ├── api.js            # +CSRF header, +all new endpoints
        │   ├── cookieName.js     # NEW
        │   ├── format.js
        │   └── socket.js         # NEW — Socket.io client
        ├── components/
        │   ├── Avatar.jsx
        │   ├── Footer.jsx
        │   ├── ListingCard.jsx   # +clickable, +save API call
        │   ├── Logo.jsx
        │   ├── Navbar.jsx        # +theme toggle, +lang switch, +notifications bell
        │   └── landing/
        │       ├── CampusTrust.jsx
        │       ├── Hero.jsx        # +real listing count
        │       ├── MarketFeed.jsx  # +filters, +API categories
        │       └── SellFlow.jsx    # -fake numbers, -in-app claim
        └── pages/
            ├── AdminDashboard.jsx# +rel=noopener
            ├── Auth.jsx           # +forgot password link
            ├── Cart.jsx
            ├── Checkout.jsx       # +toasts
            ├── ForgotPassword.jsx # NEW
            ├── ListingDetail.jsx  # NEW
            ├── Messages.jsx       # +Socket.io, +typing
            ├── NewListing.jsx     # +edit mode
            ├── Orders.jsx         # +complete, +real-time, +toasts
            ├── Profile.jsx        # +edit/delete/mark-sold
            ├── ResetPassword.jsx  # NEW
            ├── SellerProfile.jsx
            └── Verify.jsx
```

## Environment variables

### backend/.env
```
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=30d
COOKIE_MAX_AGE_MS=2592000000
COLLEGE_EMAIL_DOMAIN=gmail.com     # ← switch to lpu.in before launch
CLOUDINARY_CLOUD_NAME=<...>
CLOUDINARY_API_KEY=<...>
CLOUDINARY_API_SECRET=<...>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your gmail>
SMTP_PASS=<your app password>
SMTP_FROM="Quad <your@gmail.com>"
ADMIN_EMAIL=<your email>
SESSION_COOKIE_NAME=quad_token
```

### frontend/.env
```
VITE_API_URL=http://localhost:5000/api
VITE_COLLEGE_EMAIL_DOMAIN=gmail.com
VITE_SOCKET_URL=http://localhost:5000
```

## Deferred (per project owner's request)

- **Docker** (Dockerfile + docker-compose) — not included.
- **Single `bun run dev` command** (concurrent frontend + backend) — not included.
- **Structured logging** (Pino/Winston) — not included; `console.log` is still used.
