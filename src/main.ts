import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";

// Constants for the game setup
const START_LAT = 36.9895;
const START_LNG = -122.0627;
const CELL_SIZE = 0.0001; // Size of each grid cell in lat/lng units
const CACHE_CHANCE = 0.1; // Probability of a cache appearing in a cell
const VIEW_DISTANCE = 8; // Number of cells visible in each direction

// Type definitions for game objects
type Position = { lat: number; lng: number };
type GridCell = { x: number; y: number };
type Token = { uid: string };
type GeocacheSpot = { uid: string; pos: Position; tokens: Token[] };

// Cache to store grid cell calculations for performance
const gridCache = new Map<string, GridCell>();

// Convert lat/lng coordinates to grid cell coordinates
function coordsToGrid({ lat, lng }: Position): GridCell {
  const x = Math.floor(lat / CELL_SIZE);
  const y = Math.floor(lng / CELL_SIZE);
  const key = `${x}:${y}`;
  if (!gridCache.has(key)) {
    gridCache.set(key, { x, y });
  }
  return gridCache.get(key)!;
}

// Explorer class representing the player
class Explorer {
  pos: Position;
  inventory: Token[];
  discoveredCaches: Set<string>;

  constructor(pos: Position) {
    this.pos = pos;
    this.inventory = [];
    this.discoveredCaches = new Set();
  }

  // Add a token to the explorer's inventory
  acquireToken(token: Token, cacheUid: string) {
    this.inventory.push(token);
    this.discoveredCaches.add(cacheUid);
  }

  // Place a token from the explorer's inventory into a cache
  placeToken(cache: GeocacheSpot) {
    if (this.inventory.length > 0) {
      const token = this.inventory.pop()!;
      cache.tokens.push(token);
    }
  }
}

// Create the explorer (player) at the starting position
const explorer = new Explorer({ lat: START_LAT, lng: START_LNG });
let geocacheSpots: GeocacheSpot[] = [];
const cacheRegistry: Map<string, GeocacheSpot> = new Map();

