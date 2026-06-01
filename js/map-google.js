
const categoryMeta = {
  city: ["🏙️", "City"],
  lodging: ["🏨", "Lodging"],
  food: ["🍜", "Food"],
  cafe: ["☕", "Cafe"],
  attraction: ["🏛️", "Attraction"],
  museum: ["🏺", "Museum"],
  temple: ["🛕", "Temple"],
  church: ["⛪", "Church"],
  theater: ["🎭", "Theater"],
  market: ["🛍️", "Market"],
  nature: ["🌿", "Nature"],
  family: ["👪", "Family"],
  shopping: ["👟", "Shopping"],
  transport: ["🚆", "Transport"],
  activity: ["🚣", "Activity"],
  basketball: ["🏀", "Basketball"],
  skip: ["🚫", "Skip"]
};

let map;
let placesService;
let infoWindow;
let markersById = {};
let activeCategories = new Set(Object.keys(categoryMeta));
let searchTerm = "";

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function commentKey(id) {
  return `vietnam-trip-comment-${id}`;
}

function placesCacheKey(id) {
  return `vietnam-trip-google-place-${id}`;
}

window.saveComment = function(id) {
  const el = document.getElementById(`comment-${id}`);
  if (!el) return;
  localStorage.setItem(commentKey(id), el.value);
  const status = document.getElementById(`saved-${id}`);
  if (status) {
    status.textContent = "Saved";
    setTimeout(() => status.textContent = "", 1200);
  }
};

function markerIcon(category) {
  const [emoji] = categoryMeta[category] || ["📍"];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="18" fill="white" stroke="#111827" stroke-width="3"/>
      <text x="22" y="28" text-anchor="middle" font-size="19">${emoji}</text>
    </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22)
  };
}

