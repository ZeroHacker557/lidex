/**
 * Telefon raqamlarni topish va normallashtirish (asosan O'zbekiston: +998 XX XXX XX XX).
 */

const PHONE_CANDIDATE = /(?:\+|\b)\d[\d \t\-().]{6,24}\d\b/g;

export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // 8 (9x) xxx-xx-xx — eski format
  if (digits.length === 10 && digits.startsWith('8') && raw.trim().startsWith('8')) digits = '998' + digits.slice(1);
  if (digits.length === 9) digits = '998' + digits;
  if (digits.length === 12 && digits.startsWith('998')) return '+' + digits;
  if (digits.length >= 10 && digits.length <= 15 && raw.trim().startsWith('+')) return '+' + digits;
  return null;
}

/** Matndagi barcha telefon raqamlarni topadi (takrorlarsiz, normallashtirilgan) */
export function extractPhones(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(PHONE_CANDIDATE)) {
    const candidate = match[0];
    // Sana yoki vaqtga o'xshash qatorlarni o'tkazib yuborish: 18.10.2026
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(candidate.trim())) continue;
    const p = normalizePhone(candidate);
    if (p) found.add(p);
  }
  return [...found];
}

/** +998901234567 -> +998 90 123 45 67 */
export function formatPhone(p: string | null | undefined): string {
  if (!p) return '—';
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}
