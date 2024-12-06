import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import generateLuck from "./luck.ts";
document.title = "Slay";

// Coordinates for the classroom, using Google Maps data
const playerLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Configuration for game's zoom and tile details
const GAME_ZOOM_LEVEL = 19;
const TILE_SIZE = 1e-4;
const AREA_SIZE = 8; // The number of tiles to consider around the player
const CACHE_CREATION_CHANCE = 0.1; // Chance of a cache spawning per tile

// Tile interface for position indexing
interface Position {
  row: number;
  col: number;
}

// Initializing the game map in a div with id "map"
const mapElement = leaflet.map(document.getElementById("map")!, {
  center: playerLocation,
  zoom: GAME_ZOOM_LEVEL,
  minZoom: GAME_ZOOM_LEVEL,
  maxZoom: GAME_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
  dragging: false,
  keyboard: false,
});

// Adding a background tile layer to the map
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(mapElement);

// Configuring the player marker with an icon
const avatar = leaflet.icon({
  iconUrl: "/project/src/Girl2.png",
  tooltipAnchor: [-16, 16],
});
const player = leaflet.marker(playerLocation, { icon: avatar });
player.bindTooltip("That's you!");
player.addTo(mapElement);

// Managing player's score with in-game coins
let score = 0;
const statusDiv = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusDiv.innerHTML = "Inventory empty. Go out there and get some coins!";

// Cache marker configuration
const cacheMarker = leaflet.icon({
  iconUrl: "/project/src/Chest_1.png",
  tooltipAnchor: [-16, 16],
  popupAnchor: [16, 16],
});

// Function to add caches to the map
function placeCache(pos: Position) {
  const cacheLat = pos.row * TILE_SIZE + TILE_SIZE / 2;
  const cacheLng = pos.col * TILE_SIZE + TILE_SIZE / 2;
  const cachePoint = leaflet.latLng(cacheLat, cacheLng);
  const cache = leaflet.marker(cachePoint, { icon: cacheMarker });
  cache.addTo(mapElement);

  cache.bindPopup(() => {
    let cacheCoins = Math.floor(
      generateLuck([pos.row, pos.col, "initialValue"].toString()) * 100
    );
    const popupContent = document.createElement("div");
    popupContent.innerHTML = `
      <div>There is a cache here at "${pos.row},${pos.col}". It has <span id="value">${cacheCoins}</span> coins.</div>
      <button id="take">Take</button>
      <button id="give">Deposit</button>`;
    popupContent.querySelector<HTMLButtonElement>("#take")!.addEventListener(
      "click",
      () => {
        if (cacheCoins <= 0) {
          return;
        }
        cacheCoins--;
        popupContent.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          cacheCoins.toString();
        score++;
        statusDiv.innerHTML = `${score} coins!`;
      }
    );
    popupContent.querySelector<HTMLButtonElement>("#give")!.addEventListener(
      "click",
      () => {
        if (score <= 0) {
          return;
        }
        cacheCoins++;
        popupContent.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          cacheCoins.toString();
        score--;
        statusDiv.innerHTML = `${score} coins!`;
      }
    );
    return popupContent;
  });
}

// Calculate tile indices from geographical coordinates
function calculateTileFromLocation(location: { lat: number; lng: number }): Position {
  const row = Math.floor(location.lat / TILE_SIZE);
  const col = Math.floor(location.lng / TILE_SIZE);
  return { row, col };
}

// Function to check and spawn caches in a nearby area
function spawnCachesAroundPlayer() {
  const currentTile = calculateTileFromLocation(playerLocation);
  for (let row = currentTile.row - AREA_SIZE; row <= currentTile.row + AREA_SIZE; row++) {
    for (let col = currentTile.col - AREA_SIZE; col <= currentTile.col + AREA_SIZE; col++) {
      if (Math.random() < CACHE_CREATION_CHANCE) {
        placeCache({ row, col });
      }
    }
  }
}

// Initial cache placement
spawnCachesAroundPlayer();
