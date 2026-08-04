const digitsOnly = (value: string) => value.replace(/\D/g, '')

export function normalizeCpf(value: string) {
  return digitsOnly(value).slice(0, 11)
}

export function formatCpf(value: string) {
  const digits = normalizeCpf(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function normalizeCnpj(value: string) {
  return value.toLocaleUpperCase('pt-BR').replace(/[^A-Z0-9]/g, '').slice(0, 14)
}

export function formatCnpj(value: string) {
  const characters = normalizeCnpj(value)
  const base = characters.slice(0, 12)
  const checkDigits = characters.slice(12).replace(/\D/g, '')
  const normalized = `${base}${checkDigits}`

  return normalized
    .replace(/^([A-Z0-9]{2})([A-Z0-9])/, '$1.$2')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})\.([A-Z0-9]{3})([A-Z0-9])/, '$1.$2.$3/$4')
    .replace(/^([A-Z0-9]{2})\.([A-Z0-9]{3})\.([A-Z0-9]{3})\/([A-Z0-9]{4})(\d)/, '$1.$2.$3/$4-$5')
}

export function normalizeTaxId(value: string, personType: 'PF' | 'PJ') {
  return personType === 'PF' ? normalizeCpf(value) : normalizeCnpj(value)
}

export function formatTaxId(value: string, personType: 'PF' | 'PJ') {
  return personType === 'PF' ? formatCpf(value) : formatCnpj(value)
}

export function normalizePhone(value: string) {
  return digitsOnly(value).slice(0, 11)
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/^(\(\d{2}\) \d{4})(\d)/, '$1-$2')
  }

  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/^(\(\d{2}\) \d{5})(\d)/, '$1-$2')
}
