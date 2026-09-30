export function whatsappPhone(value: string): string | null {
  if (!/^[+\d\s().-]+$/.test(value.trim())) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(digits) ? digits : null;
}

export function whatsappLink(phone: string, message: string): string | null {
  const normalized = whatsappPhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : null;
}
