// ------------------------------------------------------------
// Music Store Generator - Frontend (FINAL VERSION with  Fix)
// ------------------------------------------------------------

const langSelect = document.getElementById("lang");
const seedInput = document.getElementById("seed");
const likesSlider = document.getElementById("likesSlider");
const likesValue = document.getElementById("likesValue");
const viewTableBtn = document.getElementById("tableView");
const viewGalleryBtn = document.getElementById("galleryView");
const exportBtn = document.getElementById("exportZip");
const songsContainer = document.getElementById("songsContainer");
const pagination = document.getElementById("pagination");
const diceBtn = document.getElementById("dice"); // 🎲 button

let viewMode = "gallery";
let currentPage = 1;
let pageSize = 9;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function updateLikesLabel() {
  likesValue.textContent = likesSlider.value;
}
updateLikesLabel();

function setActiveViewButton() {
  viewTableBtn.classList.toggle("active", viewMode === "table");
  viewGalleryBtn.classList.toggle("active", viewMode === "gallery");
}

// ------------------------------------------------------------
// Fetch & Display Songs
// ------------------------------------------------------------
async function fetchSongs() {
  const lang = langSelect.value;
  const seed = seedInput.value || "0x1";
  const likes = likesSlider.value;

  songsContainer.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(
      `/api/songs?lang=${lang}&seed=${seed}&page=${currentPage}&pageSize=${pageSize}&likes=${likes}`
    );
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    renderSongs(data.items);
  } catch (err) {
    songsContainer.innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

// ------------------------------------------------------------
// Render Songs
// ------------------------------------------------------------
function renderSongs(items) {
  songsContainer.innerHTML = "";

  if (viewMode === "gallery") {
    // ---------- GALLERY VIEW ----------
    songsContainer.className = "gallery";
    items.forEach((song) => {
      const card = document.createElement("div");
      card.className = "song-card";
      card.innerHTML = `
        <img src="${song.coverUrl}" alt="cover" class="cover">
        <h3>${song.title}</h3>
        <p class="artist">${song.artist}</p>
        <p class="album">${song.album}</p>
        <p class="genre">${song.genre} • Likes ${song.likes}</p>
        <audio controls src="${song.audioUrl}"></audio>
        <p class="review">${song.review}</p>
      `;
      songsContainer.appendChild(card);
    });

  } else {
    // ---------- TABLE VIEW ----------
    songsContainer.className = "table-view";
    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Artist</th>
          <th>Album</th>
          <th>Genre</th>
          <th>Likes</th>
          <th>Preview</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${s.title}</td>
            <td>${s.artist}</td>
            <td>${s.album}</td>
            <td>${s.genre}</td>
            <td>${s.likes}</td>
            <td><audio controls preload="none" src="${s.audioUrl}" style="width:160px"></audio></td>
          </tr>`).join("")}
      </tbody>
    `;
    songsContainer.appendChild(table);
  }
}

// ------------------------------------------------------------
// Event Listeners
// ------------------------------------------------------------
langSelect.addEventListener("change", fetchSongs);
seedInput.addEventListener("change", fetchSongs);
likesSlider.addEventListener("input", () => {
  updateLikesLabel();
  fetchSongs();
});

viewTableBtn.addEventListener("click", () => {
  viewMode = "table";
  setActiveViewButton();
  fetchSongs();
});

viewGalleryBtn.addEventListener("click", () => {
  viewMode = "gallery";
  setActiveViewButton();
  fetchSongs();
});

// 🎲 Random Seed Button
diceBtn.addEventListener("click", async () => {
  try {
    const res = await fetch("/api/random-seed");
    const data = await res.json();
    if (data.seed) {
      seedInput.value = data.seed;
      await fetchSongs();
    } else {
      alert("Failed to get random seed.");
    }
  } catch (err) {
    alert("Error fetching random seed: " + err.message);
  }
});

// ZIP Export
exportBtn.addEventListener("click", async () => {
  const lang = langSelect.value;
  const seed = seedInput.value || "0x1";
  const likes = likesSlider.value;
  const url = `/api/exportZip?lang=${lang}&seed=${seed}&page=${currentPage}&pageSize=${pageSize}&likes=${likes}`;
  window.open(url, "_blank");
});

// Pagination placeholder
pagination.addEventListener("click", (e) => {
  if (e.target.dataset.page) {
    currentPage = parseInt(e.target.dataset.page);
    fetchSongs();
  }
});

// ------------------------------------------------------------
// Initial Load
// ------------------------------------------------------------
fetchSongs();
setActiveViewButton();
