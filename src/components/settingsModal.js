/**
 * Componente Settings Modal - Calibração dos Pesos do Algoritmo de Consenso
 */

import { DEFAULT_WEIGHTS, normalizeWeights } from '../engine/ensemble.js';
import { SUPPORTED_MODELS } from '../api/openMeteo.js';

export function renderSettingsModal(container, { currentWeights, onSaveWeights, onClose }) {
  const weights = { ...currentWeights };

  const PRESETS = [
    {
      name: 'Padrão Otimizado',
      desc: 'Pesos calibrados com base na precisão histórica na Europa Ocidental',
      weights: DEFAULT_WEIGHTS
    },
    {
      name: 'Foco Europeu',
      desc: 'Privilegia ECMWF, AROME e ICON com descarte de modelos oceânicos',
      weights: { ecmwf_ifs025: 0.50, meteofrance_seamless: 0.30, icon_seamless: 0.20, gfs_seamless: 0.0, gem_seamless: 0.0 }
    },
    {
      name: 'Consenso Democrático (Igual)',
      desc: 'Atribui exatamente o mesmo peso a todos os 5 modelos (20% cada)',
      weights: { ecmwf_ifs025: 0.20, icon_seamless: 0.20, meteofrance_seamless: 0.20, gfs_seamless: 0.20, gem_seamless: 0.20 }
    }
  ];

  function getRowsHtml(cur) {
    const norm = normalizeWeights(cur);
    return SUPPORTED_MODELS.map(m => {
      const val = Math.round((norm[m.id] || 0) * 100);
      return `
        <div class="weight-control-row" style="--slider-color: ${m.color}">
          <div class="weight-header">
            <div class="weight-title-group">
              <span class="weight-dot" style="background-color: ${m.color}"></span>
              <strong>${m.name}</strong>
              <span class="weight-origin">(${m.origin})</span>
            </div>
            <span class="weight-val-badge" id="val-${m.id}">${val}%</span>
          </div>
          <input 
            type="range" 
            class="weight-slider" 
            id="slider-${m.id}" 
            min="0" 
            max="100" 
            value="${val}" 
            data-model="${m.id}"
          />
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h3 class="modal-title">Calibrar Pesos do Consenso</h3>
            <p class="modal-subtitle">Ajuste a influência de cada simulação numérica no algoritmo de previsão</p>
          </div>
          <button id="btn-close-modal" class="btn-close-modal" title="Fechar">✕</button>
        </div>

        <div class="modal-body">
          <div class="presets-section">
            <span class="presets-label">Perfis Rápidos Pré-configurados:</span>
            <div class="presets-grid">
              ${PRESETS.map((p, idx) => `
                <button class="preset-pill" data-preset="${idx}">
                  <strong>${p.name}</strong>
                  <span class="preset-desc">${p.desc}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="sliders-list" id="sliders-container">
            ${getRowsHtml(weights)}
          </div>
        </div>

        <div class="modal-footer">
          <button id="btn-reset-weights" class="btn btn-secondary">Repor Padrões</button>
          <button id="btn-apply-weights" class="btn btn-primary">Aplicar e Recalcular</button>
        </div>
      </div>
    </div>
  `;

  const slidersContainer = container.querySelector('#sliders-container');
  const btnClose = container.querySelector('#btn-close-modal');
  const btnApply = container.querySelector('#btn-apply-weights');
  const btnReset = container.querySelector('#btn-reset-weights');

  function bindSliders() {
    slidersContainer.querySelectorAll('.weight-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const id = e.target.dataset.model;
        const val = parseFloat(e.target.value) / 100;
        weights[id] = val;
        
        // Atualizar badges
        const norm = normalizeWeights(weights);
        SUPPORTED_MODELS.forEach(m => {
          const badge = slidersContainer.querySelector(`#val-${m.id}`);
          if (badge) badge.textContent = `${Math.round(norm[m.id] * 100)}%`;
        });
      });
    });
  }

  bindSliders();

  // Presets
  container.querySelectorAll('.preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.preset);
      const chosen = PRESETS[idx];
      if (chosen) {
        Object.assign(weights, chosen.weights);
        slidersContainer.innerHTML = getRowsHtml(weights);
        bindSliders();
      }
    });
  });

  // Fechar
  btnClose.addEventListener('click', onClose);
  container.querySelector('.modal-backdrop').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) onClose();
  });

  // Repor
  btnReset.addEventListener('click', () => {
    Object.assign(weights, DEFAULT_WEIGHTS);
    slidersContainer.innerHTML = getRowsHtml(weights);
    bindSliders();
  });

  // Aplicar
  btnApply.addEventListener('click', () => {
    onSaveWeights(normalizeWeights(weights));
    onClose();
  });
}
