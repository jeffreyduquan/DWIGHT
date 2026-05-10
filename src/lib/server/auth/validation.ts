/**
 * @file validation.ts — username/password validation rules
 * @implements REQ-AUTH-001 — username constraints
 * @implements REQ-AUTH-002 — minimum password strength
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,24}$/;

export function validateUsername(input: string): string | null {
	if (!input || input.length < 3) return 'Mindestens 3 Zeichen.';
	if (input.length > 24) return 'Maximal 24 Zeichen.';
	if (!USERNAME_REGEX.test(input))
		return 'Nur Buchstaben, Zahlen, Bindestrich und Unterstrich erlaubt.';
	return null;
}

export function validatePassword(input: string): string | null {
	if (!input || input.length < 8) return 'Passwort muss mindestens 8 Zeichen lang sein.';
	if (input.length > 128) return 'Passwort zu lang (max. 128 Zeichen).';
	return null;
}
