import { describe, expect, it } from 'vitest';
import {
	daysBetweenInTimeZone,
	isLocalWeekday,
	isUsersNotificationHour,
	localHour,
	parseNotificationHour,
	resolveDeliveryMethod,
	wantsEmail,
	wantsSms
} from './preferences';

describe('delivery preferences', () => {
	it('treats a missing method as email, matching settings', () => {
		expect(resolveDeliveryMethod(null)).toBe('email');
		expect(resolveDeliveryMethod(undefined)).toBe('email');
		expect(resolveDeliveryMethod('')).toBe('email');
		expect(resolveDeliveryMethod('pigeon')).toBe('email');
	});

	it('keeps an explicit choice', () => {
		expect(resolveDeliveryMethod('sms')).toBe('sms');
		expect(resolveDeliveryMethod('both')).toBe('both');
		expect(wantsEmail('sms')).toBe(false);
		expect(wantsSms('sms')).toBe(true);
		expect(wantsEmail(null)).toBe(true);
		expect(wantsSms(null)).toBe(false);
		expect(wantsEmail('both')).toBe(true);
		expect(wantsSms('both')).toBe(true);
	});
});

describe('notification hour', () => {
	it('parses HH:mm and falls back to 9', () => {
		expect(parseNotificationHour('14:30')).toBe(14);
		expect(parseNotificationHour('9')).toBe(9);
		expect(parseNotificationHour(null)).toBe(9);
		expect(parseNotificationHour('25:00')).toBe(9);
	});

	it('matches the hour in the user timezone', () => {
		const nineEastern = new Date('2026-10-09T13:00:00.000Z');
		expect(localHour(nineEastern, 'America/New_York')).toBe(9);
		expect(
			isUsersNotificationHour(nineEastern, {
				timezone: 'America/New_York',
				notificationTime: '09:00'
			})
		).toBe(true);
		expect(
			isUsersNotificationHour(nineEastern, {
				timezone: 'America/New_York',
				notificationTime: '10:00'
			})
		).toBe(false);
		expect(isUsersNotificationHour(nineEastern, { timezone: null, notificationTime: null })).toBe(
			false
		);
		expect(isUsersNotificationHour(new Date('2026-10-09T09:00:00.000Z'), {})).toBe(true);
	});

	it('uses the local weekday, not the server clock', () => {
		const fridayEveningEastern = new Date('2026-10-10T01:30:00.000Z');
		expect(isLocalWeekday(fridayEveningEastern, 'America/New_York')).toBe(true);
		expect(isLocalWeekday(fridayEveningEastern, 'UTC')).toBe(false);
	});

	it('counts journey days on the local calendar', () => {
		const start = new Date('2026-10-05T04:00:00.000Z');
		const later = new Date('2026-10-08T13:00:00.000Z');
		expect(daysBetweenInTimeZone(start, later, 'America/New_York')).toBe(3);
	});
});
