// apiCall.js (cleaned)
//
// Frontend helpers for your Spotify app.
// Requires the server to set a cookie named "accessToken" containing a Spotify access token.
//
// Pages that use this file:
// - aboutMe.html: populateUI(), getTopTracks(5), getTopArtists(5)
// - forMe.html:   getTrackRec(), getArtistRec()
// - success.html: getTopSongsGlobal()

const SERVER_URL =
  window.location.protocol === "file:"
    ? "http://127.0.0.1:8000"
    : window.location.origin;
const TOKEN_COOKIE = "accessToken";
const PREVIEW_MODE = new URLSearchParams(window.location.search).has("preview");

function previewImage(label, background = "#1ed760", foreground = "#001b09") {
  const safeLabel = String(label).replace(/[<>&"']/g, "").slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="${background}"/><circle cx="118" cy="42" r="24" fill="none" stroke="${foreground}" stroke-width="4"/><text x="20" y="132" fill="${foreground}" font-family="Arial,sans-serif" font-size="58" font-weight="700">${safeLabel}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const PREVIEW_TRACKS = [
  ["Nights", "Frank Ocean", "Blonde", "NO", "#d8d8d8", "#111111"],
  ["Dreams", "Fleetwood Mac", "Rumours", "DR", "#1ed760", "#001b09"],
  ["Pink + White", "Frank Ocean", "Blonde", "PW", "#2a2a2a", "#ffffff"],
  ["Motion Sickness", "Phoebe Bridgers", "Stranger in the Alps", "MS", "#d8d8d8", "#111111"],
  ["After Hours", "The Weeknd", "After Hours", "AH", "#1ed760", "#001b09"],
].map(([name, artist, album, label, bg, fg], index) => ({
  id: `preview-track-${index}`,
  name,
  artists: [{ name: artist }],
  album: { name: album, images: [{ url: previewImage(label, bg, fg) }] },
  external_urls: { spotify: "https://open.spotify.com/" },
}));

const PREVIEW_ARTISTS = [
  ["Frank Ocean", "18,400,000 followers", "FO", "#1ed760", "#001b09"],
  ["Phoebe Bridgers", "4,200,000 followers", "PB", "#d8d8d8", "#111111"],
  ["Fleetwood Mac", "13,700,000 followers", "FM", "#2a2a2a", "#ffffff"],
  ["The Weeknd", "98,000,000 followers", "TW", "#1ed760", "#001b09"],
  ["SZA", "27,600,000 followers", "SZ", "#d8d8d8", "#111111"],
].map(([name, followers, label, bg, fg], index) => ({
  id: `preview-artist-${index}`,
  name,
  followers: { total: Number(followers.replace(/\D/g, "")) },
  images: [{ url: previewImage(label, bg, fg) }],
  external_urls: { spotify: "https://open.spotify.com/" },
}));

// ---------------------------
// Cookies / Auth
// ---------------------------
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

async function fetchWebApi(endpoint, method = "GET", body) {
  const accessToken = getCookie(TOKEN_COOKIE);

  if (!accessToken) {
    // No token cookie -> kick to login
    window.location.href = SERVER_URL;
    return null;
  }

  const res = await fetch(`https://api.spotify.com/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auth errors: go login again
  if (res.status === 401 || res.status === 403) {
    console.log(
      "Spotify auth error:",
      res.status,
      await res.text().catch(() => "")
    );
    window.location.href = SERVER_URL;
    return null;
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Spotify API failed: ${res.status} ${txt}`);
  }

  // Some endpoints return 204
  if (res.status === 204) return {};
  return await res.json().catch(() => ({}));
}

function logOut() {
  window.location.href = `${SERVER_URL}/logout`;
}

// ---------------------------
// Small helpers
// ---------------------------
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function uniqById(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const id = it?.id;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

async function fetchFullTracksByIds(ids) {
  const idsClean = ids.filter(Boolean);
  const groups = chunk(idsClean, 50);
  const all = [];
  for (const g of groups) {
    const data = await fetchWebApi(`v1/tracks?ids=${g.join(",")}`, "GET");
    if (data?.tracks?.length) all.push(...data.tracks);
  }
  return all;
}

// Returns a subset of ids that are NOT saved (best-effort).
// Needs user-library-read scope.
async function filterOutSavedTracks(trackIds) {
  const ids = trackIds.filter(Boolean);
  const groups = chunk(ids, 50);
  const keep = [];

  for (const g of groups) {
    const saved = await fetchWebApi(
      `v1/me/tracks/contains?ids=${g.join(",")}`,
      "GET"
    );
    if (!saved) {
      // If auth failed, fetchWebApi already redirected.
      return keep;
    }
    // saved is boolean[]
    for (let i = 0; i < g.length; i++) {
      if (saved[i] === false) keep.push(g[i]);
    }
  }

  return keep;
}

async function getPlaylistTrackIdSet(
  maxPlaylists = 50,
  maxTracksPerPlaylist = 500
) {
  const trackSet = new Set();

  // paginate playlists
  let playlistOffset = 0;
  const playlistLimit = 50;
  let playlists = [];

  while (playlists.length < maxPlaylists) {
    const pls = await fetchWebApi(
      `v1/me/playlists?limit=${playlistLimit}&offset=${playlistOffset}`,
      "GET"
    );
    const items = pls?.items || [];
    playlists.push(...items);

    if (items.length < playlistLimit) break;
    playlistOffset += playlistLimit;
  }

  playlists = playlists.slice(0, maxPlaylists);

  // fetch tracks from each playlist
  for (const p of playlists) {
    let offset = 0;
    const limit = 100;

    while (offset < maxTracksPerPlaylist) {
      const data = await fetchWebApi(
        `v1/playlists/${p.id}/tracks?limit=${limit}&offset=${offset}`,
        "GET"
      );

      const items = data?.items || [];
      for (const it of items) {
        const id = it?.track?.id;
        if (id) trackSet.add(id);
      }

      if (items.length < limit) break;
      offset += limit;
    }
  }

  console.log("Tracks found in your playlists:", trackSet.size);
  return trackSet;
}

function normalizeTitle(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // remove (feat...), (remastered), etc.
    .replace(/\[.*?\]/g, "") // remove [bonus], etc.
    .replace(/- .*$/g, "") // remove "- Remastered 2011" etc.
    .replace(/[^a-z0-9\s]/g, "") // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

function trackKeyFromTrack(track) {
  const name = normalizeTitle(track?.name);
  const artist = normalizeTitle(track?.artists?.[0]?.name);
  return `${name}|||${artist}`;
}

async function getPlaylistTrackKeySet(
  maxPlaylists = 50,
  maxTracksPerPlaylist = 500
) {
  const keySet = new Set();

  let playlistOffset = 0;
  const playlistLimit = 50;
  let playlists = [];

  while (playlists.length < maxPlaylists) {
    const pls = await fetchWebApi(
      `v1/me/playlists?limit=${playlistLimit}&offset=${playlistOffset}`,
      "GET"
    );
    const items = pls?.items || [];
    playlists.push(...items);
    if (items.length < playlistLimit) break;
    playlistOffset += playlistLimit;
  }

  playlists = playlists.slice(0, maxPlaylists);

  for (const p of playlists) {
    let offset = 0;
    const limit = 100;

    while (offset < maxTracksPerPlaylist) {
      const data = await fetchWebApi(
        `v1/playlists/${p.id}/tracks?limit=${limit}&offset=${offset}`,
        "GET"
      );

      const items = data?.items || [];
      for (const it of items) {
        const tr = it?.track;
        if (tr?.name && tr?.artists?.length) {
          keySet.add(trackKeyFromTrack(tr));
        }
      }

      if (items.length < limit) break;
      offset += limit;
    }
  }

  console.log("Tracks found in your playlists (keySet):", keySet.size);
  return keySet;
}

// ---------------------------
// UI renderers (card style)
// ---------------------------
function renderTrackCards(tracks, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  if (!tracks.length) {
    container.innerHTML = '<p class="state-message">No tracks found for this view yet.</p>';
    return;
  }
  const ul = document.createElement("ul");

  tracks.forEach((t) => {
    const li = document.createElement("li");
    li.className = "media-row track-row";

    const img = document.createElement("img");
    img.src = t.album?.images?.[0]?.url || "";
    img.alt = t.album?.name ? `${t.album.name} cover` : "Track cover";

    const text = document.createElement("div");
    text.className = "media-copy";

    const title = document.createElement("div");
    title.textContent = t.name || "";
    title.className = "media-title";

    const meta = document.createElement("div");
    const artists = (t.artists || []).map((a) => a.name).join(", ");
    const album = t.album?.name ? ` • ${t.album.name}` : "";
    meta.textContent = `${artists}${album}`;
    meta.className = "media-meta";

    const link = document.createElement("a");
    link.href = t.external_urls?.spotify || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open";
    link.className = "media-link";
    link.setAttribute("aria-label", `Open ${t.name || "track"} in Spotify`);

    text.appendChild(title);
    text.appendChild(meta);

    li.appendChild(img);
    li.appendChild(text);
    li.appendChild(link);
    ul.appendChild(li);
  });

  container.appendChild(ul);
}

function renderArtistCards(artists, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  if (!artists.length) {
    container.innerHTML = '<p class="state-message">No artists found for this view yet.</p>';
    return;
  }
  const ul = document.createElement("ul");

  artists.forEach((a) => {
    const li = document.createElement("li");
    li.className = "media-row artist-row";

    const img = document.createElement("img");
    img.src = a.images?.[0]?.url || "";
    img.alt = a.name ? `${a.name} portrait` : "Artist portrait";

    const text = document.createElement("div");
    text.className = "media-copy";

    const name = document.createElement("div");
    name.textContent = a.name || "";
    name.className = "media-title";

    const meta = document.createElement("div");
    const followers = a.followers?.total
      ? `${a.followers.total.toLocaleString()} followers`
      : "";
    meta.textContent = followers;
    meta.className = "media-meta";

    const link = document.createElement("a");
    link.href = a.external_urls?.spotify || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open";
    link.className = "media-link";
    link.setAttribute("aria-label", `Open ${a.name || "artist"} in Spotify`);

    text.appendChild(name);
    text.appendChild(meta);

    li.appendChild(img);
    li.appendChild(text);
    li.appendChild(link);
    ul.appendChild(li);
  });

  container.appendChild(ul);
}

function renderState(containerId, message, isError = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const state = document.createElement("p");
  state.className = `state-message${isError ? " error" : ""}`;
  state.textContent = message;
  container.appendChild(state);
}

// ---------------------------
// Page functions
// ---------------------------
async function populateUI() {
  if (PREVIEW_MODE) {
    const display = document.getElementById("displayName");
    const avatar = document.getElementById("avatar");
    if (display) display.textContent = "Preview listener";
    if (avatar) {
      avatar.src = previewImage("PL", "#1ed760", "#001b09");
      avatar.alt = "Preview listener avatar";
    }
    return;
  }

  const me = await fetchWebApi("v1/me", "GET");
  if (!me) return;

  const display = document.getElementById("displayName");
  if (display) display.textContent = me.display_name || "Spotify User";

  const avatar = document.getElementById("avatar");
  if (avatar) {
    avatar.src = me.images?.[0]?.url || "";
    avatar.alt = me.display_name || "avatar";
  }
}

async function getTopTracks(limit = 5) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));
  if (PREVIEW_MODE) {
    renderTrackCards(PREVIEW_TRACKS.slice(0, safeLimit), "widgetContainer1");
    return;
  }
  try {
    const data = await fetchWebApi(
      `v1/me/top/tracks?limit=${safeLimit}&time_range=short_term`,
      "GET"
    );
    if (data?.items) renderTrackCards(data.items, "widgetContainer1");
  } catch (error) {
    renderState("widgetContainer1", "Couldn't load your top tracks. Try refreshing this page.", true);
    console.error(error);
  }
}

