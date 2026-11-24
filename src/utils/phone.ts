const ARABIC_INDIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

const EGYPT_E164_REGEX = /^\+201[0125]\d{8}$/;

function toAsciiDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (ch) => ARABIC_INDIC_DIGITS[ch] ?? ch);
}

/**
 * Normalize an Egyptian mobile number to canonical E.164 format (+201XXXXXXXXX).
 * Returns { ok: true, value } or { ok: false, errorAr, errorEn }.
 */
export function normalizeEgyptPhone(
  raw: string
): { ok: true; value: string } | { ok: false; errorAr: string; errorEn: string } {
  const trimmed = toAsciiDigits(raw).trim();
  if (!trimmed) {
    return {
      ok: false,
      errorAr: 'يرجى إدخال رقم الموبايل.',
      errorEn: 'Mobile number is required.',
    };
  }

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) {
    return {
      ok: false,
      errorAr: 'صيغة رقم الموبايل غير صحيحة.',
      errorEn: 'Invalid mobile number format.',
    };
  }

  let candidate = '';
  if (hasPlus) {
    candidate = `+${digits}`;
  } else if (digits.startsWith('0020')) {
    candidate = `+20${digits.slice(4)}`;
  } else if (digits.startsWith('20') && digits.length === 12) {
    candidate = `+${digits}`;
  } else if (digits.startsWith('01') && digits.length === 11) {
    candidate = `+2${digits}`;
  } else if (digits.startsWith('1') && digits.length === 10) {
    candidate = `+20${digits}`;
  } else {
    return {
      ok: false,
      errorAr: 'يرجى إدخال رقم موبايل مصري صحيح (مثال: 01012345678).',
      errorEn: 'Please enter a valid Egyptian mobile number (e.g. 01012345678).',
    };
  }

  if (!EGYPT_E164_REGEX.test(candidate)) {
    return {
      ok: false,
      errorAr: 'رقم الموبايل يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015.',
      errorEn: 'Mobile number must start with 010, 011, 012, or 015.',
    };
  }

  return { ok: true, value: candidate };
}
