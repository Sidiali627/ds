// animations.js - Intersection Observer for Scroll Reveals

document.addEventListener('DOMContentLoaded', () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Apply to all sections, cards, and headers
    const revealElements = document.querySelectorAll('.section-header, .card, .tool-card, .map-container, .partners-carousel img');
    revealElements.forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });

    // Make navbar glassmorphic on scroll
    const header = document.getElementById('main-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.style.boxShadow = 'var(--box-shadow)';
                header.style.background = 'var(--glass-bg)';
            } else {
                header.style.boxShadow = 'none';
                header.style.background = 'transparent';
            }
        });
    }
});
