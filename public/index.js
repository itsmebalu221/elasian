document.addEventListener('DOMContentLoaded', () => {
  /* --- 1. Lightbox Logic --- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.querySelector('.close-lightbox');
  const scrollImages = document.querySelectorAll('.scroll-target');

  if (lightbox) {
    scrollImages.forEach(img => {
      img.addEventListener('click', () => {
        lightbox.style.display = 'flex';
        if (lightboxImg) lightboxImg.src = img.src;
        document.body.style.overflow = 'hidden';
      });
    });

    const closeLightbox = () => {
      lightbox.style.display = 'none';
      document.body.style.overflow = 'auto';
    };

    closeBtn?.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
      if (e.target !== lightboxImg) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.style.display === 'block') closeLightbox();
    });
  }

  /* --- 2. Futuristic Particle Logic --- */
  const canvas = document.getElementById('hero-particles');
  if (!canvas) return; // Exit if canvas doesn't exist on this page

  const ctx = canvas.getContext('2d');
  let particles = [];

  // Adjust particle count based on screen width for better performance
  const getParticleCount = () => window.innerWidth < 768 ? 40 : 80;

  function init() {
    const heroSection = document.querySelector('.hero');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    console.log("Canvas initialized:", canvas.width, "x", canvas.height);

    particles = [];
    const count = window.innerWidth < 768 ? 40 : 80;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: Math.random() * 3 + 1
      });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(107, 140, 206, 0.5)';
    ctx.strokeStyle = 'rgba(107, 140, 206, 0.15)'; // Slightly higher visibility for lines

    particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around screen instead of bouncing (feels more "infinite/futuristic")
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) {
          ctx.lineWidth = 1 - dist / 150; // Lines fade out as particles get further away
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    init();
  });

  /* --- 3. Auto-Scrolling Carousel Logic --- */
  const initCarousel = () => {
    const scroller = document.querySelector('.image-scroller');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');

    if (!scroller) return;

    let isPaused = false;

    // Pause on hover/touch
    scroller.addEventListener('mouseenter', () => isPaused = true);
    scroller.addEventListener('mouseleave', () => isPaused = false);
    scroller.addEventListener('touchstart', () => isPaused = true);
    scroller.addEventListener('touchend', () => isPaused = false);

    const scrollNext = () => {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const currentScroll = scroller.scrollLeft;

      if (currentScroll >= maxScroll - 10) {
        scroller.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        scroller.scrollBy({ left: scroller.clientWidth, behavior: 'smooth' });
      }
    };

    const scrollPrev = () => {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const currentScroll = scroller.scrollLeft;

      if (currentScroll <= 10) {
        scroller.scrollTo({ left: maxScroll, behavior: 'smooth' });
      } else {
        scroller.scrollBy({ left: -scroller.clientWidth, behavior: 'smooth' });
      }
    };

    if (nextBtn) nextBtn.addEventListener('click', scrollNext);
    if (prevBtn) prevBtn.addEventListener('click', scrollPrev);

    // Auto-scroll function
    setInterval(() => {
      if (!isPaused) scrollNext();
    }, 3000);
  };

  initCarousel();

  init();
  animate();
});