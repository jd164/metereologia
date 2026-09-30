/**
 * ClimaConsenso - Aplicação Meteorológica com Motor de Consenso Multimodelo
 * Orquestrador Principal
 */

import './style.css';

// APIs
import { getMultiModelForecast } from './api/openMeteo.js';
import { 
  getIpmaDailyForecast, 
  getIpmaHourlyForecast,
  findNearestIpmaStation, 
  getIpmaSurfaceObservations,
  getIpmaHourlyStationReadings,
  getNearestIpmaLocation
} from './api/ipma.js';

// Engines
import { computeHourlyConsensus, computeDailyConsensus, DEFAULT_WEIGHTS } from './engine/ensemble.js';
import { calculateHourConfidence } from './engine/confidence.js';
import { evaluateModelAccuracy } from './engine/groundTruth.js';

// Utilities
import { getSavedLocation, saveLocation, getFavorites, getSavedWeights, saveWeights } from './utils/storage.js';

// Components
import { renderHeader } from './components/header.js';
import { renderHeroConsensus } from './components/heroConsensus.js';
import { renderModelComparison } from './components/modelComparison.js';
import { renderGroundTruthCard } from './components/groundTruthCard.js';
import { renderEnsembleChart } from './components/ensembleChart.js';
import { renderHourlyForecast } from './components/hourlyForecast.js';
import { renderDailyForecast } from './components/dailyForecast.js';
import { renderRadarMap } from './components/radarMap.js';
import { renderSettingsModal } from './components/settingsModal.js';

// Estado Global da Aplicação
const state = {
  currentLocation: getSavedLocation(),
  favorites: getFavorites(),
  weights: getSavedWeights() || DEFAULT_WEIGHTS,
  viewMode: 'consensus', // 'consensus' ou 'models'
  multiModelData: null,
  hourlyConsensus: [],
  dailyConsensus: [],
  currentHourData: null,
  confidenceData: null,
  groundTruthData: null,
  surfaceStations: [],
  ipmaDailyForecast: null,
  ipmaHourlyForecast: [],
  ipmaHourlyReadings: [],
  isLoading: false
};

// Elementos DOM
const dom = {
  header: document.getElementById('header-mount'),
  hero: document.getElementById('hero-mount'),
  comparison: document.getElementById('comparison-mount'),
  groundtruth: document.getElementById('groundtruth-mount'),
  chart: document.getElementById('chart-mount'),
  hourly: document.getElementById('hourly-mount'),
  daily: document.getElementById('daily-mount'),
  radar: document.getElementById('radar-mount'),
  modal: document.getElementById('modal-mount')
};

/**
 * Inicialização da Aplicação
 */
async function initApp() {
  renderAppHeader();
  await loadWeatherData();
}

/**
 * Renderiza o Header
 */
function renderAppHeader() {
  renderHeader(dom.header, {
    currentLoc: state.currentLocation,
    favorites: state.favorites,
    onSelectLocation: async (newLoc) => {
      // Se não tiver globalIdLocal mas for Portugal, tentar resolver o mais próximo
      if (!newLoc.globalIdLocal && (newLoc.country === 'Portugal' || newLoc.countryCode === 'PT')) {
        const nearestIpma = await getNearestIpmaLocation(newLoc.latitude, newLoc.longitude);
        if (nearestIpma) {
          newLoc.globalIdLocal = nearestIpma.globalIdLocal;
        }
      }
      state.currentLocation = newLoc;
      saveLocation(newLoc);
      renderAppHeader();
      loadWeatherData();
    },
    onOpenSettings: () => {
      openWeightsSettingsModal();
    }
  });
}

/**
 * Carrega e processa os dados meteorológicos
 */