// Main game initialization
document.addEventListener("DOMContentLoaded", () => {
  // Create and add the map element to the DOM
  const mapElement = document.createElement("div");
  mapElement.id = "map";
  mapElement.style.width = "100%";
  mapElement.style.height = "400px";
  document.body.appendChild(mapElement);

  // Initialize the Leaflet map
  const map = L.map("map").setView([START_LAT, START_LNG], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Set the path for Leaflet's default icons
  L.Icon.Default.imagePath = "https://unpkg.com/leaflet@1.7.1/dist/images/";

  // Add the explorer's marker to the map
  const explorerMarker = L.marker([explorer.pos.lat, explorer.pos.lng])
    .addTo(map)
    .bindPopup("You are here!");

  // Generate a pseudo-random number based on a seed
  function pseudoRandom(seed: number): number {
    return Math.abs(Math.sin(seed) * 10000) % 1;
  }

  // Create a geocache at a given grid cell
  function createGeocache(cell: GridCell): GeocacheSpot | null {
    if (pseudoRandom(cell.x * VIEW_DISTANCE + cell.y) < CACHE_CHANCE) {
      const pos: Position = {
        lat: cell.x * CELL_SIZE,
        lng: cell.y * CELL_SIZE,
      };
      const tokens: Token[] = [];
      const tokenCount = Math.floor(pseudoRandom(cell.x + cell.y + 1) * 5);
      for (let serial = 0; serial < tokenCount; serial++) {
        tokens.push({ uid: `${cell.x}:${cell.y}#${serial}` });
      }
      const cache: GeocacheSpot = {
        uid: `cache_${cell.x}_${cell.y}`,
        pos,
        tokens,
      };
      cacheRegistry.set(cache.uid, cache);
      return cache;
    }
    return null;
  }

  // Update the display of the explorer's inventory
  function updateInventoryDisplay() {
    const uiPanel = document.getElementById("ui-panel");
    if (!uiPanel) return;

    const inventoryElement = document.createElement("div");
    inventoryElement.style.margin = "10px 0";
    inventoryElement.classList.add("inventory");

    if (explorer.inventory.length > 0) {
      inventoryElement.classList.add("has-items");
      inventoryElement.classList.remove("empty");
      const inventoryContent = `Backpack: ${explorer.inventory.map((token) => token.uid).join(", ")}`;
      inventoryElement.textContent = inventoryContent;
    } else {
      inventoryElement.classList.add("empty");
      inventoryElement.classList.remove("has-items");
      inventoryElement.textContent = "Backpack: (empty)";
    }

    const existingInventory = uiPanel.querySelector(".inventory");
    if (existingInventory) {
      existingInventory.replaceWith(inventoryElement);
    } else {
      uiPanel.appendChild(inventoryElement);
    }
  }

  // Refresh the visible geocaches based on the explorer's position
  function refreshVisibleCaches() {
    geocacheSpots = [];
    const explorerCell = coordsToGrid(explorer.pos);

    for (let i = -VIEW_DISTANCE; i <= VIEW_DISTANCE; i++) {
      for (let j = -VIEW_DISTANCE; j <= VIEW_DISTANCE; j++) {
        const cell: GridCell = { x: explorerCell.x + i, y: explorerCell.y + j };
        const cacheUid = `cache_${cell.x}_${cell.y}`;
        if (cacheRegistry.has(cacheUid)) {
          geocacheSpots.push(cacheRegistry.get(cacheUid)!);
        } else {
          const newCache = createGeocache(cell);
          if (newCache) geocacheSpots.push(newCache);
        }
      }
    }
    updateGeocacheMarkers();
  }

  // Update the markers on the map for visible geocaches
  function updateGeocacheMarkers() {
    // Remove all existing geocache markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker && layer !== explorerMarker) {
        map.removeLayer(layer);
      }
    });

    // Add markers for all visible geocaches
    geocacheSpots.forEach((cache) => {
      const marker = L.marker([cache.pos.lat, cache.pos.lng]).addTo(map);

      marker.bindPopup(`
        <b>Geocache at (${cache.pos.lat.toFixed(5)}, ${cache.pos.lng.toFixed(5)})</b><br>
        Tokens: ${cache.tokens.map((token) => token.uid).join(", ")}<br>
        <div>
          <button id="acquire-btn-${cache.uid}" class="popup-btn">Acquire Token</button>
          <button id="place-btn-${cache.uid}" class="popup-btn">Place Token</button>
        </div>
      `);

      // Add event listeners to the popup buttons
      marker.on("popupopen", () => {
        const acquireBtn = document.getElementById(`acquire-btn-${cache.uid}`);
        const placeBtn = document.getElementById(`place-btn-${cache.uid}`);

        if (acquireBtn) {
          acquireBtn.addEventListener("click", () => {
            acquireToken(cache.uid);
            refreshVisibleCaches();
          });
        }

        if (placeBtn) {
          placeBtn.addEventListener("click", () => {
            placeToken(cache.uid);
            refreshVisibleCaches();
          });
        }
      });
    });
  }

  // Acquire a token from a geocache
  function acquireToken(cacheUid: string) {
    if (explorer.discoveredCaches.has(cacheUid)) {
      alert("You've already explored this cache!");
      return;
    }

    const cache = geocacheSpots.find((c) => c.uid === cacheUid);
    if (cache && cache.tokens.length > 0) {
      const token = cache.tokens.pop()!;
      explorer.acquireToken(token, cacheUid);
      alert(`Acquired token: ${token.uid}`);
      updateInventoryDisplay();
      updateGeocacheMarkers();
    }
  }

  // Place a token into a geocache
  function placeToken(cacheUid: string) {
    const cache = geocacheSpots.find((c) => c.uid === cacheUid);
    if (cache && explorer.inventory.length > 0) {
      explorer.placeToken(cache);
      alert(`Placed a token in cache ${cacheUid}`);
      updateInventoryDisplay();
      updateGeocacheMarkers();
    }
  }

  // Create and add the UI panel to the DOM
  const uiPanel = document.createElement("div");
  uiPanel.id = "ui-panel";
  uiPanel.style.position = "absolute";
  uiPanel.style.top = "10px";
  uiPanel.style.left = "10px";
  uiPanel.style.zIndex = "1000";
  uiPanel.style.backgroundColor = "white";
  uiPanel.style.padding = "10px";
  document.body.appendChild(uiPanel);

  // Initialize the game state
  refreshVisibleCaches();
  updateInventoryDisplay();
});