function $(sel, root = document) { return root.querySelector(sel); }

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function loadData() {
  const [panelists, years, movies, reviews] = await Promise.all([
    loadJson("./data/panelists.json"),
    loadJson("./data/years.json"),
    loadJson("./data/movies.json"),
    loadJson("./data/reviews.json"),
  ]);
  return { panelists, years, movies, reviews };
}

function setActiveNav() {
  const file = window.location.pathname.split("/").pop() || "index.html";
  const map = {
    "years.html": "years",
    "panelists.html": "panelists",
    "about.html": "about",
  };
  const key = map[file];
  if (!key) return;
  const el = $(`.nav-link[data-nav="${key}"]`);
  if (el) el.classList.add("active");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(1);
}

function computeMovieAverages(movies, reviews) {
  const sums = new Map();
  for (const m of movies) sums.set(m.id, { sum: 0, n: 0 });
  for (const r of reviews) {
    const s = sums.get(r.movieId);
    if (!s) continue;
    s.sum += Number(r.score);
    s.n += 1;
  }
  const avg = new Map();
  for (const [id, s] of sums.entries()) avg.set(id, s.n ? s.sum / s.n : null);
  return avg;
}

function buildPosterTile(movie, activeAward) {
  const a = document.createElement("a");
  a.href = `movie.html?id=${encodeURIComponent(movie.id)}`;
  a.className = "poster-tile";

  const posterHtml = movie.posterPath
    ? `<img src="${movie.posterPath}" alt="${escapeHtml(movie.title)} poster" loading="lazy" />`
    : "";

  const nominations = Array.isArray(movie.nominations) ? movie.nominations : [];

  const nomHtml = nominations.length
    ? nominations.map((n) => {
        const isActive = activeAward && n === activeAward;
        return `<span class="nom-chip ${isActive ? "active" : ""}">${escapeHtml(n)}</span>`;
      }).join(`, `)
    : `<span class="nom-chip">No nominations listed</span>`;

  a.innerHTML = `
    <div class="poster">${posterHtml}</div>
  `;

  return a;
}


function renderHome({ years }) {
  const primaryYear = years?.[0];
  const primaryBtn = $("#home-primary");
  if (primaryBtn && primaryYear) {
    primaryBtn.href = `years.html?year=${encodeURIComponent(primaryYear)}`;
    primaryBtn.textContent = `${primaryYear} Nominees`;
  }
}

function renderYearsPage({ years, movies, reviews }) {
  const yearSelect = $("#year-select");
  const awardSelect = $("#award-select");
  const grid = $("#movies-grid");
  const yearStats = $("#year-stats");
  const awardStats = $("#award-stats");
  if (!yearSelect || !awardSelect || !grid) return;

  // One for each Oscar award (core set). Add/remove freely.
  const OSCAR_CATEGORIES = [
    "All Categories",
    "Picture",
    "Animated Feature",
    "International Feature Film",
    "Documentary Feature Film",
    "Cinematography",
    "Visual Effects",
  ];

  yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  awardSelect.innerHTML = OSCAR_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  const initialYear = getParam("year") || String(years[0] ?? "");
  if (initialYear) yearSelect.value = initialYear;

  const initialAward = getParam("award") || "All Categories";
  awardSelect.value = initialAward;

  function refresh() {
    const year = Number(yearSelect.value);
    const award = awardSelect.value === "All Categories" ? null : awardSelect.value;

    const yearMovies = movies.filter((m) => Number(m.year) === year);

    const filtered = award
      ? yearMovies.filter((m) => Array.isArray(m.nominations) && m.nominations.includes(award))
      : yearMovies;

    grid.innerHTML = "";
    for (const m of filtered) grid.appendChild(buildPosterTile(m, award));

    // reviewed count (unique movies with at least one review)
    const reviewedSet = new Set(reviews.map((r) => String(r.movieId)));
    const reviewedCount = yearMovies.filter((m) => reviewedSet.has(String(m.id))).length;

    if (yearStats) yearStats.textContent = `${reviewedCount} nominees reviewed`;
    if (awardStats) awardStats.textContent = award ? `Filtering: ${award}` : `All categories`;
  }

  yearSelect.classList.add("is-compact");
  awardSelect.classList.add("is-compact");
  yearSelect.addEventListener("change", refresh);
  awardSelect.addEventListener("change", refresh);
  refresh();


}

function renderPanelistsPage({ panelists, reviews }) {
  const host = $("#panelists-host");
  if (!host) return;

  const reviewCounts = new Map();
  for (const p of panelists) reviewCounts.set(String(p.id), 0);
  for (const r of reviews) {
    const k = String(r.panelistId);
    if (reviewCounts.has(k)) reviewCounts.set(k, reviewCounts.get(k) + 1);
  }

  host.innerHTML = "";
  for (const p of panelists) {
    const count = reviewCounts.get(String(p.id)) ?? 0;
    const card = document.createElement("a");
    card.className = "panelist-card";
    card.href = `panelist.html?id=${encodeURIComponent(p.id)}`;

    card.innerHTML = `
      <div class="panelist-photo">
        ${p.imagePath ? `<img src="${p.imagePath}" alt="${escapeHtml(p.name)} photo" />` : ""}
      </div>
      <div class="panelist-body">
        <h2 class="panelist-name">${escapeHtml(p.name)}</h2>
        <p class="panelist-bio">${escapeHtml(p.bio || "")}</p>

        <div class="panelist-footer">
          <div><span style="color:var(--accent); font-weight:600;">${count}</span> reviews</div>
          <div style="flex:1;"></div>
          <div>
            <span style="color:var(--accent); font-weight:600;">READ REVIEWS</span>
            <span class="arrow">→</span>
          </div>
        </div>
      </div>
    `;
    host.appendChild(card);
  }
}

