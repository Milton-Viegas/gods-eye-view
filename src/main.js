import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application
  .start()
  .then((components) => mountSpyMode(components?.scene?.viewer))
  .catch((error) => {
    console.error("God's Eye View initialization failed:", error);
    const loaderStatus = document.querySelector(
      '#loading-screen .loader-status',
    );
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
  });

/**
 * Modo Espião (Operação Olho de Deus): carregado sob demanda depois que o
 * console está pronto. Uma falha aqui nunca derruba o console.
 */
function mountSpyMode(viewer) {
  if (!viewer) return;
  import('./game/spy/index.js')
    .then(({ mountSpyGame }) => {
      // Espera a tela de carregamento sumir antes de abrir o briefing.
      setTimeout(() => {
        try {
          window.gevSpyGame = mountSpyGame({ viewer });
        } catch (error) {
          console.warn('[Modo Espião] falhou ao iniciar:', error);
        }
      }, 900);
    })
    .catch((error) => console.warn('[Modo Espião] indisponível:', error));
}

export { application };
