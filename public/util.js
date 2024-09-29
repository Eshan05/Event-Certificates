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
