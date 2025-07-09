export function probToHex(logProb: number) {
  // 1. Convert logProb to probability in [0,1]
  const p = Math.exp(logProb);
  const clamped = Math.max(0, Math.min(1, p));

  // 2. Compute grayscale intensity: p=1→0 (black), p=0→255 (white)
  const intensity = Math.round((1 - clamped) * 255);
  const hex = intensity.toString(16).padStart(2, "0");
  const background = `#${hex}${hex}${hex}`;

  // 3. Choose text color based on brightness for contrast
  //    brightness = intensity (since R=G=B=intensity)
  //    threshold ~128: dark bg → white text; light bg → black text
  const text = intensity < 128 ? "#ffffff" : "#000000";

  return { background, text };
}
