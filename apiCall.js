// apiCall.js (cleaned)
//
// Frontend helpers for your Spotify app.
// Requires the server to set a cookie named "accessToken" containing a Spotify access token.
//
// Pages that use this file:
// - aboutMe.html: populateUI(), getTopTracks(5), getTopArtists(5)
// - forMe.html:   getTrackRec(), getArtistRec()
// - success.html: getTopSongsGlobal()

const SERVER_URL = window.location.origin;
const TOKEN_COOKIE = "accessToken";

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
    // window.location.href = SERVER_URL;
    window.location.href = "/login";
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
  const ul = document.createElement("ul");
  ul.style.padding = "0";

  tracks.forEach((t) => {
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "12px";
    li.style.padding = "10px";

    const img = document.createElement("img");
    img.src = t.album?.images?.[0]?.url || "";
    img.alt = t.name || "track";
    img.style.width = "64px";
    img.style.height = "64px";
    img.style.borderRadius = "10px";
    img.style.objectFit = "cover";

    const text = document.createElement("div");
    text.style.flex = "1";

    const title = document.createElement("div");
    title.textContent = t.name || "";
    title.style.fontWeight = "600";

    const meta = document.createElement("div");
    const artists = (t.artists || []).map((a) => a.name).join(", ");
    const album = t.album?.name ? ` • ${t.album.name}` : "";
    meta.textContent = `${artists}${album}`;
    meta.style.fontSize = "0.9em";
    meta.style.opacity = "0.85";

    const link = document.createElement("a");
    link.href = t.external_urls?.spotify || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open";
    link.style.marginLeft = "auto";

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
  const ul = document.createElement("ul");
  ul.style.padding = "0";

  artists.forEach((a) => {
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "12px";
    li.style.padding = "10px";

    const img = document.createElement("img");
    img.src = a.images?.[0]?.url || "";
    img.alt = a.name || "artist";
    img.style.width = "64px";
    img.style.height = "64px";
    img.style.borderRadius = "50%";
    img.style.objectFit = "cover";

    const text = document.createElement("div");
    text.style.flex = "1";

    const name = document.createElement("div");
    name.textContent = a.name || "";
    name.style.fontWeight = "600";

    const meta = document.createElement("div");
    const followers = a.followers?.total
      ? `${a.followers.total.toLocaleString()} followers`
      : "";
    meta.textContent = followers;
    meta.style.fontSize = "0.9em";
    meta.style.opacity = "0.85";

    const link = document.createElement("a");
    link.href = a.external_urls?.spotify || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open";
    link.style.marginLeft = "auto";

    text.appendChild(name);
    text.appendChild(meta);

    li.appendChild(img);
    li.appendChild(text);
    li.appendChild(link);
    ul.appendChild(li);
  });

  container.appendChild(ul);
}

// ---------------------------
// Page functions
// ---------------------------
async function populateUI() {
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
  const data = await fetchWebApi(
    `v1/me/top/tracks?limit=${limit}&time_range=short_term`,
    "GET"
  );
  if (!data?.items) return;
  renderTrackCards(data.items, "widgetContainer1");
}

async function getTopArtists(limit = 5) {
  const data = await fetchWebApi(
    `v1/me/top/artists?limit=${limit}&time_range=short_term`,
    "GET"
  );
  if (!data?.items) return;
  renderArtistCards(data.items, "widgetContainer2");
}

// Spotify has restricted many "charts/editorial" Web API endpoints for new/dev apps.
// The most reliable way to show "Top 50 Global" is the embed player.
async function getTopSongsGlobal() {
  const containerId = "widgetContainer5";
  const container = document.getElementById(containerId);
  if (!container) return;

  // Lightweight loading state
  container.innerHTML = `<div style="padding:12px;color:rgba(255,255,255,0.75)">Loading Top 50 Global…</div>`;

  try {
    const playlistId = "37i9dQZEVXbMDoHDwVN2tF";
    const data = await fetchWebApi(
      `v1/playlists/${playlistId}/tracks?limit=50&market=CA`,
      "GET"
    );

    const tracks = (data?.items || [])
      .map((it) => it && it.track)
      .filter((t) => t && t.id && t.name && t.album);

    if (!tracks.length) {
      container.innerHTML = `
        <div style="padding:12px;color:rgba(255,255,255,0.75)">
          Couldn’t load Top 50 Global right now.
          <div style="margin-top:10px">
            <a href="https://open.spotify.com/playlist/${playlistId}" target="_blank" rel="noreferrer"
               style="color:#1db954;font-weight:800">Open in Spotify</a>
          </div>
        </div>`;
      return;
    }

    // Add rank numbers (optional) by attaching a __rank field for rendering.
    const ranked = tracks.map((t, i) => ({ ...t, __rank: i + 1 }));
    renderTrackCards(ranked, containerId);

    // Add rank labels without rewriting your whole renderer:
    // prepend "1. " to the title line after render.
    const ul = container.querySelector("ul");
    if (ul) {
      const lis = ul.querySelectorAll("li");
      lis.forEach((li, idx) => {
        const titleEl = li.querySelector("div > div"); // first title div
        if (titleEl && titleEl.textContent && !titleEl.textContent.startsWith(`${idx + 1}. `)) {
          titleEl.textContent = `${idx + 1}. ${titleEl.textContent}`;
        }
      });
    }
  } catch (err) {
    console.error("Error fetching Top 50 Global:", err);
    container.innerHTML = `
      <div style="padding:12px;color:rgba(255,255,255,0.75)">
        Error loading Top 50 Global.
        <div style="margin-top:10px">
          <a href="https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF" target="_blank" rel="noreferrer"
             style="color:#1db954;font-weight:800">Open in Spotify</a>
        </div>
      </div>`;
  }
}


// ---------------------------
// "Personally Made For You"
// ---------------------------
async function getTrackRec() {
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
  }
}

async function getArtistRec() {
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
  }
}
