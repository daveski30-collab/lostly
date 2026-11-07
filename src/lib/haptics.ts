// Web: no haptics, but a short vibration where the browser supports it (Android Chrome).
const buzz = (ms: number | number[]) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {}
  return Promise.resolve();
};

export const tick = () => buzz(8);
export const thump = () => buzz(15);
export const success = () => buzz([12, 40, 18]);
export const warn = () => buzz([20, 30, 20]);
