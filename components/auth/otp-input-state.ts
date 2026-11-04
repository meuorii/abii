export function sanitizeOtpInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function changedOtpPositions(previous: string, next: string) {
  return Array.from({ length: 6 }, (_, index) => index).filter(index => previous[index] !== next[index]);
}

export function otpDigitDelay(position: number, pasted: boolean) {
  return pasted ? position * 16 : 0;
}

export function nextOtpCaretPosition(position: number, direction: "left" | "right") {
  return Math.max(0, Math.min(6, position + (direction === "left" ? -1 : 1)));
}
