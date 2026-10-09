const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const START_WORDS = new Set(['START', 'UNSTOP', 'YES']);

export type SmsKeyword = 'stop' | 'start' | null;

/** First word of an inbound SMS. STOP opts out. START resumes. */
export function classifySmsKeyword(body: string | null | undefined): SmsKeyword {
	const word = (body ?? '').trim().split(/\s+/)[0]?.toUpperCase() ?? '';
	if (STOP_WORDS.has(word)) return 'stop';
	if (START_WORDS.has(word)) return 'start';
	return null;
}