async function loadWeatherData() {
  state.isLoading = true;
  showLoadingUI();

  try {
    const loc = state.currentLocation;
    const isPortugal = loc.country === 'Portugal' || !!loc.globalIdLocal;

    // Se estiver em Portugal e faltar globalIdLocal, descobrir automaticamente
    if (isPortugal && !loc.globalIdLocal) {
      const nearestIpma = await getNearestIpmaLocation(loc.latitude, loc.longitude);
      if (nearestIpma) {
        loc.globalIdLocal = nearestIpma.globalIdLocal;
      }
    }

    // Chamadas paralelas: Open-Meteo multi-modelo + IPMA (se aplicável)
    const promises = [
      getMultiModelForecast(loc.latitude, loc.longitude)
    ];

    if (loc.globalIdLocal) {
      promises.push(getIpmaDailyForecast(loc.globalIdLocal));
      promises.push(getIpmaHourlyForecast(loc.globalIdLocal));
    } else {
      promises.push(Promise.resolve(null));
      promises.push(Promise.resolve([]));
    }

    if (isPortugal) {
      promises.push(findNearestIpmaStation(loc.latitude, loc.longitude));
      promises.push(getIpmaSurfaceObservations());
    } else {
      promises.push(Promise.resolve(null));
      promises.push(Promise.resolve([]));
    }

    const [multiData, ipmaDaily, ipmaHourly, nearestStation, allStations] = await Promise.all(promises);

    state.multiModelData = multiData;
    state.ipmaDailyForecast = ipmaDaily;
    state.ipmaHourlyForecast = ipmaHourly || [];
    state.surfaceStations = allStations || [];

    // Se tivermos estação mais próxima, obter as leituras horárias reais das últimas 24h
    if (nearestStation?.id) {
      state.ipmaHourlyReadings = await getIpmaHourlyStationReadings(nearestStation.id);
    } else {
      state.ipmaHourlyReadings = [];
    }

    // 1. Processar Ensemble & Consenso
    state.hourlyConsensus = computeHourlyConsensus(multiData, state.weights);
    state.dailyConsensus = computeDailyConsensus(state.hourlyConsensus, ipmaDaily);

    // 2. Determinar a hora atual no fuso horário local
    const currentHourIndex = findClosestHourIndex(state.hourlyConsensus);
    state.currentHourData = state.hourlyConsensus[currentHourIndex] || state.hourlyConsensus[0];

    // 3. Calcular Índice de Confiança do Ensemble
    state.confidenceData = calculateHourConfidence(state.currentHourData);

    // 4. Avaliar Precisão Ground Truth face à estação real
    state.groundTruthData = evaluateModelAccuracy(nearestStation, state.currentHourData);

    // 5. Renderizar todos os componentes
    renderAllComponents();

  } catch (err) {
    console.error('Falha ao carregar dados meteorológicos:', err);
    showErrorUI(err.message);
  } finally {
    state.isLoading = false;
  }
}

/**
 * Encontra o índice da hora exata local no array de horas (sem desfasamento de fuso horário)
 */
function findClosestHourIndex(hours) {
  if (!hours || hours.length === 0) return 0;
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const targetPrefix = `${year}-${month}-${day}T${hour}`;

  // Procurar primeiro por correspondência direta de hora local
  const directIdx = hours.findIndex(h => h.time.startsWith(targetPrefix));
  if (directIdx !== -1) return directIdx;

  // Fallback por proximidade temporal
  const nowMs = now.getTime();
  let closestIdx = 0;
  let minDiff = Infinity;

  hours.forEach((h, idx) => {
    const diff = Math.abs(new Date(h.time).getTime() - nowMs);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = idx;
    }
  });

  return closestIdx;
}

/**
 * Renderiza todos os componentes atualizados com os dados do estado
 */
