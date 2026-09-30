/**
 * Componente Ground Truth Card - Validação em Tempo Real com Estações Meteorológicas do IPMA
 */

import { formatTime, formatTemp, formatWind } from '../utils/formatters.js';

export function renderGroundTruthCard(container, { groundTruthData, isPortugal = true }) {
  if (!isPortugal || !groundTruthData || !groundTruthData.station) {
    container.innerHTML = `
      <section class="section-container ground-truth-section info-mode">
        <div class="gt-header">
          <div class="gt-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div>
            <h3 class="section-title">Validação Ground Truth com Estações Físicas</h3>
            <p class="section-subtitle">
              ${isPortugal ? 'À procura de estações com dados recentes em redor...' : 'A rede de validação automática por estações de superfície do IPMA está ativa em território português (Continente e Ilhas).'}
            </p>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const { station, realTemp, realWind, ranking, winner } = groundTruthData;
  const isConsensusWinner = winner?.isConsensus;

  const rankingRows = ranking.map((item, idx) => {
    const isWinner = idx === 0;
    const isConsensus = item.isConsensus;
    return `
      <tr class="gt-row ${isWinner ? 'row-winner' : ''} ${isConsensus ? 'row-consensus' : ''}">
        <td class="col-rank">
          ${isWinner ? '<span class="crown-icon">👑 #1</span>' : `#${idx + 1}`}
        </td>
        <td class="col-name">
          <span class="gt-model-dot" style="background-color: ${item.color}"></span>
          <strong>${item.name}</strong>
          ${isConsensus ? '<span class="tag-consensus-highlight">Motor Blending</span>' : ''}
        </td>
        <td class="col-pred">${item.predictedTemp.toFixed(1)}°C</td>
        <td class="col-error">
          <span class="error-badge ${item.errorTemp <= 0.5 ? 'err-excellent' : (item.errorTemp <= 1.2 ? 'err-good' : 'err-high')}">
            ±${item.errorTemp.toFixed(1)}°C
          </span>
        </td>
        <td class="col-score">
          <div class="score-bar-wrap">
            <div class="score-bar-fill" style="width: ${item.accuracyScore}%; background-color: ${item.color}"></div>
            <span class="score-num">${item.accuracyScore}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <section class="section-container ground-truth-section">
      <div class="gt-header-row">
        <div class="gt-title-block">
          <div class="gt-live-badge">
            <span class="live-pulse"></span>
            <span>Ground Truth em Tempo Real</span>
          </div>
          <h3 class="section-title">Verificação com Estação Oficial do IPMA</h3>
          <p class="section-subtitle">
            Estação física de solo: <strong>${station.name}</strong> (a ~${station.distanceKm} km do local) • Medição das ${formatTime(station.time)}
            ${station.distanceKm > 6 ? `<br><small style="color: #94a3b8; font-size: 0.82em; display: inline-block; margin-top: 2px;">Nota: Esta localidade não possui estação física no local; a verificação baseia-se na estação oficial de superfície mais próxima da rede do IPMA.</small>` : ''}
          </p>
        </div>

        <div class="station-real-box">
          <span class="station-box-label">Estação Física (${station.name})</span>
          <span class="station-box-temp">${formatTemp(realTemp)}°C</span>
          <span class="station-box-sub">${station.humidity ? `${station.humidity}% humidade` : ''} ${station.windSpeed ? `• ${formatWind(station.windSpeed, station.windDirection)}` : ''}</span>
        </div>
      </div>

      <div class="gt-verdict-banner ${isConsensusWinner ? 'banner-consensus-win' : 'banner-model-win'}">
        <div class="verdict-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <div class="verdict-text">
          <strong>Veredito da Hora Atual:</strong> 
          ${isConsensusWinner 
            ? `O <strong>Consenso Multimodelo</strong> superou os modelos isolados com uma aproximação de apenas ±${winner.errorTemp}°C da leitura real do sensor!` 
            : `O modelo <strong>${winner.name}</strong> teve a menor margem de erro (±${winner.errorTemp}°C), seguido de perto pelo Consenso.`
          }
        </div>
      </div>

      <div class="table-responsive">
        <table class="gt-table">
          <thead>
            <tr>
              <th class="col-rank">Posição</th>
              <th class="col-name">Modelo / Sistema</th>
              <th class="col-pred">Previu</th>
              <th class="col-error">Desvio Real</th>
              <th class="col-score">Precisão</th>
            </tr>
          </thead>
          <tbody>
            ${rankingRows}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