function buildMapsSearchLink(p) {
  if (p.maps && p.maps.startsWith("http")) return p.maps;
  const q = encodeURIComponent(`${p.name} ${p.city || ""} Vietnam`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function fallbackPopup(p, statusText = "Loading Google Places details...") {
  const saved = localStorage.getItem(commentKey(p.id)) || "";
  const [emoji, label] = categoryMeta[p.category] || ["📍", p.category];

  return `
    <div class="popup-card">
      <div class="placeholder-photo">${emoji}</div>
      <h3 style="margin:10px 0 4px">${esc(p.name)}</h3>
      <div class="badge">${emoji} ${esc(label)} · ${esc(p.city)}</div>
      <p style="margin:8px 0">${esc(p.description || "")}</p>
      <div class="place-meta">${esc(statusText)}</div>
      <a href="${esc(buildMapsSearchLink(p))}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
      <label style="display:block;margin-top:10px;font-weight:700">Comments / notes</label>
      <textarea id="comment-${esc(p.id)}" placeholder="Type notes for this place...">${esc(saved)}</textarea>
      <button onclick="saveComment('${esc(p.id)}')">Save note</button>
      <span id="saved-${esc(p.id)}" style="margin-left:8px;color:#166534;font-weight:700"></span>
    </div>
  `;
}

function googlePopup(p, details) {
  const saved = localStorage.getItem(commentKey(p.id)) || "";
  const [emoji, label] = categoryMeta[p.category] || ["📍", p.category];

  let photoHtml = `<div class="placeholder-photo">${emoji}</div>`;
  if (details.photos && details.photos.length > 0) {
    const url = details.photos[0].getUrl({ maxWidth: 520, maxHeight: 260 });
    photoHtml = `<img src="${esc(url)}" alt="${esc(details.name || p.name)}">`;
  }

  const rating = details.rating ? `⭐ ${details.rating}` : "";
  const address = details.formatted_address || "";
  const placeUrl = details.url || buildMapsSearchLink(p);
  const officialName = details.name || p.name;

  return `
    <div class="popup-card">
      ${photoHtml}
      <h3 style="margin:10px 0 4px">${esc(officialName)}</h3>
      <div class="badge">${emoji} ${esc(label)} · ${esc(p.city)}</div>
      <div class="place-meta">
        ${rating ? esc(rating) + "<br>" : ""}
        ${address ? esc(address) : ""}
      </div>
      <p style="margin:8px 0">${esc(p.description || "")}</p>
      <a href="${esc(placeUrl)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>
      <div class="place-photo-note">Photo/details from Google Places when available.</div>
      <label style="display:block;margin-top:10px;font-weight:700">Comments / notes</label>
      <textarea id="comment-${esc(p.id)}" placeholder="Type notes for this place...">${esc(saved)}</textarea>
      <button onclick="saveComment('${esc(p.id)}')">Save note</button>
      <span id="saved-${esc(p.id)}" style="margin-left:8px;color:#166534;font-weight:700"></span>
    </div>
  `;
}

function getCachedDetails(p) {
  try {
    const raw = sessionStorage.getItem(placesCacheKey(p.id));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Store only serializable details. Photos cannot be cached because Google returns photo objects.
function setCachedDetails(p, details) {
  try {
    sessionStorage.setItem(placesCacheKey(p.id), JSON.stringify({
      name: details.name || "",
      formatted_address: details.formatted_address || "",
      rating: details.rating || "",
      url: details.url || ""
    }));
  } catch {}
}

function lookupPlaceDetails(p, marker) {
  infoWindow.setContent(fallbackPopup(p));
  infoWindow.open(map, marker);

  // For direct external links like Airbnb, ticket sites, etc., don't waste Places requests.
  if (p.maps && !p.maps.includes("google.com/maps") && !p.maps.includes("maps.app.goo.gl")) {
    infoWindow.setContent(fallbackPopup(p, "External link; Google Places lookup skipped."));
    return;
  }

  const query = `${p.name} ${p.city || ""} Vietnam`;

  placesService.findPlaceFromQuery(
    {
      query,
      fields: ["place_id", "name", "formatted_address", "geometry"]
    },
    (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results || !results[0]) {
        infoWindow.setContent(fallbackPopup(p, "No Google Places match found. Use the Google Maps search link."));
        return;
      }

      const placeId = results[0].place_id;
      placesService.getDetails(
        {
          placeId,
          fields: ["name", "formatted_address", "rating", "url", "photos", "place_id"]
        },
        (details, detailsStatus) => {
          if (detailsStatus !== google.maps.places.PlacesServiceStatus.OK || !details) {
            infoWindow.setContent(fallbackPopup(p, "Google Places details unavailable."));
            return;
          }
          setCachedDetails(p, details);
          infoWindow.setContent(googlePopup(p, details));
        }
      );
    }
  );
}

function visiblePlaces() {
  return window.TRIP_LOCATIONS.filter(p => {
    const matchesCategory = activeCategories.has(p.category);
    const blob = `${p.name} ${p.city} ${p.category} ${p.description}`.toLowerCase();
    const matchesSearch = !searchTerm || blob.includes(searchTerm);
    return matchesCategory && matchesSearch;
  });
}

function renderMarkers() {
  Object.values(markersById).forEach(marker => marker.setMap(null));
  markersById = {};

  const visible = visiblePlaces();

  visible.forEach(p => {
    const marker = new google.maps.Marker({
      position: { lat: p.lat, lng: p.lng },
      map,
      title: p.name,
      icon: markerIcon(p.category)
    });

    marker.addListener("click", () => lookupPlaceDetails(p, marker));
    markersById[p.id] = marker;
  });

  renderList(visible);

  if (visible.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    visible.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds);
  }
}

function renderFilters() {
  const wrap = document.getElementById("filters");
  wrap.innerHTML = Object.entries(categoryMeta).map(([key, [emoji, label]]) => `
    <label>
      <input type="checkbox" data-category="${key}" checked>
      ${emoji} ${label}
    </label>
  `).join("");

  wrap.addEventListener("change", e => {
    if (!e.target.matches("input[type=checkbox]")) return;
    const cat = e.target.dataset.category;
    if (e.target.checked) activeCategories.add(cat);
    else activeCategories.delete(cat);
    renderMarkers();
  });
}

function renderList(items) {
  const list = document.getElementById("locationList");
  document.getElementById("count").textContent = `${items.length} places`;
  list.innerHTML = items.map(p => {
    const [emoji, label] = categoryMeta[p.category] || ["📍", p.category];
    return `
      <div class="location-item" data-id="${esc(p.id)}">
        <strong>${emoji} ${esc(p.name)}</strong><br>
        <span class="muted">${esc(p.city)} · ${esc(label)}</span>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".location-item").forEach(el => {
    el.addEventListener("click", () => {
      const p = window.TRIP_LOCATIONS.find(x => x.id === el.dataset.id);
      const marker = markersById[el.dataset.id];
      if (p && marker) {
        map.setZoom(15);
        map.panTo({ lat: p.lat, lng: p.lng });
        lookupPlaceDetails(p, marker);
      }
    });
  });
}

window.initMap = function() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 16.5, lng: 106.0 },
    zoom: 6,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  placesService = new google.maps.places.PlacesService(map);
  infoWindow = new google.maps.InfoWindow();

  document.getElementById("search").addEventListener("input", e => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderMarkers();
  });

  document.getElementById("showAll").addEventListener("click", () => {
    activeCategories = new Set(Object.keys(categoryMeta));
    document.querySelectorAll("#filters input").forEach(x => x.checked = true);
    renderMarkers();
  });

  document.getElementById("hideAll").addEventListener("click", () => {
    activeCategories = new Set();
    document.querySelectorAll("#filters input").forEach(x => x.checked = false);
    renderMarkers();
  });

  renderFilters();
  renderMarkers();
};
