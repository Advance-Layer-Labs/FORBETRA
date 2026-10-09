export const DEFAULT_DELIVERY_METHOD = 'email' as const;
export const DEFAULT_NOTIFICATION_TIME = '09:00';
export const DEFAULT_TIMEZONE = 'UTC';

export type DeliveryMethod = 'email' | 'sms' | 'both';

const DELIVERY_METHODS = new Set<DeliveryMethod>(['email', 'sms', 'both']);

/** Null and unknown values match the settings screen, which shows email. */
export function resolveDeliveryMethod(value: string | null | undefined): DeliveryMethod {
	if (value && DELIVERY_METHODS.has(value as DeliveryMethod)) {
		return value as DeliveryMethod;
	}
	return DEFAULT_DELIVERY_METHOD;
}

export function wantsEmail(value: string | null | undefined): boolean {
	return resolveDeliveryMethod(value) !== 'sms';
}

export function wantsSms(value: string | null | undefined): boolean {
	return resolveDeliveryMethod(value) !== 'email';
}

export function safeTimeZone(timeZone: string | null | undefined): string {
	if (!timeZone) return DEFAULT_TIMEZONE;
	try {
		Intl.DateTimeFormat(undefined, { timeZone });
		return timeZone;
	} catch {
		return DEFAULT_TIMEZONE;
	}
}

/** The browser's IANA timezone, or an empty string when it cannot be resolved. */
export function browserTimeZone(): string {
	if (typeof Intl === 'undefined') return '';
	try {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (!zone) return '';
		Intl.DateTimeFormat(undefined, { timeZone: zone });
		return zone;
	} catch {
		return '';
	}
}

/** Hour 0–23 in the given timezone. Falls back to UTC for an unknown zone. */
export function localHour(now: Date, timeZone: string | null | undefined): number {
	const formatted = new Intl.DateTimeFormat('en-US', {
		timeZone: safeTimeZone(timeZone),
		hour: 'numeric',
		hourCycle: 'h23'
	}).format(now);
	const hour = Number(formatted);
	if (!Number.isInteger(hour)) return 0;
	return hour === 24 ? 0 : hour;
}

/** 0 = Sunday … 6 = Saturday in the given timezone. */
export function localWeekday(now: Date, timeZone: string | null | undefined): number {
	const weekday = new Intl.DateTimeFormat('en-US', {
		timeZone: safeTimeZone(timeZone),
		weekday: 'short'
	}).format(now);
	const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
	return map[weekday] ?? 0;
}

export function isLocalWeekday(now: Date, timeZone: string | null | undefined): boolean {
	const day = localWeekday(now, timeZone);
	return day >= 1 && day <= 5;
}

export function parseNotificationHour(value: string | null | undefined): number {
	const match = /^(\d{1,2})(?::(\d{2}))?$/.exec((value ?? DEFAULT_NOTIFICATION_TIME).trim());
	if (!match) return 9;
	const hour = Number(match[1]);
	if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 9;
	return hour;
}

export function isUsersNotificationHour(
	now: Date,
	user: { timezone?: string | null; notificationTime?: string | null }
): boolean {
	return localHour(now, user.timezone) === parseNotificationHour(user.notificationTime);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD for the calendar date in the user's timezone. */
export function calendarDateString(date: Date, timeZone: string | null | undefined): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: safeTimeZone(timeZone),
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
}

/** UTC midnight of the calendar date in the user's timezone. */
export function calendarDayUtc(date: Date, timeZone: string | null | undefined): number {
	const formatted = new Intl.DateTimeFormat('en-CA', {
		timeZone: safeTimeZone(timeZone),
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);
	const [year, month, day] = formatted.split('-').map(Number);
	return Date.UTC(year, month - 1, day);
}

export function daysBetweenInTimeZone(
	start: Date,
	end: Date,
	timeZone: string | null | undefined
): number {
	return Math.floor((calendarDayUtc(end, timeZone) - calendarDayUtc(start, timeZone)) / MS_PER_DAY);
}
