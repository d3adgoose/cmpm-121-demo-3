import leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';
import './leafletWorkaround.ts';
import generateLuck from './luck.ts';

const GAME_ZOOM_LEVEL = 19;
const TILE_SIZE = 1e-4;
const AREA_SIZE = 8;
const CACHE_CREATION_CHANCE = 0.1;

const playerLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);

const playerIcon = leaflet.icon({
  iconUrl: '/project/src/Girl2.png',
  tooltipAnchor: [-16, 16]
});

const playerMarker = leaflet.marker(playerLocation, { icon: playerIcon });

const emptyInventoryMessage = 'Inventory is empty. Go out and get some coins!';
const inventoryChangedEvent = new CustomEvent('inventory-changed');

interface Coin {
  i: number;
  j: number;
  serial: number;
}

interface Cache {
  i: number;
  j: number;
  inventory: Coin[];
  currentSerial: number;
  marker?: leaflet.Marker;
}

const gameMap = leaflet.map(document.getElementById('map')!, {
  center: playerLocation,
  zoom: GAME_ZOOM_LEVEL,
  minZoom: GAME_ZOOM_LEVEL,
  maxZoom: GAME_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
  dragging: false,
  keyboard: false,
  closePopupOnClick: false
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(gameMap);

let playerCoins: Coin[] = [];
const cacheStorage: Map<string, Cache> = new Map();

const cacheIcon = leaflet.icon({
  iconUrl: "/project/src/Chest_1.png",
  tooltipAnchor: [-16, 16],
  popupAnchor: [16, 16],
});

function calculateTileFromLocation(location: leaflet.LatLng): { row: number; col: number } {
  return {
    row: Math.floor(location.lat / TILE_SIZE),
    col: Math.floor(location.lng / TILE_SIZE)
  };
}

function findNearbyTiles(coords: leaflet.LatLng): { i: number; j: number }[] {
  const centerTile = calculateTileFromLocation(coords);
  const nearbyTiles = [];
  for (let i = centerTile.row - AREA_SIZE; i <= centerTile.row + AREA_SIZE; i++) {
    for (let j = centerTile.col - AREA_SIZE; j <= centerTile.col + AREA_SIZE; j++) {
      nearbyTiles.push({ i, j });
    }
  }
  return nearbyTiles;
}

function transferCoin(from: Coin[], to: Coin[], coin: Coin) {
  const index = from.indexOf(coin);
  if (index > -1) {
    from.splice(index, 1);
    to.push(coin);
    document.dispatchEvent(inventoryChangedEvent);
  }
}

function addCoinsToCache(cache: Cache, numberOfCoins: number) {
  for (let k = 0; k < numberOfCoins; k++) {
    cache.inventory.push({ i: cache.i, j: cache.j, serial: cache.currentSerial++ });
  }
}

function createCache(tile: { i: number; j: number }) {
  const key = `${tile.i},${tile.j}`;
  if (!cacheStorage.has(key)) {
    const cache: Cache = {
      i: tile.i,
      j: tile.j,
      inventory: [],
      currentSerial: 0
    };
    const numCoins = Math.floor(generateLuck(`${tile.i},${tile.j},seed`) * 3);
    addCoinsToCache(cache, numCoins);
    const location = leaflet.latLng(tile.i * TILE_SIZE, tile.j * TILE_SIZE);
    const cacheMarker = leaflet.marker(location, { icon: cacheIcon }).addTo(gameMap);
    cache.marker = cacheMarker;
    cacheMarker.bindPopup(() => createCachePopup(cache));
    cacheStorage.set(key, cache);
  }
}

function updateInventoryDisplay() {
  const inventoryDiv = document.getElementById('inventory');
  if (inventoryDiv) {
    if (playerCoins.length === 0) {
      inventoryDiv.innerHTML = emptyInventoryMessage;
    } else {
      inventoryDiv.innerHTML = 'Inventory: ';
      playerCoins.forEach(coin => {
        const coinDiv = document.createElement('div');
        coinDiv.textContent = `Coin: ${createLabelForCoin(coin)}`;
        inventoryDiv.appendChild(coinDiv);
      });
    }
  }
}

function createLabelForCoin(coin: Coin): string {
  return `${coin.i},${coin.j},${coin.serial}`;
}

function createCachePopup(cache: Cache): HTMLElement {
  const popupDiv = document.createElement('div');
  popupDiv.innerHTML = `<div>Cache: ${cache.i},${cache.j} <br>Inventory:</div>`;
  const inventoryList = document.createElement('div');

  cache.inventory.forEach(coin => {
    const coinDiv = document.createElement('div');
    coinDiv.textContent = `Coin: ${createLabelForCoin(coin)}`;
    const selectButton = document.createElement('button');
    selectButton.textContent = 'Select';
    selectButton.addEventListener('click', () => {
      transferCoin(cache.inventory, playerCoins, coin);
      updateInventoryDisplay();
      popupDiv.innerHTML = '';
      popupDiv.appendChild(createCachePopup(cache));
    });
    coinDiv.appendChild(selectButton);
    inventoryList.appendChild(coinDiv);
  });

  const depositButton = document.createElement('button');
  depositButton.textContent = 'Deposit Coin';
  depositButton.addEventListener('click', () => {
    depositMenu(cache, popupDiv);
  });

  popupDiv.appendChild(inventoryList);
  popupDiv.appendChild(depositButton);
  return popupDiv;
}

function depositMenu(cache: Cache, popupDiv: HTMLElement) {
  const depositDiv = document.createElement('div');
  depositDiv.innerHTML = '<div>Select a coin to deposit:</div>';

  playerCoins.forEach(coin => {
    const coinDiv = document.createElement('div');
    coinDiv.textContent = `Coin: ${createLabelForCoin(coin)}`;
    const depositButton = document.createElement('button');
    depositButton.textContent = 'Deposit';
    depositButton.addEventListener('click', () => {
      transferCoin(playerCoins, cache.inventory, coin);
      updateInventoryDisplay();
      popupDiv.innerHTML = '';
      popupDiv.appendChild(createCachePopup(cache));
    });
    coinDiv.appendChild(depositButton);
    depositDiv.appendChild(coinDiv);
  });

  popupDiv.appendChild(depositDiv);
}

function spawnCachesAroundPlayer() {
  findNearbyTiles(playerLocation).forEach(tile => {
    if (generateLuck(`${tile.i},${tile.j},spawn`) < CACHE_CREATION_CHANCE) {
      createCache(tile);
    }
  });
}

function initializeGame() {
  playerMarker.addTo(gameMap);
  spawnCachesAroundPlayer();
  updateInventoryDisplay();
}

document.addEventListener('DOMContentLoaded', () => {
  initializeGame();
});

document.addEventListener('inventory-changed', updateInventoryDisplay);