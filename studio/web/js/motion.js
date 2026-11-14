export function animatePage(main) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const animations = new Map();
  const videos = main.querySelectorAll('.ambient-video');
  const playback = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting && !reduced.matches && !document.hidden) target.play().catch(() => {});
    else target.pause();
  }), { threshold: .05 });
  videos.forEach((video) => playback.observe(video));
  const pauseHidden = () => {
    if (reduced.matches) animations.forEach((animation) => animation.cancel());
    videos.forEach((video) => {
      if (document.hidden || reduced.matches) video.pause();
      else { playback.unobserve(video); playback.observe(video); }
    });
  };
  document.addEventListener('visibilitychange', pauseHidden, { signal: controller.signal });
  reduced.addEventListener('change', pauseHidden, { signal: controller.signal });
  const reveal = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    target.classList.add('is-revealed');
    reveal.unobserve(target);
  }), { threshold: .08 });
  main.querySelectorAll('.workspace > section, .workspace > div, .home-editorial, .home-features .feature, .home-process, .home-note, .home-faq, .home-join').forEach((panel) => {
    panel.classList.add('motion-enter');
    reveal.observe(panel);
  });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced.matches) {
    // Spotlight: cards read the pointer position from --mx/--my (styles.css).
    main.addEventListener('pointermove', (event) => {
      const card = event.target.closest?.('.card');
      if (!card) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - box.left}px`);
      card.style.setProperty('--my', `${event.clientY - box.top}px`);
    }, { signal: controller.signal, passive: true });
    // Magnetic primary buttons drift a few pixels toward the pointer.
    main.querySelectorAll('.btn.primary, button.primary').forEach((button) => {
      button.addEventListener('pointermove', (event) => {
        if (reduced.matches) return;
        const box = button.getBoundingClientRect();
        const x = (event.clientX - box.left - box.width / 2) * .18;
        const y = (event.clientY - box.top - box.height / 2) * .3;
        animations.get(button)?.cancel();
        animations.set(button, button.animate({ translate: `${x}px ${y}px` }, { duration: 200, fill: 'forwards' }));
      }, { signal: controller.signal });
      button.addEventListener('pointerleave', () => {
        animations.get(button)?.cancel();
        animations.set(button, button.animate({ translate: '0 0' }, { duration: 500, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'forwards' }));
      }, { signal: controller.signal });
    });
    main.querySelectorAll('.workspace-intro, .home-features .feature').forEach((panel) => {
      panel.addEventListener('pointermove', (event) => {
        if (reduced.matches) return;
        const box = panel.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - .5;
        const y = (event.clientY - box.top) / box.height - .5;
        animations.get(panel)?.cancel();
        animations.set(panel, panel.animate({ transform: `perspective(1400px) rotateX(${-y * 3}deg) rotateY(${x * 4}deg)` }, { duration: 350, fill: 'forwards' }));
      }, { signal: controller.signal });
      panel.addEventListener('pointerleave', () => {
        animations.get(panel)?.cancel();
        animations.set(panel, panel.animate({ transform: 'perspective(1400px) rotateX(0deg) rotateY(0deg)' }, { duration: 450, fill: 'forwards' }));
      }, { signal: controller.signal });
    });
  }
  return () => {
    main.querySelector('.landing-hero')?.disposeLanding?.();
    main.querySelector('.spatial-lobby')?.disposeRoom?.();
    controller.abort(); playback.disconnect(); reveal.disconnect();
    videos.forEach((video) => { video.pause(); video.removeAttribute('src'); video.load(); });
    animations.forEach((animation) => animation.cancel());
  };
}
