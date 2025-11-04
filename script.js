const btn = document.getElementById("findBtn");
const resultsDiv = document.getElementById("results");
const filters = document.querySelectorAll(".filter");
const listBtn = document.getElementById("listViewBtn");
const mapBtn = document.getElementById("mapViewBtn");
const mapDiv = document.getElementById("map");
const locBtn = document.getElementById("locBtn");
const RADIUS_METERS = 16093; // 10 miles
const GEOAPIFY_KEY = "f04a556957334cf59cf1c05ecd59ffa2";

let currentCategory = "catering.restaurant";
let currentCoords = null;
let map = null;
let markers = [];

// ===== View Toggle =====
listBtn.addEventListener("click", () => {
  listBtn.classList.add("active");
  mapBtn.classList.remove("active");
  resultsDiv.style.display = "flex";
  mapDiv.style.display = "none";
});

mapBtn.addEventListener("click", () => {
  mapBtn.classList.add("active");
  listBtn.classList.remove("active");
  resultsDiv.style.display = "none";
  mapDiv.style.display = "block";
  if (map && currentCoords) map.setView(currentCoords, 13);
});
// Floating location button click
locBtn.addEventListener("click", () => {
  getUserLocation();
});

// ===== Main Search Button =====
btn.addEventListener("click", () => {
  const zip = document.getElementById("zip").value.trim();
  if (zip) getCoordinatesFromZip(zip);
  else getUserLocation();
});

// ===== Category Buttons =====
filters.forEach((f) => {
  f.addEventListener("click", () => {
    filters.forEach((b) => b.classList.remove("active"));
    f.classList.add("active");
    currentCategory = f.dataset.cat;
    const zip = document.getElementById("zip").value.trim();
    if (zip) getCoordinatesFromZip(zip);
    else getUserLocation();
  });
});

function getUserLocation() {
  // Add visual feedback
  locBtn.classList.add("loading");

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locBtn.classList.remove("loading");
        currentCoords = [pos.coords.latitude, pos.coords.longitude];
        searchFood(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        locBtn.classList.remove("loading");
        alert("Location access denied. Please enter ZIP manually.");
      }
    );
  } else {
    locBtn.classList.remove("loading");
    alert("Geolocation not supported by this browser.");
  }
}



// ===== ZIP → Coordinates =====
function getCoordinatesFromZip(zip) {
  fetch(
    `https://api.geoapify.com/v1/geocode/search?postcode=${zip}&country=USA&apiKey=${GEOAPIFY_KEY}`
  )
    .then((res) => res.json())
    .then((data) => {
      if (data.features.length > 0) {
        const { lat, lon } = data.features[0].properties;
        currentCoords = [lat, lon];
        searchFood(lat, lon);
      } else alert("Invalid ZIP code.");
    })
    .catch(() => alert("Error fetching ZIP data."));
}

// ===== Search Function =====
function searchFood(lat, lon) {
  resultsDiv.innerHTML = "<p>🍽️ Searching nearby food places...</p>";

  const keyword = document.getElementById("keyword").value.trim();
  const searchTerm = keyword ? `&name=${encodeURIComponent(keyword)}` : "";

  const url = `https://api.geoapify.com/v2/places?categories=${currentCategory}&filter=circle:${lon},${lat},${RADIUS_METERS}&bias=proximity:${lon},${lat}${searchTerm}&limit=20&apiKey=${GEOAPIFY_KEY}`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      resultsDiv.innerHTML = "";

      if (!data.features?.length) {
        resultsDiv.innerHTML = "<p>No food places found nearby.</p>";
        return;
      }

      // ===== LIST VIEW =====
      data.features.forEach((place) => {
        const props = place.properties;
        const name = props.name || "Unnamed place";
        const address = props.address_line2 || "Address unavailable";
        const rating = props.rank ? (props.rank / 100).toFixed(1) : null;
        const openNow = props.opening_hours?.open_now;
        const openStatus =
          openNow === true ? "🟢 Open Now" : openNow === false ? "🔴 Closed" : "";

        const distanceMiles = getDistanceMiles(lat, lon, props.lat, props.lon);

        const card = document.createElement("div");
        card.className = "place-card";
        card.innerHTML = `
          <h3>${name}</h3>
          <p>${address}</p>
          ${rating ? `<p>⭐ Rating: ${rating}</p>` : ""}
          ${openStatus ? `<p>${openStatus}</p>` : ""}
          <p>📍 ${distanceMiles} miles away</p>
          <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${props.lat},${props.lon}')">
            Get Directions
          </button>
        `;
        resultsDiv.appendChild(card);
      });

      // ===== MAP VIEW =====
      showMap(lat, lon, data.features);
    })
    .catch(() => {
      resultsDiv.innerHTML = "<p>⚠️ Error loading food data.</p>";
    });
}

// ===== Distance Calculation =====
function getDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
}

// ===== Map View =====
function showMap(lat, lon, places) {
  if (!map) {
    map = L.map("map").setView([lat, lon], 13);
    L.tileLayer(
      `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`,
      { attribution: "© OpenStreetMap contributors" }
    ).addTo(map);
  } else {
    map.setView([lat, lon], 13);
    markers.forEach((m) => m.remove());
    markers = [];
  }

  places.forEach((place) => {
    const { lat: pLat, lon: pLon, name } = place.properties;
    const distance = getDistanceMiles(lat, lon, pLat, pLon);
    const popup = `
      <strong>${name || "Unnamed place"}</strong><br>
      📍 ${distance} miles away<br>
      <a href="https://www.google.com/maps/dir/?api=1&destination=${pLat},${pLon}" target="_blank">
        Get Directions
      </a>
    `;
    const marker = L.marker([pLat, pLon]).addTo(map).bindPopup(popup);
    markers.push(marker);
  });
}
