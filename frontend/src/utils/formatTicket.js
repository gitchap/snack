/**
 * Formats a numeric order number into a clean letter+number ticket code.
 * E.g.:
 * 1   -> "Ticket A01"
 * 99  -> "Ticket A99"
 * 100 -> "Ticket B01"
 */
export function formatTicketCode(num) {
  if (!num) return 'Ticket A01';
  const zeroBased = (parseInt(num) - 1) || 0;
  const letterIndex = Math.floor(zeroBased / 99) % 26;
  const letter = String.fromCharCode(65 + letterIndex);
  const number = (zeroBased % 99) + 1;
  const numStr = number < 10 ? `0${number}` : `${number}`;
  return `Ticket ${letter}${numStr}`;
}

export function formatTicketShort(num) {
  if (!num) return 'A01';
  const zeroBased = (parseInt(num) - 1) || 0;
  const letterIndex = Math.floor(zeroBased / 99) % 26;
  const letter = String.fromCharCode(65 + letterIndex);
  const number = (zeroBased % 99) + 1;
  const numStr = number < 10 ? `0${number}` : `${number}`;
  return `${letter}${numStr}`;
}
