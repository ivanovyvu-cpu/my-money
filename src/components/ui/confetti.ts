// Простое конфетти без библиотек: цветные бумажки падают сверху и исчезают.
const COLORS = ['#f26b4a', '#12a594', '#ffc53d', '#8e7cf0', '#3ccf8e', '#ff8fb1'];

export function launchConfetti(count = 90) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80;overflow:hidden';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const size = 6 + Math.random() * 6;
    const dur = 1600 + Math.random() * 1400;
    p.style.cssText = [
      'position:absolute',
      'top:0',
      `left:${Math.random() * 100}%`,
      `width:${size}px`,
      `height:${size * (0.4 + Math.random() * 0.8)}px`,
      `background:${COLORS[i % COLORS.length]}`,
      `border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`,
      `--dx:${(Math.random() - 0.5) * 200}px`,
      `--rot:${(Math.random() - 0.5) * 1440}deg`,
      `animation:confetti-fall ${dur}ms cubic-bezier(.2,.6,.4,1) ${Math.random() * 400}ms both`,
    ].join(';');
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3400);
}
