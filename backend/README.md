# Quad — Backend

Plain JavaScript (no TypeScript) Express API for the Quad campus marketplace.
Stack: Node.js + Express + MongoDB/Mongoose + Cloudinary + JWT cookie sessions.

## Setup

```bash
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT_SECRET, CLOUDINARY_*, etc.
npm run seed:categories
npm run dev
```

The API runs on `http://localhost:5000` by default. `CLIENT_URL` in `.env`
controls CORS — point it at your Vite dev server (`http://localhost:5173`).

### Making yourself an admin

There's no public "become admin" route, on purpose. After you sign up and
verify your email normally, promote your own account by hand in the
database once:

```js
// in mongosh, or MongoDB Compass
db.users.updateOne({ email: "you@yourcollege.edu" }, { $set: { role: "admin" } })
```

## Auth flow implemented

1. `POST /api/auth/register` — name, email (college domain only), phone, password. Creates an account with `emailVerified: false` and emails a 6-digit OTP (or logs it to the console if SMTP isn't configured — see `.env.example`).
2. `POST /api/auth/verify-otp` — confirms the code, marks the email verified, and logs the student in (sets an httpOnly session cookie).
3. `POST /api/auth/login` — day-to-day email + password login. Requires step 2 already done.
4. `GET /api/auth/me` — called on app load; if the cookie is still valid the student is already logged in, no re-entry of credentials needed.
5. `POST /api/auth/logout` — clears the session cookie.

Email verification and **ID/Aadhar verification are separate steps.**
A logged-in student can browse right after step 2, but posting a listing,
messaging, or leaving a review requires `verification.status === 'approved'`
(enforced by the `requireVerifiedStudent` middleware).

## ID/Aadhar verification flow

1. `POST /api/users/me/verification` (multipart: `idCard`, `aadharCard` files + `registrationNo` field) — uploads both images to Cloudinary as **`type: authenticated`**, meaning they are not reachable by a public URL, only via short-lived signed links.
2. Status becomes `pending`.
3. Admin reviews via `GET /api/admin/verifications?status=pending` (returns signed, time-limited view URLs for the documents) and approves/rejects with `PATCH /api/admin/verifications/:userId`.
4. Student can poll their own status with `GET /api/users/me/verification`.

**Why this matters:** Aadhar numbers/images are sensitive government ID
data. The schema (`models/User.js`) marks those fields `select: false` so
they never come back from a normal `find()`/`findById()` — only the admin
controller explicitly opts in to reading them, and even then only returns
a signed URL, not the raw Cloudinary link.

## Fully implemented

- Auth (register/OTP/login/logout/session)
- Profile management (edit bio/major/dorm, avatar upload)
- ID/Aadhar verification submission + admin review queue
- Listings: create/read/update/delete, category filter, text search, save/watch toggle, mark-as-sold
- Reviews (tied to a listing, updates seller's aggregate rating)
- Basic REST messaging (conversations + messages, polling-based)
- Admin stats endpoint

## Deliberately stubbed / next steps

- **Real-time messaging** — current implementation is plain REST (the client polls). Swapping in Socket.io later is a drop-in addition, not a rewrite.
- **Automated ID/OCR verification** — every submission goes to a human reviewer for now (see the report chat message for why). A third-party KYC API could sit in front of the manual queue later.
- **Email delivery in production** — OTPs print to the console until you set `SMTP_*` in `.env`.
- **Payments** — the frontend copy mentions "pay in-app," but no payment processor is wired up; transactions are still cash/in-person, with `mark-sold` just recording that a sale happened.
- **Rate limiting / abuse protection** on OTP and login routes — worth adding before any real deployment.

## Folder structure

```
config/        Mongo + Cloudinary setup
models/        Mongoose schemas
middleware/    auth, upload (multer/Cloudinary), error handling
controllers/   route logic
routes/        Express routers, mounted in server.js
utils/         token/OTP/email helpers
seed/          one-off scripts (category seeding)
```
