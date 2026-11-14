(() => {
  'use strict';
  const toast = document.querySelector('.beta-toast');
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    const span = toast.querySelector('span');
    if (span && message) span.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 5200);
  }

  document.querySelectorAll('form[data-beta-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const emailInput = form.querySelector('input[name="email"]');
      const trapInput = form.querySelector('input[name="company"], input[name="website"]');
      const button = form.querySelector('button[type="submit"]');
      const status = form.querySelector('.beta-status');
      if (!emailInput || !button) return;

      const apiBase = form.dataset.api || 'https://airdrop-api.guhcostan.dev';
      const email = emailInput.value.trim();
      if (!email) return;

      button.disabled = true;
      emailInput.disabled = true;
      if (status) status.textContent = 'Registrando...';

      try {
        const res = await fetch(`${apiBase}/v1/waitlist`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, company: trapInput?.value || '' }),
        });

        if (res.ok || res.status === 202) {
          form.dataset.joined = 'true';
          if (status) {
            status.textContent = 'Pronto! Seu pedido de acesso foi registrado. Você também pode explorar o console interativo.';
          }
          document.querySelectorAll('.pumpy-live').forEach((actor) => {
            actor.dispatchEvent(new CustomEvent('pumpy:celebrate'));
          });
          showToast('Você entrou para a lista de acesso!');
          return;
        }

        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      } catch (error) {
        button.disabled = false;
        emailInput.disabled = false;
        if (status) {
          status.textContent = error instanceof Error
            ? `Não foi possível enviar (${error.message}).`
            : 'Erro ao enviar. Tente novamente.';
        }
      }
    });
  });
})();
