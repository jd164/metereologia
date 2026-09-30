/**
 * Gestor de armazenamento local (LocalStorage)
 */

const KEYS = {
  CURRENT_LOCATION: 'climaconsenso_cur_loc',
  FAVORITES: 'climaconsenso_favorites',
  CUSTOM_WEIGHTS: 'climaconsenso_weights',
  ACTIVE_TAB: 'climaconsenso_tab'
};

export const DEFAULT_LOCATION = {
  name: 'Lisboa',
  country: 'Portugal',
  latitude: 38.7167,
  longitude: -9.139,
  globalIdLocal: 1110600
};

export function getSavedLocation() {
  try {
    const raw = localStorage.getItem(KEYS.CURRENT_LOCATION);
    return raw ? JSON.parse(raw) : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export function saveLocation(location) {
  try {
    localStorage.setItem(KEYS.CURRENT_LOCATION, JSON.stringify(location));
  } catch (e) {
    console.warn('Erro ao guardar localização:', e);
  }
}

export function getFavorites() {
  try {
    const raw = localStorage.getItem(KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [
      DEFAULT_LOCATION,
      { name: 'Porto', country: 'Portugal', latitude: 41.1496, longitude: -8.611, globalIdLocal: 1131200 },
      { name: 'Faro', country: 'Portugal', latitude: 37.0194, longitude: -7.9304, globalIdLocal: 1080500 },
      { name: 'Funchal', country: 'Portugal', latitude: 32.6511, longitude: -16.9097, globalIdLocal: 3310100 }
    ];
  } catch {
    return [DEFAULT_LOCATION];
  }
}

export function saveFavorites(favorites) {
  try {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.warn('Erro ao guardar favoritos:', e);
  }
}

export function getSavedWeights() {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_WEIGHTS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWeights(weights) {
  try {
    localStorage.setItem(KEYS.CUSTOM_WEIGHTS, JSON.stringify(weights));
  } catch (e) {
    console.warn('Erro ao guardar pesos:', e);
  }
}
