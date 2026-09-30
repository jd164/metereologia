/**
 * Componente Radar Map - Mapa Interativo com Leaflet, Radar de Chuva RainViewer e Estações IPMA
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRainViewerFrames } from '../api/rainViewer.js';
import { formatTime } from '../utils/formatters.js';

let mapInstance = null;
let radarTileLayers = [];
let radarFrames = [];
let currentFrameIndex = 0;
let animationTimer = null;
let isPlaying = false;
let stationMarkersGroup = null;
let userMarker = null;

// Fix para ícones padrão do Leaflet no Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export async function renderRadarMap(container, { location, surfaceStations = [] }) {
  // Limpar instância anterior antes de substituir o HTML para evitar DOM órfão no Leaflet
  if (mapInstance) {
    try {
      mapInstance.remove();
    } catch (e) {
      console.warn('Erro ao limpar mapa:', e);
    }
    mapInstance = null;
  }
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
  }
  isPlaying = false;
  radarTileLayers = [];

  container.innerHTML = `
    <section class="section-container radar-section">
      <div class="section-header-row">
        <div>
          <h3 class="section-title">Radar de Precipitação e Rede de Estações</h3>
          <p class="section-subtitle">Acompanhe frentes de chuva em tempo real e sensores físicos do IPMA</p>
        </div>

        <div class="radar-controls">
          <button id="btn-radar-play" class="btn btn-radar-action" title="Iniciar/Pausar animação do radar">
            <svg id="radar-play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span id="radar-btn-label">Radar Ao Vivo</span>
          </button>
          <span id="radar-time-label" class="radar-time-label">A carregar radar...</span>
        </div>
      </div>

      <div class="radar-map-wrapper">
        <div id="leaflet-map-container" class="leaflet-map-canvas" style="min-height: 450px; height: 450px; width: 100%; position: relative; z-index: 1;"></div>

        <div class="radar-map-overlay-legend">
          <span class="legend-item"><span class="legend-dot dot-station"></span> Estação IPMA</span>
          <span class="legend-item"><span class="legend-dot dot-location"></span> Local Pesquisado</span>
          <span class="legend-item"><span class="legend-dot dot-rain"></span> Frente de Chuva</span>
        </div>
      </div>
    </section>
  `;

  const mapEl = container.querySelector('#leaflet-map-container');
  const btnPlay = container.querySelector('#btn-radar-play');
  const timeLabel = container.querySelector('#radar-time-label');

  initLeafletMap(mapEl, location, surfaceStations);
  setupRainViewerRadar(timeLabel, btnPlay);
}

function initLeafletMap(containerEl, location, surfaceStations) {
  if (!containerEl) return;
  if (containerEl._leaflet_id) {
    containerEl._leaflet_id = null;
  }

  const lat = location?.latitude || 38.7167;
  const lon = location?.longitude || -9.139;

  mapInstance = L.map(containerEl, {
    center: [lat, lon],
    zoom: 8,
    minZoom: 4,
    maxZoom: 18,
    zoomControl: true,
    scrollWheelZoom: false
  });

  // OpenStreetMap direto e confiável
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    crossOrigin: true
  }).addTo(mapInstance);

  // Marcador customizado da localização
  const userIcon = L.divIcon({
    className: 'custom-user-marker',
    html: `<div class="user-pulse-marker"><span></span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  userMarker = L.marker([lat, lon], { icon: userIcon })
    .addTo(mapInstance)
    .bindPopup(`<strong>${location.name}</strong><br>${location.country}`);

  // Grupo de marcadores das estações de superfície do IPMA
  stationMarkersGroup = L.layerGroup().addTo(mapInstance);

  surfaceStations.forEach(st => {
    const dist = Math.hypot(st.latitude - lat, st.longitude - lon);
    if (dist < 1.5) { // ~150km
      const stationIcon = L.divIcon({
        className: 'custom-station-marker',
        html: `<div class="station-pin" title="${st.name}: ${st.temperature}°C"><span>${Math.round(st.temperature)}°</span></div>`,
        iconSize: [34, 24],
        iconAnchor: [17, 12]
      });

      const marker = L.marker([st.latitude, st.longitude], { icon: stationIcon });
      marker.bindPopup(`
        <div class="station-popup">
          <strong>${st.name}</strong> (Estação IPMA)<br>
          🌡️ <strong>Temperatura:</strong> ${st.temperature}°C<br>
          💧 <strong>Humidade:</strong> ${st.humidity ? `${st.humidity}%` : '--'}<br>
          💨 <strong>Vento:</strong> ${st.windSpeed ? `${Math.round(st.windSpeed)} km/h` : '--'}<br>
          ⏱️ <strong>Hora:</strong> ${formatTime(st.time)}
        </div>
      `);
      stationMarkersGroup.addLayer(marker);
    }
  });

  // Forçar recálculo das dimensões do mapa após o DOM ser montado
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 100);
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 400);
  setTimeout(() => {
    if (mapInstance) mapInstance.invalidateSize();
  }, 1000);
}

async function setupRainViewerRadar(timeLabel, btnPlay) {
  const data = await getRainViewerFrames();
  if (!data || !data.past || data.past.length === 0) {
    if (timeLabel) timeLabel.textContent = 'Radar temporariamente indisponível';
    return;
  }

  radarFrames = [...data.past, ...(data.nowcast || [])];
  const host = data.host;

  if (!mapInstance) return;

  // Usar maxNativeZoom: 7 para que o Leaflet escale os tiles em zooms maiores, eliminando o erro 'Zoom level not supported'
  radarTileLayers = radarFrames.map(frame => {
    return L.tileLayer(`${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      tileSize: 256,
      opacity: 0.001,
      zIndex: 100,
      maxNativeZoom: 7,
      maxZoom: 18
    });
  });

  radarTileLayers.forEach(layer => layer.addTo(mapInstance));

  currentFrameIndex = data.past.length - 1;
  showFrame(currentFrameIndex, timeLabel);

  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      if (isPlaying) {
        stopRadarAnimation(btnPlay);
      } else {
        startRadarAnimation(timeLabel, btnPlay);
      }
    });
  }
}

function showFrame(index, timeLabel) {
  if (!radarTileLayers.length || !radarFrames[index]) return;

  radarTileLayers.forEach((layer, idx) => {
    if (idx === index) {
      layer.setOpacity(0.75);
    } else {
      layer.setOpacity(0);
    }
  });

  const frameTime = new Date(radarFrames[index].time * 1000);
  const now = new Date();
  const isNowcast = frameTime > now;
  const timeStr = formatTime(frameTime.toISOString());
  if (timeLabel) {
    timeLabel.textContent = `${isNowcast ? 'Previsão Radar:' : 'Radar:'} ${timeStr}`;
  }
}

function startRadarAnimation(timeLabel, btnPlay) {
  isPlaying = true;
  btnPlay.classList.add('playing');
  btnPlay.querySelector('#radar-btn-label').textContent = 'Pausar';
  btnPlay.querySelector('#radar-play-icon').innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';

  animationTimer = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % radarFrames.length;
    showFrame(currentFrameIndex, timeLabel);
  }, 750);
}

function stopRadarAnimation(btnPlay) {
  isPlaying = false;
  clearInterval(animationTimer);
  btnPlay.classList.remove('playing');
  btnPlay.querySelector('#radar-btn-label').textContent = 'Reproduzir';
  btnPlay.querySelector('#radar-play-icon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
}
