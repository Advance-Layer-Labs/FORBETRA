import { describe, expect, it } from 'vitest';
import { classifySmsKeyword } from './smsKeywords';

describe('classifySmsKeyword', () => {
	it('treats Twilio opt-out words as stop', () => {
		expect(classifySmsKeyword('stop')).toBe('stop');
		expect(classifySmsKeyword('STOPALL')).toBe('stop');
		expect(classifySmsKeyword('  unsubscribe please')).toBe('stop');
	});

	it('treats start words as a resume', () => {
		expect(classifySmsKeyword('START')).toBe('start');
		expect(classifySmsKeyword('yes')).toBe('start');
		expect(classifySmsKeyword('UNSTOP')).toBe('start');
	});

	it('ignores other messages', () => {
		expect(classifySmsKeyword('hello')).toBeNull();
		expect(classifySmsKeyword('')).toBeNull();
	});
});
