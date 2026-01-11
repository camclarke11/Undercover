// Haptic feedback utility
export const vibrate = (pattern = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const HAPTIC = {
  TAP: 10,
  SUCCESS: [10, 30, 10],
  WARNING: [30, 50, 10],
  ERROR: [50, 50, 50, 50, 50],
  HEAVY: 50
};