async function getTopArtists(limit = 5) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));
  if (PREVIEW_MODE) {
    renderArtistCards(PREVIEW_ARTISTS.slice(0, safeLimit), "widgetContainer2");
    return;
  }
  try {
    const data = await fetchWebApi(
      `v1/me/top/artists?limit=${safeLimit}&time_range=short_term`,
      "GET"
    );
    if (data?.items) renderArtistCards(data.items, "widgetContainer2");
  } catch (error) {
    renderState("widgetContainer2", "Couldn't load your top artists. Try refreshing this page.", true);
    console.error(error);
  }
}

// Spotify has restricted many "charts/editorial" Web API endpoints for new/dev apps.
// The most reliable way to show "Top 50 Global" is the embed player.
function getTopSongsGlobal() {
  const container = document.getElementById("widgetContainer5");
  if (!container) return;

  container.innerHTML = `
    <iframe
      style="border-radius:12px"
      src="https://open.spotify.com/embed/playlist/37i9dQZEVXbMDoHDwVN2tF"
      width="75%"
      height="700"
      frameborder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy">
    </iframe>
  `;
}

// ---------------------------
// "Personally Made For You"
// ---------------------------
async function getTrackRec() {
  if (PREVIEW_MODE) {
    renderTrackCards([...PREVIEW_TRACKS].reverse(), "widgetContainer3");
    return;
  }
  try {
    // 1) Your top artists (seed taste)
    const topArtists = await fetchWebApi(
      "v1/me/top/artists?time_range=short_term&limit=10",
      "GET"
    );
    if (!topArtists?.items?.length) return;

    const artistIds = topArtists.items
      .map((a) => a.id)
      .filter(Boolean)
      .slice(0, 8);

    // 2) Collect candidate tracks from each artist
    let candidateTracks = [];

    for (const artistId of artistIds) {
      // Artist top tracks
      const top = await fetchWebApi(
        `v1/artists/${artistId}/top-tracks?market=CA`,
        "GET"
      );
      if (top?.tracks?.length) candidateTracks.push(...top.tracks);

      // Recent albums/singles -> get track ids -> fetch full tracks
      const albums = await fetchWebApi(
        `v1/artists/${artistId}/albums?include_groups=album,single&market=CA&limit=3`,
        "GET"
      );

      const albumIds = (albums?.items || []).map((x) => x.id).filter(Boolean);
      let recentTrackIds = [];

      for (const albumId of albumIds) {
        const albumTracks = await fetchWebApi(
          `v1/albums/${albumId}/tracks?limit=10`,
          "GET"
        );
        const ids = (albumTracks?.items || []).map((t) => t.id).filter(Boolean);
        recentTrackIds.push(...ids);
      }

      recentTrackIds = Array.from(new Set(recentTrackIds));
      if (recentTrackIds.length) {
        const fullRecent = await fetchFullTracksByIds(recentTrackIds);
        candidateTracks.push(...fullRecent);
      }
    }

    // 3) De-dupe
    candidateTracks = uniqById(candidateTracks);

    const playlistIdSet = await getPlaylistTrackIdSet(50, 500);
    const playlistKeySet = await getPlaylistTrackKeySet(50, 500);

    console.log("Before playlist filter:", candidateTracks.length);
    candidateTracks = candidateTracks.filter((t) => {
      if (playlistIdSet.has(t.id)) return false;
      const key = trackKeyFromTrack(t);
      if (playlistKeySet.has(key)) return false;
      return true;
    });
    console.log("After playlist filter:", candidateTracks.length);

    // 4) Filter out tracks already saved in your library (most important)
    const ids = candidateTracks.map((t) => t.id);
    const keepIds = await filterOutSavedTracks(ids);
    console.log("candidate ids:", ids.length, "keep ids:", keepIds.length);
    const keepSet = new Set(keepIds);
    candidateTracks = candidateTracks.filter((t) => keepSet.has(t.id));

    // 5) Also filter out your own top tracks (so it feels "new")
    const myTop = await fetchWebApi(
      "v1/me/top/tracks?limit=50&time_range=short_term",
      "GET"
    );
    const topSet = new Set((myTop?.items || []).map((t) => t.id));
    candidateTracks = candidateTracks.filter((t) => !topSet.has(t.id));

    // 6) Rank + take N
    candidateTracks.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const finalTracks = candidateTracks.slice(0, 10);

    renderTrackCards(finalTracks, "widgetContainer3");
  } catch (e) {
    console.error("Error building Track Recs:", e.message);
    renderState(
      "widgetContainer3",
      "Couldn't build track recommendations right now. Try refreshing this page.",
      true
    );
  }
}