function renderAllComponents() {
  const isNight = isNightHour(state.currentHourData?.time);

  // 1. Hero
  renderHeroConsensus(dom.hero, {
    location: state.currentLocation,
    currentHour: state.currentHourData,
    confidence: state.confidenceData,
    isNight,
    activeViewMode: state.viewMode,
    onToggleViewMode: (mode) => {
      state.viewMode = mode;
      renderAllComponents();

      if (mode === 'models') {
        setTimeout(() => {
          const compEl = dom.comparison.querySelector('.model-comparison-section');
          if (compEl) {
            compEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            compEl.classList.remove('highlight-pulse');
            void compEl.offsetWidth;
            compEl.classList.add('highlight-pulse');
          }
        }, 50);
      } else {
        dom.hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // 2. Model Comparison (visível em modo 'models' ou como secção detalhada)
  const currentHourIndex = findClosestHourIndex(state.hourlyConsensus);
  const currentHourKey = state.currentHourData?.time?.slice(0, 13);
  const ipmaHourlyToday = state.ipmaHourlyForecast?.find(h => h.time.startsWith(currentHourKey));
  const todayStr = state.currentHourData?.time?.split('T')[0];
  const ipmaToday = state.ipmaDailyForecast?.find(d => d.forecastDate === todayStr);

  renderModelComparison(dom.comparison, {
    currentHour: state.currentHourData,
    weights: state.weights,
    ipmaDailyToday: ipmaToday,
    groundTruthData: state.groundTruthData,
    ipmaHourlyToday
  });

  if (state.viewMode === 'consensus') {
    dom.comparison.classList.remove('hidden');
  } else {
    dom.comparison.classList.remove('hidden');
  }

  // 3. Ground Truth Card
  renderGroundTruthCard(dom.groundtruth, {
    groundTruthData: state.groundTruthData,
    isPortugal: state.currentLocation.country === 'Portugal' || !!state.currentLocation.globalIdLocal
  });

  // 4. Ensemble Chart (com início sincronizado com a hora atual e dados horários oficiais do IPMA)
  renderEnsembleChart(dom.chart, {
    hourlyConsensus: state.hourlyConsensus,
    modelsData: state.multiModelData.modelsData,
    ipmaDailyForecast: state.ipmaDailyForecast,
    groundTruthData: state.groundTruthData,
    ipmaHourlyReadings: state.ipmaHourlyReadings,
    ipmaHourlyForecast: state.ipmaHourlyForecast,
    currentHourIndex
  });

  // 5. Previsão Horária (a começar exatamente na hora atual "Agora")
  renderHourlyForecast(dom.hourly, {
    hourlyConsensus: state.hourlyConsensus,
    currentHourIndex
  });

  // 6. Previsão Diária
  renderDailyForecast(dom.daily, {
    dailyConsensus: state.dailyConsensus
  });

  // 7. Radar Map
  renderRadarMap(dom.radar, {
    location: state.currentLocation,
    surfaceStations: state.surfaceStations
  });
}

function isNightHour(isoString) {
  if (!isoString) return false;
  const hour = new Date(isoString).getHours();
  return hour < 7 || hour >= 21;
}

/**
 * Abre o Modal de Definições de Pesos
 */
function openWeightsSettingsModal() {
  renderSettingsModal(dom.modal, {
    currentWeights: state.weights,
    onClose: () => {
      dom.modal.innerHTML = '';
    },
    onSaveWeights: (newWeights) => {
      state.weights = newWeights;
      saveWeights(newWeights);
      
      // Recalcular instantaneamente com os dados em memória sem refazer requisições de rede
      if (state.multiModelData) {
        state.hourlyConsensus = computeHourlyConsensus(state.multiModelData, state.weights);
        state.dailyConsensus = computeDailyConsensus(state.hourlyConsensus, state.ipmaDailyForecast);
        
        const currentHourIndex = findClosestHourIndex(state.hourlyConsensus);
        state.currentHourData = state.hourlyConsensus[currentHourIndex] || state.hourlyConsensus[0];
        state.confidenceData = calculateHourConfidence(state.currentHourData);

        if (state.groundTruthData?.station) {
          state.groundTruthData = evaluateModelAccuracy(state.groundTruthData.station, state.currentHourData);
        }

        renderAllComponents();
      }
    }
  });
}

/**
 * Efeitos de Carregamento e Erro
 */
function showLoadingUI() {
  dom.hero.innerHTML = `
    <div class="hero-consensus-card" style="text-align: center; padding: 4rem 2rem;">
      <div class="live-pulse" style="width: 16px; height: 16px; margin: 0 auto 1.5rem;"></div>
      <h3 style="font-family: var(--font-display); font-size: 1.5rem; margin-bottom: 0.5rem;">A sintetizar previsões de 5 modelos meteorológicos...</h3>
      <p style="color: var(--text-tertiary); font-size: 0.9rem;">A consultar ECMWF, GFS, ICON, Météo-France e dados oficiais do IPMA</p>
    </div>
  `;
}

function showErrorUI(message) {
  dom.hero.innerHTML = `
    <div class="hero-consensus-card" style="border-color: rgba(239, 68, 68, 0.4); padding: 3rem;">
      <h3 style="color: #f87171; font-family: var(--font-display); margin-bottom: 0.5rem;">Não foi possível carregar as previsões</h3>
      <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${message}</p>
      <button class="btn btn-primary" onclick="window.location.reload()">Tentar Novamente</button>
    </div>
  `;
}

// Iniciar app quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initApp);
