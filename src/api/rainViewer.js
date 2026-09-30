/**
 * Cliente para API do RainViewer (Radar de Chuva em Tempo Real e Previsão Imediata de Radar)
 */

export async function getRainViewerFrames() {
  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!res.ok) throw new Error(`RainViewer error: ${res.status}`);
    const data = await res.json();
    return {
      host: data.host,
      past: data.radar?.past || [],
      nowcast: data.radar?.nowcast || []
    };
  } catch (err) {
    console.warn('Erro ao carregar frames do RainViewer:', err);
    return null;
  }
}
