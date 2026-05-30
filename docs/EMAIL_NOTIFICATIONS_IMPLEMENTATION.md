# Email Notifications Implementation Summary

## ✅ What's Been Implemented

### 1. **Database Schema**

- Added `reminderDays` field to `User` model (stores 'wednesday_friday' or 'tuesday_thursday')
- **Action Required**: Run migration: `npx prisma migrate dev --name add_reminder_days`

### 2. **SendGrid Integration**

- Installed `@sendgrid/mail` package
- Implemented `sendEmail()` function with SendGrid integration
- Email function works in both development (logs) and production (sends via SendGrid)

### 3. **Email Templates**

Created comprehensive email templates in `src/lib/notifications/emailTemplates.ts`:

- ✅ Welcome email for individuals
- ✅ Welcome email for stakeholders
- ✅ Feedback invite emails
- ✅ Stakeholder feedback received notification (to individual)
- ✅ Base reminder emails (Monday/Wednesday/Friday or Tuesday/Thursday)
- ✅ Overdue reminder emails
- ✅ Stakeholder feedback reminder emails

### 4. **Email Notifications Wired Up**

#### Welcome Emails

- ✅ Individual welcome email sent on onboarding completion
- ✅ Stakeholder welcome email sent when added (onboarding, dashboard, individual/stakeholders pages)

#### Feedback Invites

- ✅ Feedback invite emails sent when individual submits reflection
- ✅ Updated in: `individual/stakeholders`, `dashboard`, `individual/dashboard`

#### Stakeholder Feedback Notifications

- ✅ Individual receives email when stakeholder submits feedback
- ✅ Directs them to insights page to build app habit

#### Reminder Emails

- ✅ Base reminders: Monday/Wednesday/Friday or Tuesday/Thursday @ 9am
- ✅ Overdue reminders: Mon-Fri @ 2pm (existing job now sends emails)
- ✅ Stakeholder feedback reminders: Mon-Fri @ 3pm (existing job now sends emails)

### 5. **Cron Jobs**

Updated `vercel.json` with new base reminder job:

- `/api/jobs/remind-base` - Runs Mon-Fri @ 9am
- `/api/jobs/remind-prompts` - Runs Mon-Fri @ 2pm (overdue reminders)
- `/api/jobs/remind-feedback` - Runs Mon-Fri @ 3pm (stakeholder reminders)

### 6. **Onboarding Updates**

- ✅ Stores `reminderDays` preference in User model during onboarding
- ✅ Sends welcome emails to stakeholders added during onboarding

## 🔧 Environment Variables Required

Add these to your Vercel project (or `.env` for local):

```bash
# SendGrid (Twilio Email)
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@forbetra.com  # Or your verified sender email

# Job Authentication
JOB_SECRET_TOKEN=your_secret_token_here  # For securing cron endpoints

# App URL (optional, defaults to app.forbetra.com)
PUBLIC_APP_URL=your-app-domain.com  # Or VERCEL_URL will be used automatically
```

## 📋 Next Steps

1. **Run Database Migration**

   ```bash
   cd forbetra
   npx prisma migrate dev --name add_reminder_days
   ```

2. **Set Up SendGrid**
   - Get API key from Twilio SendGrid dashboard
   - Verify sender email address
   - Add environment variables to Vercel

3. **Test Email Sending**
   - Test in development (will log to console)
   - Test in production with real SendGrid credentials
   - Verify all email templates render correctly

4. **Verify Cron Jobs**
   - Base reminders: Mon-Fri @ 9am
   - Overdue reminders: Mon-Fri @ 2pm
   - Stakeholder reminders: Mon-Fri @ 3pm

## 📝 Notes

- All email sending is wrapped in try-catch blocks to prevent request failures if email service is down
- Email templates include both HTML and plain text versions
- Reminder preference is stored per user and used to determine which days to send base reminders
- Welcome emails are sent once (individuals on onboarding complete, stakeholders when added)

## 🐛 Known Issues / Future Improvements

- Base reminder job uses server timezone - may need timezone handling per user
- Welcome emails for stakeholders during onboarding use setTimeout (could be improved with queue)
- Email templates could be moved to a template engine for easier editing
