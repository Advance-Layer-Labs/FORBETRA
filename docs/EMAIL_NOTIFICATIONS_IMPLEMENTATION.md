# Notification implementation

Email and SMS are sent inline from route actions and cron jobs. There is no queue and no in-app inbox.

- Email: [`src/lib/notifications/email.ts`](../src/lib/notifications/email.ts). Postmark when `POSTMARK_API_KEY` is set, otherwise SendGrid. `EMAIL_MODE=mock` logs instead of sending. Development defaults to mock.
- SMS: [`src/lib/notifications/sms.ts`](../src/lib/notifications/sms.ts) via Twilio. `SMS_MODE=mock` logs instead of sending. `trySendSms` returns `false` when the phone is missing or the provider throws.
- Templates: [`emailTemplates.ts`](../src/lib/notifications/emailTemplates.ts) and [`smsTemplates.ts`](../src/lib/notifications/smsTemplates.ts).

Reviewers have no account. Their public links live under `/stakeholder/*`. The data model is `Reviewer`.

## Individual preferences

Stored on `User`:

- `deliveryMethod`: `email`, `sms`, or `both`. A null or unknown value is treated as `email`, the same default the settings screen shows. SMS is not sent until the person chooses `sms` or `both`.
- `notificationTime`: `HH:mm`, default `09:00`.
- `timezone`: IANA zone, default `UTC`.

Check-in reminders use the local weekday and the local hour of `notificationTime`. Journey day 3 is also counted on that local calendar. There is no `reminderDays` field.

`/api/jobs/remind-base` and `/api/jobs/remind-prompts` run every hour (`0 * * * *`) so a saved hour in any timezone can match. Each job still sends at most once per local day for a given user.

## Individuals

| Event                                                                                                         | Channel                     | Respects `deliveryMethod` |
| ------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------- |
| Welcome after onboarding                                                                                      | Email, and SMS when allowed | Yes                       |
| Weekly check-in nudge (journey day 3, local weekday, saved hour)                                              | Email and/or SMS            | Yes                       |
| Missing check-in on other local weekdays (max 2 per week; stored in `NotificationCap` when Upstash is absent) | Email and/or SMS            | Yes                       |
| Journey completed                                                                                             | Email and/or SMS            | Yes                       |
| Reviewer submitted feedback                                                                                   | Email and/or SMS            | Yes                       |
| Reviewer asked for a new link                                                                                 | Email and/or SMS            | Yes                       |
| Streak milestone                                                                                              | Email and/or SMS            | Yes                       |
| Monthly summary                                                                                               | Email and/or SMS            | Yes                       |
| Scorecard perception-gap shift                                                                                | Email and/or SMS            | Yes                       |

Weekly AI insights are stored for the app. They are not emailed. Coach notes appear on Today. They are not emailed.

## Reviewers

Reviewers do not have `deliveryMethod`. Email always goes out. SMS goes out when `Reviewer.phone` is set, and the UI reports SMS only when `trySendSms` succeeds.

| Event                                                                       | Template                   |
| --------------------------------------------------------------------------- | -------------------------- |
| Added as a reviewer                                                         | `welcomeReviewer`          |
| Individual requests feedback                                                | `feedbackInvite`           |
| Weekday reminder for an open invite, or a due reviewer whose invite expired | `reminderReviewerFeedback` |
| Submitted feedback                                                          | `reviewerThankYou`         |
| Monthly impact summary                                                      | `reviewerImpactSummary`    |

Checking in does not invite reviewers. The individual sends the request from Reviewers or Feedback. The reminder job adds a new link and leaves any earlier open link valid. It also nudges a reviewer whose last unused invite has expired and who is still due. Reviewer emails do not link to account settings. The 2-per-week cap is enforced in Redis when Upstash is set, and in the `NotificationCap` table otherwise.

## Coaches

| Event                                                                         | Recipient          | Channel                                                                                     |
| ----------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Coach creates or resends a client invite                                      | Invitee            | `coachInvitation` email, plus SMS when a phone is on the invite                             |
| Client accepts `/coach/invite/[token]`, or signup auto-links a pending invite | Coach              | `coachClientAccepted` email, and SMS when the coach's `deliveryMethod` allows it            |
| Reviewer submits feedback for a linked client                                 | Every active coach | `coachReviewerFeedbackReceived` email, and SMS when that coach's `deliveryMethod` allows it |

Accepting an invite that this same client already accepted does not send again. Signup auto-accept in `hooks.server.ts` sends the same coach notification as the invite page.

Coach prep, client check-ins, and portfolio alerts stay in the app. They are not emailed. Coach settings store `deliveryMethod` (default email). Coach SMS is sent only for `sms` or `both`.

Inbound texts hit `POST /api/webhooks/twilio`. STOP sets `deliveryMethod` to email for the matching phone. START sets it to both. The request must carry a valid Twilio signature.

## Cron

| Path                                   | Schedule (UTC)     | Who                                                          |
| -------------------------------------- | ------------------ | ------------------------------------------------------------ |
| `/api/jobs/remind-base`                | Every hour         | Individuals, at their saved local hour                       |
| `/api/jobs/remind-prompts`             | Every hour         | Individuals, at their saved local hour, except journey day 3 |
| `/api/jobs/remind-feedback`            | Weekdays 15:00     | Reviewers with an open or expired invite                     |
| `/api/jobs/complete-cycles`            | Daily 01:00        | Individuals whose journey ended                              |
| `/api/jobs/individual-monthly-summary` | 1st of month 10:00 | Individuals with recent activity                             |
| `/api/jobs/stakeholder-impact`         | 1st of month 10:00 | Reviewers                                                    |
| `/api/jobs/notify-scorecard-shifts`    | Sundays 21:00      | Individuals                                                  |
| `/api/jobs/generate-insights`          | Sundays 20:00      | In-app insights only                                         |
| `/api/jobs/coach-prep`                 | Mondays 07:00      | In-app coach prep only                                       |

## Environment

```bash
POSTMARK_API_KEY=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@forbetra.com
EMAIL_MODE=send
EMAIL_PROVIDER=postmark

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
SMS_MODE=send

CRON_SECRET=
PUBLIC_APP_URL=https://app.forbetra.com
```

`JOB_SECRET_TOKEN` is accepted as a fallback for cron auth when `CRON_SECRET` is unset.