function renderMoviePage({ panelists, movies, reviews }) {
  const id = getParam("id");
  if (!id) return;

  const movie = movies.find((m) => String(m.id) === String(id));
  if (!movie) return;

  const movieReviews = reviews.filter((r) => String(r.movieId) === String(movie.id));

  // average across only existing reviews
  const scores = movieReviews
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n));

  const avg = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const titleEl = $("#movie-title");
  if (titleEl) titleEl.textContent = movie.title;

  const avgEl = $("#movie-avg");
  if (avgEl) avgEl.textContent = avg == null ? "—" : avg.toFixed(2);

  const posterEl = $("#movie-poster");
  if (posterEl) {
    posterEl.innerHTML = movie.posterPath
      ? `<div class="poster"><img src="${movie.posterPath}" alt="${escapeHtml(movie.title)} poster" loading="lazy"/></div>`
      : `<div class="poster"></div>`;
  }

  // render reviews on the right, only panelists who reviewed
  const host = $("#movie-reviews");
  if (!host) return;

  // optional: stable ordering by panelist name
  const byName = (a, b) => {
    const pa = panelists.find((p) => String(p.id) === String(a.panelistId))?.name ?? "";
    const pb = panelists.find((p) => String(p.id) === String(b.panelistId))?.name ?? "";
    return pa.localeCompare(pb);
  };

  host.innerHTML = "";

  for (const r of movieReviews.sort(byName)) {
    const p = panelists.find((x) => String(x.id) === String(r.panelistId));
    if (!p) continue;

    const score = Number(r.score);
    const scoreText = Number.isFinite(score) ? score.toFixed(1) : "—";

    const row = document.createElement("div");
    row.className = "review-row";
    row.innerHTML = `
      <div class="review-head">
        <div class="review-panelist">${escapeHtml(p.name)}</div>
        <div class="review-score">${scoreText} / 10.0</div>
      </div>
      <p class="review-text">${escapeHtml(r.reviewText || "")}</p>
    `;
    host.appendChild(row);
  }
}

function renderPanelistPage({ panelists, movies, reviews }) {
  const id = getParam("id");
  if (!id) return;

  const panelist = panelists.find((p) => String(p.id) === String(id));
  if (!panelist) return;

  const nameEl = $("#panelist-name");
  const taglineEl = $("#panelist-tagline");
  const bioEl = $("#panelist-bio");
  const avatarEl = $("#panelist-avatar");
  const emptyEl = $("#panelist-empty");
  const host = $("#panelist-reviews");

  if (nameEl) nameEl.textContent = panelist.name ?? "";
  if (taglineEl) taglineEl.textContent = panelist.tagline ? `"${panelist.tagline}"` : "";

  if (avatarEl) {
    avatarEl.innerHTML = panelist.imagePath
      ? `<img src="${panelist.imagePath}" alt="${escapeHtml(panelist.name)} photo" loading="lazy" />`
      : "";
  }

  const mine = reviews
    .filter((r) => String(r.panelistId) === String(panelist.id))
    .map((r) => {
      const movie = movies.find((m) => String(m.id) === String(r.movieId));
      return movie ? { r, movie } : null;
    })
    .filter(Boolean);

  if (!host) return;

  if (mine.length === 0) {
    if (emptyEl) emptyEl.style.display = "block";
    host.innerHTML = "";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  // Optional: sort by year desc, then title
  mine.sort((a, b) => {
    const ay = Number(a.movie.year) || 0;
    const by = Number(b.movie.year) || 0;
    if (by !== ay) return by - ay;
    return String(a.movie.title).localeCompare(String(b.movie.title));
  });

  host.innerHTML = "";

  for (const { r, movie } of mine) {
    const score = Number(r.score);
    const scoreText = Number.isFinite(score) ? score.toFixed(1) : "—";

    const a = document.createElement("a");
    a.className = "panelist-review";
    a.href = `movie.html?id=${encodeURIComponent(movie.id)}`;

    a.innerHTML = `
      <div class="panelist-review-top">
        <div class="panelist-review-movie">
          ${escapeHtml(movie.title)} <span style="color:rgba(245,232,204,0.35); font-size:14px;">(${movie.year})</span>
        </div>
        <div class="panelist-review-score">${scoreText} / 10.0</div>
      </div>
      <p class="panelist-review-text">${escapeHtml(r.reviewText || "")}</p>
    `;

    host.appendChild(a);
  }
}

async function main() {
  setActiveNav();
  const data = await loadData();

  const page = document.body.getAttribute("data-page");
  if (page === "home") renderHome(data);
  if (page === "years") renderYearsPage(data);
  if (page === "panelists") renderPanelistsPage(data);
  if (page === "movie") renderMoviePage(data);
  if (page === "panelist") renderPanelistPage(data);
}

main().catch((err) => console.error(err));
