export function initAddPodcastModal() {
  const addPodcastModal = document.getElementById('add-podcast-modal');
  const btnAddPodcastClose = document.getElementById('btn-add-podcast-close');
  btnAddPodcastClose?.addEventListener('click', () => closeAddPodcastModal());
  addPodcastModal?.addEventListener('click', (e) => {
    if (e.target === addPodcastModal) closeAddPodcastModal();
  });
}

export function openAddPodcastModal(prefillUrl = '') {
  const modal = document.getElementById('add-podcast-modal');
  if (!modal) return;
  const input = document.getElementById('podcast-rss-url');
  const errEl = document.getElementById('podcast-add-error');
  if (input) input.value = prefillUrl || '';
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  modal.style.display = 'flex';
  if (prefillUrl && input) {
    input.focus();
  }
}

export function closeAddPodcastModal() {
  const modal = document.getElementById('add-podcast-modal');
  if (modal) modal.style.display = 'none';
}