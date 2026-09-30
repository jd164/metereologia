/**
 * Componente Header e Barra de Pesquisa com Autocomplete
 */

import { searchLocations } from '../api/openMeteo.js';
import { getIpmaLocations } from '../api/ipma.js';

export function renderHeader(container, { onSelectLocation, onOpenSettings, currentLoc, favorites }) {
  container.innerHTML = `
    <header class="app-header">
      <div class="header-top">
        <div class="logo-area">
          <div class="logo-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.5 19H9a5 5 0 0 1 0-10c.2 0 .4 0 .6.1A5.5 5.5 0 0 1 19.5 14a4 4 0 0 1-2 5Z"/>
              <path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
          </div>
          <div class="logo-titles">
            <h1 class="logo-title">ClimaConsenso</h1>
            <span class="logo-badge">Ensemble Multi-Model Engine</span>
          </div>
        </div>

        <div class="header-actions">
          <button id="btn-gps" class="btn btn-glass" title="Usar localização atual por GPS">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="12 2 15 8 12 6 9 8 12 2"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
            <span class="btn-text-mobile-hide">GPS</span>
          </button>
          
          <button id="btn-settings" class="btn btn-glass" title="Calibrar pesos dos modelos meteorológicos">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            <span class="btn-text-mobile-hide">Calibrar Pesos</span>
          </button>
        </div>
      </div>

      <div class="search-section">
        <div class="search-box-wrapper">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input 
            type="text" 
            id="location-search-input" 
            class="search-input" 
            placeholder="Pesquisar cidade ou concelho (ex: Porto, Braga, Lisboa, Coimbra, Madrid, Londres...)"
            autocomplete="off"
          />
          <button id="clear-search-btn" class="clear-search-btn hidden" title="Limpar">✕</button>
          <div id="search-autocomplete-dropdown" class="autocomplete-dropdown hidden"></div>
        </div>

        <!-- Quick Favorites Pills -->
        <div class="quick-favorites" id="quick-favorites-container"></div>
      </div>
    </header>
  `;

  const searchInput = container.querySelector('#location-search-input');
  const clearBtn = container.querySelector('#clear-search-btn');
  const dropdown = container.querySelector('#search-autocomplete-dropdown');
  const favContainer = container.querySelector('#quick-favorites-container');
  const btnGps = container.querySelector('#btn-gps');
  const btnSettings = container.querySelector('#btn-settings');

  // Renderizar pills de favoritos
  function updateFavoritesPills() {
    favContainer.innerHTML = favorites.map(fav => `
      <button class="pill-favorite ${fav.name === currentLoc?.name ? 'active' : ''}" data-lat="${fav.latitude}" data-lon="${fav.longitude}" data-name="${fav.name}">
        ${fav.name}
      </button>
    `).join('');

    favContainer.querySelectorAll('.pill-favorite').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const fav = favorites.find(f => f.name === name);
        if (fav) onSelectLocation(fav);
      });
    });
  }

  updateFavoritesPills();

  // Pesquisa com debounce
  let searchTimeout = null;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
      dropdown.classList.add('hidden');
      return;
    }

    if (val.length < 2) {
      dropdown.classList.add('hidden');
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      dropdown.innerHTML = `<div class="autocomplete-item loading">A pesquisar localidades...</div>`;
      dropdown.classList.remove('hidden');

      // Buscar nos distritos/concelhos do IPMA e na Open-Meteo
      const [ipmaLocs, globalLocs] = await Promise.all([
        getIpmaLocations(),
        searchLocations(val)
      ]);

      const normalizedVal = val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      
      const filteredIpma = ipmaLocs.filter(l => 
        l.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(normalizedVal)
      ).slice(0, 5);

      const combined = [
        ...filteredIpma.map(i => ({
          name: i.name,
          country: 'Portugal',
          latitude: i.latitude,
          longitude: i.longitude,
          globalIdLocal: i.globalIdLocal,
          badge: 'IPMA Oficial'
        })),
        ...globalLocs.filter(g => !filteredIpma.some(i => i.name.toLowerCase() === g.name.toLowerCase()))
          .slice(0, 6)
          .map(g => ({
            name: g.name,
            country: g.country || (g.admin1 ? `${g.admin1}` : ''),
            latitude: g.latitude,
            longitude: g.longitude,
            globalIdLocal: null,
            badge: g.countryCode === 'PT' ? 'Portugal' : (g.country || 'Global')
          }))
      ];

      if (combined.length === 0) {
        dropdown.innerHTML = `<div class="autocomplete-item empty">Nenhuma localidade encontrada para "${val}"</div>`;
        return;
      }

      dropdown.innerHTML = combined.map((loc, idx) => `
        <div class="autocomplete-item" data-index="${idx}">
          <div class="autocomplete-info">
            <span class="autocomplete-name">${loc.name}</span>
            <span class="autocomplete-country">${loc.country}</span>
          </div>
          <span class="autocomplete-badge">${loc.badge}</span>
        </div>
      `).join('');

      dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.index);
          const selected = combined[idx];
          if (selected) {
            searchInput.value = selected.name;
            dropdown.classList.add('hidden');
            onSelectLocation(selected);
          }
        });
      });
    }, 280);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    dropdown.classList.add('hidden');
    searchInput.focus();
  });

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Botão GPS
  btnGps.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada neste navegador.');
      return;
    }
    btnGps.classList.add('loading');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        btnGps.classList.remove('loading');
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        
        // Tentar encontrar se é concelho próximo do IPMA
        const ipmaLocs = await getIpmaLocations();
        let closest = null;
        let minDist = Infinity;
        for (const loc of ipmaLocs) {
          const d = Math.hypot(lat - loc.latitude, lon - loc.longitude);
          if (d < minDist) {
            minDist = d;
            closest = loc;
          }
        }

        const isVeryClose = minDist < 0.2; // ~20km
        const loc = {
          name: isVeryClose ? closest.name : 'Minha Localização',
          country: 'Portugal',
          latitude: lat,
          longitude: lon,
          globalIdLocal: isVeryClose ? closest.globalIdLocal : null
        };
        onSelectLocation(loc);
      },
      (err) => {
        btnGps.classList.remove('loading');
        alert('Não foi possível obter a sua localização GPS: ' + err.message);
      },
      { timeout: 10000 }
    );
  });

  // Botão Definições / Pesos
  btnSettings.addEventListener('click', () => {
    onOpenSettings();
  });
}
