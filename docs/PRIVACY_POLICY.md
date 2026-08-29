# Quad — Privacy Policy

> QD-021 — Required by the Round 2 security audit. Quad collects
> government-issued ID photos (student ID, Aadhar card) for verification,
> so a Privacy Policy is a launch blocker under GDPR / FERPA / DPDP /
> CCPA. This document is informational and is rendered as a public page
> at `/privacy` (see `frontend/src/pages/Privacy.jsx`).

**Last updated:** 2026-08-27

## 1. Who we are

Quad is a single-campus student marketplace operated by Quad
("we", "us", "our"). Quad is run by students for students at the
campus whose `.edu` email domain is configured as
`COLLEGE_EMAIL_DOMAIN`.

To contact us: email **privacy@quad.app** (replace with the real
address before launch — see `ADMIN_EMAIL` in your `.env`).

## 2. What personal data we collect

| Category              | What                                                       | Why                                            | Stored where           |
|-----------------------|------------------------------------------------------------|------------------------------------------------|------------------------|
| Account               | Name, college email, phone, password (bcrypt-hashed)      | Sign-up + login                                | MongoDB (`users`)      |
| Profile               | Avatar, major, dorm, bio                                   | Showing seller profiles                        | MongoDB (`users`)      |
| Listings              | Title, price, photos, pickup spot                          | Marketplace                                    | MongoDB + Cloudinary   |
| Messages              | Conversation text between buyers and sellers              | In-app messaging                               | MongoDB (`messages`)   |
| **Verification docs** | **Student ID photo, Aadhar card photo, registration no.** | **Manual admin verification of student status** | **MongoDB + Cloudinary (private, signed URLs)** |
| Device / session      | JWT cookie (httpOnly), user-agent, IP (audit log only)    | Authentication + audit trail                   | Cookie + MongoDB (`auditlogs`) |

## 3. Why we collect government-issued ID photos

We collect a student ID photo and an Aadhar card photo **only** to verify
that a user is a genuine student at our campus before they can post
listings, send messages, or transact. This is a fraud-prevention measure
to keep the marketplace safe — without it, anyone with a fake email
could create accounts and scam students.

Verification documents are:
- Stored in **Cloudinary** with the `type: private` upload preset.
- Accessed only via **signed URLs** that expire after a short window.
- Viewable only by **admin users** through the admin dashboard, and
  only while the verification is `pending`.
- Deleted within **30 days** of approval / rejection if the user
  requests deletion (Section 7).

## 4. Legal bases (GDPR Art. 6)

We process your personal data on the following legal bases:
- **Performance of a contract** (Art. 6(1)(b)) — creating an account so
  you can post listings and transact on Quad.
- **Legitimate interest** (Art. 6(1)(f)) — preventing fraud by verifying
  student status.
- **Legal obligation** (Art. 6(1)(c)) — where Indian / campus law
  requires us to keep records (e.g. audit logs of admin actions).

## 5. How long we keep your data

| Data                                  | Retention                                          |
|---------------------------------------|----------------------------------------------------|
| Account                               | Until you request deletion                         |
| Listings                              | Until you delete the listing + 30 days for audit   |
| Messages                              | Until you delete the conversation + 30 days        |
| **Verification docs**                 | **30 days after decision, unless deletion requested** |
| Audit logs                            | 2 years (legal obligation for fraud prevention)    |
| Server logs (pino)                    | 30 days                                            |

## 6. Who we share data with

We do **not** sell your data. We share it only with:

- **Cloudinary** (image hosting) — for listing photos and verification
  documents. Cloudinary is GDPR-compliant.
- **MongoDB Atlas** (database hosting) — for all structured data. Atlas
  is GDPR-compliant.
- **Your SMTP provider** (e.g. SES, Mailgun) — for transactional emails
  (OTP codes, order updates, password resets).
- **Law enforcement** — only if compelled by a valid legal request
  (court order, etc.).

## 7. Your rights

You have the right to:
- **Access** — request a copy of all your personal data.
- **Rectify** — correct inaccurate data.
- **Erase** — request deletion of your account and associated data
  (we will retain verification docs for 30 days post-decision per
  Section 5, and audit logs for 2 years).
- **Restrict** — ask us to limit processing.
- **Portability** — receive your data in a machine-readable format
  (JSON).
- **Object** — to processing based on legitimate interest.
- **Withdraw consent** — for any processing that relied on consent.

To exercise any of these rights, email **privacy@quad.app**. We will
respond within 30 days.

## 8. Security

- Passwords are stored as **bcrypt hashes** (cost 10).
- All HTTP traffic is forced over **HTTPS** in production (HSTS enabled).
- Auth cookies are **httpOnly**, **Secure**, **SameSite=None** in
  production, so they cannot be read by JavaScript or sent on
  cross-site requests.
- Verification documents are stored in **private** Cloudinary assets
  accessible only via short-lived signed URLs.
- Admin actions are recorded in an **append-only audit log**.
- We run a **quarterly backup / restore drill** — see
  [`docs/BACKUP_RESTORE_RUNBOOK.md`](./BACKUP_RESTORE_RUNBOOK.md).

## 9. International transfers

Your data may be processed outside your home country (e.g. Cloudinary /
MongoDB Atlas may store backups in different regions). We rely on
Standard Contractual Clauses (SCCs) for any such transfer.

## 10. Children

Quad is for adult students at our campus only. We do not knowingly
collect data from anyone under 18. If you believe we have collected
data from a minor, contact **privacy@quad.app** and we will delete it.

## 11. Changes to this policy

We will email all users 30 days before any material change takes
effect. The current version is always at
`https://your-domain/privacy`.

## 12. Contact

Email: **privacy@quad.app**
