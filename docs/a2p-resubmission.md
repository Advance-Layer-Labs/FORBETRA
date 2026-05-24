# A2P 10DLC Campaign Resubmission — Copy to Paste

**Status:** Ready to resubmit
**Rejection reason (prior):** Error 30909 — "issues verifying the Call to Action (CTA) provided for the campaign"
**Fix applied:** `/sms-consent`, `/sms-terms`, `/privacy`, and `/terms` are now cross-linked from the public landing page footer at `https://app.forbetra.com`, so reviewers can reach every consent artifact without logging in.

---

## Steps

1. Deploy this branch to production (link visibility is the whole point — verify footer links resolve before submitting).
2. Log into [Twilio Console](https://console.twilio.com/).
3. Go to **Messaging** → **Regulatory Compliance** → **US A2P 10DLC** → your brand ("Forbetra SMS").
4. Find the rejected campaign ("Low Volume Mixed A2P" — verify by SID `MG1f82...` matching `TWILIO_MESSAGING_SERVICE_SID` in Vercel env).
5. Click **Resubmit** (or **Clone** if resubmit isn't offered).
6. Paste the copy below into the matching form fields.
7. Submit. Re-review typically takes 1–5 business days.

---

## Field: Campaign Use Case

**Select:** `Low Volume Mixed` (same as before — under 6,000 messages/day across all use cases combined).

---

## Field: Campaign Description

Forbetra is a professional development platform that pairs structured weekly self-reflection with continuous 360-degree reviewer feedback and AI-generated coaching insights. The platform sends SMS notifications only to users who have created an account and explicitly opted in via their account settings.

SMS messages are transactional and tied to user-initiated activity in the platform:

- Reminders to complete weekly self-assessments the user has scheduled
- Invitations sent to reviewers the user has personally added to their own 360 feedback circle
- Notifications when a reviewer submits new feedback on the user's progress
- Coaching invitation and onboarding notifications when a coach adds a client the client already knows
- Welcome messages after a user has explicitly opted in

No marketing, promotional, or commercial messaging is ever sent. Messages are always tied to an identifiable prior user action.

---

## Field: Call-to-Action / Message Flow

End users opt in to SMS messaging through an authenticated in-product settings screen in the Forbetra web application. The opt-in mechanism and full consent disclosure are publicly documented, with a rendered visual of the opt-in UI, at:

https://app.forbetra.com/sms-consent

The standalone SMS Messaging Terms (message types, frequency, STOP/HELP handling, data rates) are at:

https://app.forbetra.com/sms-terms

Both URLs are linked from the footer of the public landing page at https://app.forbetra.com, alongside links to the Terms of Use and Privacy Policy, so reviewers can reach them without creating an account.

### Opt-in flow (step by step)

1. User creates an account at https://app.forbetra.com/sign-up using email + password via Clerk (our authentication provider).
2. User is directed to their role-specific dashboard. SMS is disabled by default — all accounts start with `deliveryMethod = "email"` and no phone number on file.
3. User navigates to Settings at https://app.forbetra.com/individual/settings.
4. Under the "Notifications" section, the user sees three delivery-method options: Email, SMS, Both. Email is selected by default.
5. If the user chooses "SMS" or "Both", a disclosure block immediately becomes visible below the toggle. It reads, verbatim:

   "By enabling SMS, you agree to receive automated text messages from Forbetra. ~1–4 msgs/week. Msg & data rates may apply. Reply STOP to opt out. [SMS Terms] [Privacy]"

   The [SMS Terms] link opens https://app.forbetra.com/sms-terms. The [Privacy] link opens https://app.forbetra.com/privacy.

6. A phone-number input appears. The user must type a valid mobile number.
7. The user clicks "Save". The server persists `deliveryMethod` and `phone` in the user's database record (Neon Postgres). Consent is captured as of the save timestamp.
8. A single welcome SMS is sent (template: "Welcome to Forbetra, {name}! Your development journey starts now. Get started: https://app.forbetra.com\n\nReply STOP to opt out").

Consent is never a condition of using Forbetra. Users may select "Email" and never provide a phone number.

---

## Field: How do end users consent to receive messages?

End users consent through an explicit opt-in inside their authenticated account settings at https://app.forbetra.com/individual/settings. No SMS is sent to any phone number unless the account holder has:

1. Created a Forbetra account (email + password via Clerk).
2. Actively selected "SMS" or "Both" as their notification delivery method (Email is the default).
3. Manually entered a valid mobile phone number into the phone field.
4. Clicked "Save" after the required consent disclosure has been rendered on-screen.

The consent disclosure includes: message description, frequency (1–4 msgs/week), "Msg & data rates may apply", "Reply STOP to opt out", and links to the SMS Terms and Privacy Policy.

Because the settings screen is authenticated, a publicly-accessible mirror of the opt-in UI and full consent language is available for review at https://app.forbetra.com/sms-consent. That page includes a rendered visual of the actual settings-screen consent block, shows the exact disclosure copy, and explains the opt-out mechanism. It is linked from the footer of the signed-out landing page at https://app.forbetra.com.

Reviewer and coach invitations are also SMS-capable, but only when:

- The inviter (an authenticated Forbetra user) has personally added the invitee to their own circle, and
- The invitee has consented in-platform to receive SMS on the same terms described above.

Consent is never a condition of using Forbetra. Phone numbers are never collected, shared, or used for marketing.

---

## Field: Opt-in Keywords

`START`, `UNSTOP`, `SUBSCRIBE`

## Field: Opt-in Message

You are now subscribed to Forbetra SMS notifications. ~1–4 msgs/week. Msg & data rates may apply. Reply STOP to opt out, HELP for help.

## Field: Opt-out Keywords

`STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `QUIT`, `END`

## Field: Opt-out Message

You have been unsubscribed from Forbetra SMS and will not receive any more messages. Reply START to resubscribe.

## Field: Help Keywords

`HELP`, `INFO`

## Field: Help Message

Forbetra SMS support: sagal@thewinningmind.com. Reply STOP to opt out. Msg & data rates may apply.

---

## Field: Sample Messages (provide 3–5)

Paste each as a separate sample.

**Sample 1 — Weekly check-in reminder (Individual)**

Forbetra: Time for your Wednesday check-in (Week 3). https://app.forbetra.com/individual/checkin?type=RATING_A

Reply STOP to opt out

**Sample 2 — Feedback invitation (Reviewer, after opt-in)**

Forbetra: Jane Smith needs your feedback. Takes <60 seconds: https://app.forbetra.com/stakeholder/feedback/abc123

Reply STOP to opt out

**Sample 3 — New feedback received (Individual)**

Forbetra: Alex just shared feedback on your progress. View insights: https://app.forbetra.com/individual/insights

Reply STOP to opt out

**Sample 4 — Welcome (post opt-in)**

Welcome to Forbetra, Sarah! Your development journey starts now. Get started: https://app.forbetra.com

Reply STOP to opt out

**Sample 5 — Coach invitation (after reviewer opt-in)**

Forbetra: Coach Marc invited you to join their development program. Get started: https://app.forbetra.com/coach/invite/xyz789

Reply STOP to opt out

---

## Field: Does the message content include any of the following?

- [x] Links — yes (transactional links to the user's own dashboard or invite token)
- [ ] Phone numbers — no
- [ ] Age-gated content — no

## Field: Direct Lending / Loan Arrangement

No.

## Field: Embedded Link

Yes — all links are on `https://app.forbetra.com` (our own domain). Tokenized feedback links use the same domain.

## Field: Embedded Phone Number

No.

---

## After Submission

1. Wait 1–5 business days for Twilio + carrier re-review.
2. When the campaign status flips to **Approved**, run an end-to-end delivery test:
   - In your Forbetra account, go to Settings, switch delivery to "Both", save your phone number.
   - Confirm welcome SMS arrives on your phone within ~30 seconds.
   - Trigger a test via `/api/debug/sms` (requires `DEBUG_EMAIL_KEY` header) to verify a second message flows.
3. Once confirmed working, schedule the cleanup tasks from the Feb 27 prep:
   - Drop unused Twilio number `+16196481113` from the Messaging Service sender pool, then release the number.
   - Delete unused Messaging Service "Forbetra" (`MG2127...`) — verify first that it has no attached campaign.
   - Optionally: decide whether to keep Postmark or simplify to SendGrid only.

## If Rejected Again

Capture the exact rejection error code and text (30909 variants have sub-reasons). Common follow-up reasons:

- **"CTA not accessible"** → confirm `/sms-consent` loads without auth and is linked from the landing footer.
- **"Opt-in description doesn't match flow"** → the copy in the "How do end users consent" field must exactly describe what a reviewer will see when they visit the URL. If we change the settings UI, update `/sms-consent` and the campaign copy in lockstep.
- **"Business/brand mismatch"** → verify the Brand's legal name matches "Winning Mind, LLC" (the business entity listed on the consent page) and that the trust score is acceptable.

Do not keep resubmitting blindly — after two rejections, Twilio support is the fastest path. Open a ticket referencing the campaign SID and ask for specific guidance on what's failing verification.
