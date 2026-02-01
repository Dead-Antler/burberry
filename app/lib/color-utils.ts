/**
 * Color utilities for generating deterministic colors from strings
 * with WCAG-compliant contrast for text readability.
 */

/**
 * Generate a deterministic hue (0-360) from a string using djb2 hash
 */
export function stringToHue(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

/**
 * Convert HSL to RGB
 * @param h Hue (0-360)
 * @param s Saturation (0-1)
 * @param l Lightness (0-1)
 */
export function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Calculate relative luminance per WCAG 2.1
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function calculateRelativeLuminance(r: number, g: number, b: number): number {
  const [R, G, B] = [r, g, b].map((v) => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calculate contrast ratio between two luminances
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Generate a background color and contrasting text color from a group name.
 * Uses pastel-like colors (moderate saturation, high lightness) for backgrounds.
 * Text color is black or white based on WCAG AA contrast requirements (4.5:1).
 */
export function groupNameToColor(name: string): { bg: string; text: string } {
  const hue = stringToHue(name);

  // Use moderate saturation and high lightness for pastel-like backgrounds
  const saturation = 0.55;
  const lightness = 0.8;

  const { r, g, b } = hslToRgb(hue, saturation, lightness);
  const bgLuminance = calculateRelativeLuminance(r, g, b);

  // Black text luminance = 0, white text luminance = 1
  const blackContrast = contrastRatio(bgLuminance, 0);
  const whiteContrast = contrastRatio(bgLuminance, 1);

  // Use whichever provides better contrast (WCAG AA requires 4.5:1 for normal text)
  const textColor = blackContrast >= whiteContrast ? '#000000' : '#ffffff';

  return {
    bg: `hsl(${hue}, ${saturation * 100}%, ${lightness * 100}%)`,
    text: textColor,
  };
}