async function getArtistRec() {
  if (PREVIEW_MODE) {
    renderArtistCards([...PREVIEW_ARTISTS].reverse(), "widgetContainer4");
    return;
  }
  try {
    // Avoid recommending artists already in your top list
    const topArtists = await fetchWebApi(
      "v1/me/top/artists?time_range=short_term&limit=10",
      "GET"
    );
    const topNames = new Set(
      (topArtists?.items || []).map((a) => a.name?.toLowerCase())
    );

    // Look at your top tracks and collect collaborators as candidate names
    const topTracks = await fetchWebApi(
      "v1/me/top/tracks?time_range=short_term&limit=30",
      "GET"
    );
    const names = [];

    for (const t of topTracks?.items || []) {
      for (const a of t.artists || []) {
        const n = a.name?.toLowerCase();
        if (n && !topNames.has(n)) names.push(a.name);
      }
    }

    const uniqueNames = Array.from(new Set(names)).slice(0, 8);

    // Search Spotify for artist objects (to get images)
    const artistObjs = [];
    for (const name of uniqueNames) {
      const q = encodeURIComponent(`artist:${name}`);
      const search = await fetchWebApi(
        `v1/search?q=${q}&type=artist&limit=1`,
        "GET"
      );
      const artist = search?.artists?.items?.[0];
      if (artist) artistObjs.push(artist);
    }

    renderArtistCards(artistObjs, "widgetContainer4");
  } catch (e) {
    console.error("Error building Artist Recs:", e.message);
    renderState(
      "widgetContainer4",
      "Couldn't build artist recommendations right now. Try refreshing this page.",
      true
    );
  }
}
