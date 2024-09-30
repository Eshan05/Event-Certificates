function showToast(type, title, desc) {
  const toastContainer = document.getElementById('toast-container') || createToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast ${type} dark:bg-[#272727] dark:text-[#ddd] border-l-4 shadow-xl`; // Add classes for styling
  if (type === 'success') toast.classList.add(`border-[#4caf50]`)
  if (type === 'error') toast.classList.add(`border-[#2196F3]`)
  if (type === 'info') toast.classList.add(`border-[#f44336]`)
  toast.innerHTML = `
    <aside class="flex items-center">
      <div class="mr-4">
        <i class="${getIcon(type)}"></i>
      </div>
      <div class="tracking-wide">
        <strong class="block dark:text-[#cecece] text-[#272727] font-bold !text-md">${title}</strong>
        <span class="text-gray-500 dark:text-gray-300 text-sm">${desc}</span>
      </div>
    </aside>
  `;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toastContainer.removeChild(toast);
  }, 3000);
}

function getIcon(type) {
  switch (type) {
    case 'success': return 'fas fa-check-circle';
    case 'info': return 'fas fa-info-circle';
    case 'error': return 'fas fa-exclamation-circle';
    default: return 'fas fa-info-circle';
  }
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed bottom-0 right-0 p-4';
  document.body.appendChild(container);
  return container;
}

function createHeader(title, subtitle, imageUrl) {
  return `
      <div id="avatar">
        <a href="https://aces-rmdssoe.tech">
          <img src="${imageUrl}" alt="Logo" border="0" class="w-[3em] h-[3em] rounded-[50%] mt-4" loading="lazy" />
        </a>
      </div>
      <h1 class="pt-4 pb-2 text-4xl font-bold lg:text-5xl 2xl:text-6xl">
        <a href="/">${title}</a>
      </h1>
      <h2 class="text-2xl lg:text-3xl 2xl:text-4xl mb-2">${subtitle}</h2>
      <section id="header-icons">
        <a href="https://github.com/ACES-RMDSSOE" target="_blank" class="text-[1.25em] hover:text-[#6e5494]"><i class="fa-brands fa-github"></i></a>
        <a href="https://www.linkedin.com/company/aces-rmdssoe/" target="_blank" class="text-[1.25em] hover:text-[#0a66c2]"><i class="fa-brands fa-linkedin"></i></a>
        <a href="https://www.instagram.com/aces_rmdssoe" target="_blank" class="text-[1.25em] hover:text-[#c13584]"><i class="fa-brands fa-instagram"></i></a>
        <a href="https://chat.whatsapp.com/JMnbIm2k3cXAuj9zt38Xbx" target="_blank" class="text-[1.25em] hover:text-[green]"><i class="fa-brands fa-whatsapp"></i></a>
        <a href="https://aces-rmdssoe.tech" target="_blank" class="text-[1.25em] hover:text-[#444]"><i class="fa-solid fa-globe"></i></a>
      </section>
  `;
}

const themeToggleBtn = document.getElementById('theme-toggle');
function setTheme() {
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  if (document.documentElement.classList.contains('dark')) {
    localStorage.setItem('theme', 'dark');
  } else {
    localStorage.setItem('theme', 'light');
  }
}

themeToggleBtn.addEventListener('click', toggleTheme);
setTheme();

tailwind.config = {
  darkMode: 'class', // or 'media' for automatic preference
}