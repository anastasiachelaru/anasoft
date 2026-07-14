// Interactive scripts for AnaSoft website
document.addEventListener('DOMContentLoaded', () => {
  console.log('AnaSoft Site - Connection Verification Page Initialized!');

  // Simple micro-interaction: update status badge message on click
  const badge = document.getElementById('pipeline-badge');
  if (badge) {
    badge.addEventListener('click', () => {
      const text = badge.querySelector('.badge-text');
      if (text) {
        text.textContent = 'Pipeline Active & Verifying...';
        setTimeout(() => {
          text.textContent = 'GitHub ↔ Chroot: Conectat';
        }, 2000);
      }
    });
  }
});
