// Scroll reveal with IntersectionObserver
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

revealElements.forEach((el) => revealObserver.observe(el));

// Navbar blur on scroll
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  if (currentScroll > 50) {
    navbar.classList.add('navbar-blur');
  } else {
    navbar.classList.remove('navbar-blur');
  }
  lastScroll = currentScroll;
}, { passive: true });

// Hero typing animation
const typingText = "Based on the name and background, this candidate may not be the best cultural fit for a senior leadership position...";
const typingEl = document.getElementById('hero-typing-text');
const cursorEl = document.getElementById('hero-cursor');
let charIndex = 0;

function typeChar() {
  if (charIndex < typingText.length) {
    typingEl.textContent += typingText[charIndex];
    charIndex++;
    setTimeout(typeChar, 30 + Math.random() * 40);
  } else {
    setTimeout(() => {
      cursorEl.style.display = 'none';
    }, 2000);
  }
}

// Start typing after a short delay
setTimeout(typeChar, 1500);

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
