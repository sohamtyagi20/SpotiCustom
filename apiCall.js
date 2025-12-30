// // apiCall.js (cleaned)
// //
// // Frontend helpers for your Spotify app.
// // Requires the server to set a cookie named "accessToken" containing a Spotify access token.
// //
// // Pages that use this file:
// // - aboutMe.html: populateUI(), getTopTracks(5), getTopArtists(5)
// // - forMe.html:   getTrackRec(), getArtistRec()
// // - success.html: getTopSongsGlobal()

// const SERVER_URL = window.location.origin;
// const TOKEN_COOKIE = "accessToken";

// // ---------------------------
// // Cookies / Auth
// // ---------------------------
// function getCookie(name) {
//   const value = `; ${document.cookie}`;
//   const parts = value.split(`; ${name}=`);
//   if (parts.length === 2) return parts.pop().split(";").shift();
//   return null;
// }

// async function fetchWebApi(endpoint, method = "GET", body) {
//   const accessToken = getCookie(TOKEN_COOKIE);

//   if (!accessToken) {
//     // No token cookie -> kick to login
//     // window.location.href = SERVER_URL;
//     window.location.href = "/login";
//     return null;
//   }

//   const res = await fetch(`https://api.spotify.com/${endpoint}`, {
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       "Content-Type": "application/json",
//     },
//     method,
//     body: body ? JSON.stringify(body) : undefined,
//   });

//   // Auth errors: go login again
//   if (res.status === 401 || res.status === 403) {
//     console.log(
//       "Spotify auth error:",
//       res.status,
//       await res.text().catch(() => "")
//     );
//     window.location.href = SERVER_URL;
//     return null;
//   }

//   if (!res.ok) {
//     const txt = await res.text().catch(() => "");
//     throw new Error(`Spotify API failed: ${res.status} ${txt}`);
//   }

//   // Some endpoints return 204
//   if (res.status === 204) return {};
//   return await res.json().catch(() => ({}));
// }

// function logOut() {
//   window.location.href = `${SERVER_URL}/logout`;
// }

// // ---------------------------
// // Small helpers
// // ---------------------------
// function chunk(arr, size) {
//   const out = [];
//   for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
//   return out;
// }

// function uniqById(items) {
//   const seen = new Set();
//   const out = [];
//   for (const it of items) {
//     const id = it?.id;
//     if (!id) continue;
//     if (seen.has(id)) continue;
//     seen.add(id);
//     out.push(it);
//   }
//   return out;
// }

// async function fetchFullTracksByIds(ids) {
//   const idsClean = ids.filter(Boolean);
//   const groups = chunk(idsClean, 50);
//   const all = [];
//   for (const g of groups) {
//     const data = await fetchWebApi(`v1/tracks?ids=${g.join(",")}`, "GET");
//     if (data?.tracks?.length) all.push(...data.tracks);
//   }
//   return all;
// }

// // Returns a subset of ids that are NOT saved (best-effort).
// // Needs user-library-read scope.
// async function filterOutSavedTracks(trackIds) {
//   const ids = trackIds.filter(Boolean);
//   const groups = chunk(ids, 50);
//   const keep = [];

//   for (const g of groups) {
//     const saved = await fetchWebApi(
//       `v1/me/tracks/contains?ids=${g.join(",")}`,
//       "GET"
//     );
//     if (!saved) {
//       // If auth failed, fetchWebApi already redirected.
//       return keep;
//     }
//     // saved is boolean[]
//     for (let i = 0; i < g.length; i++) {
//       if (saved[i] === false) keep.push(g[i]);
//     }
//   }

//   return keep;
// }

// async function getPlaylistTrackIdSet(
//   maxPlaylists = 50,
//   maxTracksPerPlaylist = 500
// ) {
//   const trackSet = new Set();

//   // paginate playlists
//   let playlistOffset = 0;
//   const playlistLimit = 50;
//   let playlists = [];

//   while (playlists.length < maxPlaylists) {
//     const pls = await fetchWebApi(
//       `v1/me/playlists?limit=${playlistLimit}&offset=${playlistOffset}`,
//       "GET"
//     );
//     const items = pls?.items || [];
//     playlists.push(...items);

//     if (items.length < playlistLimit) break;
//     playlistOffset += playlistLimit;
//   }

//   playlists = playlists.slice(0, maxPlaylists);

//   // fetch tracks from each playlist
//   for (const p of playlists) {
//     let offset = 0;
//     const limit = 100;

//     while (offset < maxTracksPerPlaylist) {
//       const data = await fetchWebApi(
//         `v1/playlists/${p.id}/tracks?limit=${limit}&offset=${offset}`,
//         "GET"
//       );

//       const items = data?.items || [];
//       for (const it of items) {
//         const id = it?.track?.id;
//         if (id) trackSet.add(id);
//       }

//       if (items.length < limit) break;
//       offset += limit;
//     }
//   }

//   console.log("Tracks found in your playlists:", trackSet.size);
//   return trackSet;
// }

// function normalizeTitle(s) {
//   return (s || "")
//     .toLowerCase()
//     .replace(/\(.*?\)/g, "") // remove (feat...), (remastered), etc.
//     .replace(/\[.*?\]/g, "") // remove [bonus], etc.
//     .replace(/- .*$/g, "") // remove "- Remastered 2011" etc.
//     .replace(/[^a-z0-9\s]/g, "") // remove punctuation
//     .replace(/\s+/g, " ")
//     .trim();
// }

// function trackKeyFromTrack(track) {
//   const name = normalizeTitle(track?.name);
//   const artist = normalizeTitle(track?.artists?.[0]?.name);
//   return `${name}|||${artist}`;
// }

// async function getPlaylistTrackKeySet(
//   maxPlaylists = 50,
//   maxTracksPerPlaylist = 500
// ) {
//   const keySet = new Set();

//   let playlistOffset = 0;
//   const playlistLimit = 50;
//   let playlists = [];

//   while (playlists.length < maxPlaylists) {
//     const pls = await fetchWebApi(
//       `v1/me/playlists?limit=${playlistLimit}&offset=${playlistOffset}`,
//       "GET"
//     );
//     const items = pls?.items || [];
//     playlists.push(...items);
//     if (items.length < playlistLimit) break;
//     playlistOffset += playlistLimit;
//   }

//   playlists = playlists.slice(0, maxPlaylists);

//   for (const p of playlists) {
//     let offset = 0;
//     const limit = 100;

//     while (offset < maxTracksPerPlaylist) {
//       const data = await fetchWebApi(
//         `v1/playlists/${p.id}/tracks?limit=${limit}&offset=${offset}`,
//         "GET"
//       );

//       const items = data?.items || [];
//       for (const it of items) {
//         const tr = it?.track;
//         if (tr?.name && tr?.artists?.length) {
//           keySet.add(trackKeyFromTrack(tr));
//         }
//       }

//       if (items.length < limit) break;
//       offset += limit;
//     }
//   }

//   console.log("Tracks found in your playlists (keySet):", keySet.size);
//   return keySet;
// }

// // ---------------------------
// // UI renderers (card style)
// // ---------------------------
// function renderTrackCards(tracks, containerId) {
//   const container = document.getElementById(containerId);
//   if (!container) return;

//   container.innerHTML = "";
//   const ul = document.createElement("ul");
//   ul.style.padding = "0";

//   tracks.forEach((t) => {
//     const li = document.createElement("li");
//     li.style.listStyle = "none";
//     li.style.display = "flex";
//     li.style.alignItems = "center";
//     li.style.gap = "12px";
//     li.style.padding = "10px";

//     const img = document.createElement("img");
//     img.src = t.album?.images?.[0]?.url || "";
//     img.alt = t.name || "track";
//     img.style.width = "64px";
//     img.style.height = "64px";
//     img.style.borderRadius = "10px";
//     img.style.objectFit = "cover";

//     const text = document.createElement("div");
//     text.style.flex = "1";

//     const title = document.createElement("div");
//     title.textContent = t.name || "";
//     title.style.fontWeight = "600";

//     const meta = document.createElement("div");
//     const artists = (t.artists || []).map((a) => a.name).join(", ");
//     const album = t.album?.name ? ` • ${t.album.name}` : "";
//     meta.textContent = `${artists}${album}`;
//     meta.style.fontSize = "0.9em";
//     meta.style.opacity = "0.85";

//     const link = document.createElement("a");
//     link.href = t.external_urls?.spotify || "#";
//     link.target = "_blank";
//     link.rel = "noreferrer";
//     link.textContent = "Open";
//     link.style.marginLeft = "auto";

//     text.appendChild(title);
//     text.appendChild(meta);

//     li.appendChild(img);
//     li.appendChild(text);
//     li.appendChild(link);
//     ul.appendChild(li);
//   });

//   container.appendChild(ul);
// }

// function renderArtistCards(artists, containerId) {
//   const container = document.getElementById(containerId);
//   if (!container) return;

//   container.innerHTML = "";
//   const ul = document.createElement("ul");
//   ul.style.padding = "0";

//   artists.forEach((a) => {
//     const li = document.createElement("li");
//     li.style.listStyle = "none";
//     li.style.display = "flex";
//     li.style.alignItems = "center";
//     li.style.gap = "12px";
//     li.style.padding = "10px";

//     const img = document.createElement("img");
//     img.src = a.images?.[0]?.url || "";
//     img.alt = a.name || "artist";
//     img.style.width = "64px";
//     img.style.height = "64px";
//     img.style.borderRadius = "50%";
//     img.style.objectFit = "cover";

//     const text = document.createElement("div");
//     text.style.flex = "1";

//     const name = document.createElement("div");
//     name.textContent = a.name || "";
//     name.style.fontWeight = "600";

//     const meta = document.createElement("div");
//     const followers = a.followers?.total
//       ? `${a.followers.total.toLocaleString()} followers`
//       : "";
//     meta.textContent = followers;
//     meta.style.fontSize = "0.9em";
//     meta.style.opacity = "0.85";

//     const link = document.createElement("a");
//     link.href = a.external_urls?.spotify || "#";
//     link.target = "_blank";
//     link.rel = "noreferrer";
//     link.textContent = "Open";
//     link.style.marginLeft = "auto";

//     text.appendChild(name);
//     text.appendChild(meta);

//     li.appendChild(img);
//     li.appendChild(text);
//     li.appendChild(link);
//     ul.appendChild(li);
//   });

//   container.appendChild(ul);
// }

// // ---------------------------
// // Page functions
// // ---------------------------
// async function populateUI() {
//   const me = await fetchWebApi("v1/me", "GET");
//   if (!me) return;

//   const display = document.getElementById("displayName");
//   if (display) display.textContent = me.display_name || "Spotify User";

//   const avatar = document.getElementById("avatar");
//   if (avatar) {
//     avatar.src = me.images?.[0]?.url || "";
//     avatar.alt = me.display_name || "avatar";
//   }
// }

// async function getTopTracks(limit = 5) {
//   const data = await fetchWebApi(
//     `v1/me/top/tracks?limit=${limit}&time_range=short_term`,
//     "GET"
//   );
//   if (!data?.items) return;
//   renderTrackCards(data.items, "widgetContainer1");
// }

// async function getTopArtists(limit = 5) {
//   const data = await fetchWebApi(
//     `v1/me/top/artists?limit=${limit}&time_range=short_term`,
//     "GET"
//   );
//   if (!data?.items) return;
//   renderArtistCards(data.items, "widgetContainer2");
// }

// // Spotify has restricted many "charts/editorial" Web API endpoints for new/dev apps.
// // The most reliable way to show "Top 50 Global" is the embed player.
// async function getTopSongsGlobal() {
//   const containerId = "widgetContainer5";
//   const container = document.getElementById(containerId);
//   if (!container) return;

//   // Lightweight loading state
//   container.innerHTML = `<div style="padding:12px;color:rgba(255,255,255,0.75)">Loading Top 50 Global…</div>`;

//   try {
//     const playlistId = "37i9dQZEVXbMDoHDwVN2tF";
//     const data = await fetchWebApi(
//       `v1/playlists/${playlistId}/tracks?limit=50&market=CA`,
//       "GET"
//     );

//     const tracks = (data?.items || [])
//       .map((it) => it && it.track)
//       .filter((t) => t && t.id && t.name && t.album);

//     if (!tracks.length) {
//       container.innerHTML = `
//         <div style="padding:12px;color:rgba(255,255,255,0.75)">
//           Couldn’t load Top 50 Global right now.
//           <div style="margin-top:10px">
//             <a href="https://open.spotify.com/playlist/${playlistId}" target="_blank" rel="noreferrer"
//                style="color:#1db954;font-weight:800">Open in Spotify</a>
//           </div>
//         </div>`;
//       return;
//     }

//     // Add rank numbers (optional) by attaching a __rank field for rendering.
//     const ranked = tracks.map((t, i) => ({ ...t, __rank: i + 1 }));
//     renderTrackCards(ranked, containerId);

//     // Add rank labels without rewriting your whole renderer:
//     // prepend "1. " to the title line after render.
//     const ul = container.querySelector("ul");
//     if (ul) {
//       const lis = ul.querySelectorAll("li");
//       lis.forEach((li, idx) => {
//         const titleEl = li.querySelector("div > div"); // first title div
//         if (titleEl && titleEl.textContent && !titleEl.textContent.startsWith(`${idx + 1}. `)) {
//           titleEl.textContent = `${idx + 1}. ${titleEl.textContent}`;
//         }
//       });
//     }
//   } catch (err) {
//     console.error("Error fetching Top 50 Global:", err);
//     container.innerHTML = `
//       <div style="padding:12px;color:rgba(255,255,255,0.75)">
//         Error loading Top 50 Global.
//         <div style="margin-top:10px">
//           <a href="https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF" target="_blank" rel="noreferrer"
//              style="color:#1db954;font-weight:800">Open in Spotify</a>
//         </div>
//       </div>`;
//   }
// }


// // ---------------------------
// // "Personally Made For You"
// // ---------------------------
// async function getTrackRec() {
//   try {
//     // 1) Your top artists (seed taste)
//     const topArtists = await fetchWebApi(
//       "v1/me/top/artists?time_range=short_term&limit=10",
//       "GET"
//     );
//     if (!topArtists?.items?.length) return;

//     const artistIds = topArtists.items
//       .map((a) => a.id)
//       .filter(Boolean)
//       .slice(0, 8);

//     // 2) Collect candidate tracks from each artist
//     let candidateTracks = [];

//     for (const artistId of artistIds) {
//       // Artist top tracks
//       const top = await fetchWebApi(
//         `v1/artists/${artistId}/top-tracks?market=CA`,
//         "GET"
//       );
//       if (top?.tracks?.length) candidateTracks.push(...top.tracks);

//       // Recent albums/singles -> get track ids -> fetch full tracks
//       const albums = await fetchWebApi(
//         `v1/artists/${artistId}/albums?include_groups=album,single&market=CA&limit=3`,
//         "GET"
//       );

//       const albumIds = (albums?.items || []).map((x) => x.id).filter(Boolean);
//       let recentTrackIds = [];

//       for (const albumId of albumIds) {
//         const albumTracks = await fetchWebApi(
//           `v1/albums/${albumId}/tracks?limit=10`,
//           "GET"
//         );
//         const ids = (albumTracks?.items || []).map((t) => t.id).filter(Boolean);
//         recentTrackIds.push(...ids);
//       }

//       recentTrackIds = Array.from(new Set(recentTrackIds));
//       if (recentTrackIds.length) {
//         const fullRecent = await fetchFullTracksByIds(recentTrackIds);
//         candidateTracks.push(...fullRecent);
//       }
//     }

//     // 3) De-dupe
//     candidateTracks = uniqById(candidateTracks);

//     const playlistIdSet = await getPlaylistTrackIdSet(50, 500);
//     const playlistKeySet = await getPlaylistTrackKeySet(50, 500);

//     console.log("Before playlist filter:", candidateTracks.length);
//     candidateTracks = candidateTracks.filter((t) => {
//       if (playlistIdSet.has(t.id)) return false;
//       const key = trackKeyFromTrack(t);
//       if (playlistKeySet.has(key)) return false;
//       return true;
//     });
//     console.log("After playlist filter:", candidateTracks.length);

//     // 4) Filter out tracks already saved in your library (most important)
//     const ids = candidateTracks.map((t) => t.id);
//     const keepIds = await filterOutSavedTracks(ids);
//     console.log("candidate ids:", ids.length, "keep ids:", keepIds.length);
//     const keepSet = new Set(keepIds);
//     candidateTracks = candidateTracks.filter((t) => keepSet.has(t.id));

//     // 5) Also filter out your own top tracks (so it feels "new")
//     const myTop = await fetchWebApi(
//       "v1/me/top/tracks?limit=50&time_range=short_term",
//       "GET"
//     );
//     const topSet = new Set((myTop?.items || []).map((t) => t.id));
//     candidateTracks = candidateTracks.filter((t) => !topSet.has(t.id));

//     // 6) Rank + take N
//     candidateTracks.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
//     const finalTracks = candidateTracks.slice(0, 10);

//     renderTrackCards(finalTracks, "widgetContainer3");
//   } catch (e) {
//     console.error("Error building Track Recs:", e.message);
//   }
// }

// async function getArtistRec() {
//   try {
//     // Avoid recommending artists already in your top list
//     const topArtists = await fetchWebApi(
//       "v1/me/top/artists?time_range=short_term&limit=10",
//       "GET"
//     );
//     const topNames = new Set(
//       (topArtists?.items || []).map((a) => a.name?.toLowerCase())
//     );

//     // Look at your top tracks and collect collaborators as candidate names
//     const topTracks = await fetchWebApi(
//       "v1/me/top/tracks?time_range=short_term&limit=30",
//       "GET"
//     );
//     const names = [];

//     for (const t of topTracks?.items || []) {
//       for (const a of t.artists || []) {
//         const n = a.name?.toLowerCase();
//         if (n && !topNames.has(n)) names.push(a.name);
//       }
//     }

//     const uniqueNames = Array.from(new Set(names)).slice(0, 8);

//     // Search Spotify for artist objects (to get images)
//     const artistObjs = [];
//     for (const name of uniqueNames) {
//       const q = encodeURIComponent(`artist:${name}`);
//       const search = await fetchWebApi(
//         `v1/search?q=${q}&type=artist&limit=1`,
//         "GET"
//       );
//       const artist = search?.artists?.items?.[0];
//       if (artist) artistObjs.push(artist);
//     }

//     renderArtistCards(artistObjs, "widgetContainer4");
//   } catch (e) {
//     console.error("Error building Artist Recs:", e.message);
//   }
// }
let playing = true;
// const access_token = null;
const access_token = getCookie("accessToken");
function getCookie(cookieName) {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === cookieName) {
      return decodeURIComponent(value);
    }
  }
  return null; // Cookie not found
}

async function fetchWebApi(endpoint, method, body) {
  console.log(endpoint);
  try {
    
    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
      headers: {
        Authorization: "Bearer " + access_token,
      },
      method,
      body: JSON.stringify(body),
    });
    console.log('Response:', res);

    if (!res.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await res.json().catch(() => ({})); // Attempt to parse as JSON

    return data;
  } catch (error) {
    console.error("Error fetching data:", error.message);
    alert("Please login again");
    const serverUrl = "http://localhost:8000";
    window.location.href = `${serverUrl}`;
  }
}

function logOut() {
  console.log("worked");
  const serverUrl = "http://localhost:8000/logout";
  window.location.href = `${serverUrl}`;
}

async function makeUserApiCall() {
  try {
    const response = await fetchWebApi("v1/me", "GET");
    const data = await response;
    console.log("User Profile:", data);
    return data;
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
  }
}

async function populateUI() {
  const profile = await makeUserApiCall();
  // Populate UI with the User's information here
  if (profile.images[0]) {
    console.log("Worked");
    const profileImage = new Image(200, 200);
    console.log("Imag URL " + profile.images[0].url);
    profileImage.src = profile.images[0].url;
    document.getElementById("avatar").appendChild(profileImage);
  } else {
    const profileImage = new Image(200, 200);
    profileImage.src =
      "data:image/jpeg;base64,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";
    document.getElementById("avatar").appendChild(profileImage);
  }
  document.getElementById("displayName").innerText = profile.display_name;
  // document.getElementById("id").innerText = profile.id;
  // document.getElementById("email").innerText = profile.email;
  // document.getElementById("uri").innerText = profile.uri;
  // document.getElementById("uri").setAttribute("href", profile.external_urls.spotify);
  // document.getElementById("url").innerText = profile.href;
  // document.getElementById("url").setAttribute("href", profile.href);
}

async function getTopTracks(limit) {
  try {
    const response = await fetchWebApi(
      `v1/me/top/tracks?time_range=short_term&limit=${limit}&offset=0`,
      "GET"
    );
    const recData = await response;
    console.log("Top Tracks: ", recData);
    return populateWidget(recData, 1, "track");
  } catch (error) {
    console.error("Error fetching tracks:", error.message);
  }
}

async function getTopArtists(limit) {
  try {
    const response = await fetchWebApi(
      `v1/me/top/artists?time_range=short_term&limit=${limit}&offset=0`,
      "GET"
    );
    const recData = await response;
    console.log("Artists: ", recData);
    return populateWidget(recData, 2, "artist");
  } catch (error) {
    console.error("Error fetching artists:", error.message);
  }
}

function populateWidget(recData, num, type) {
  const widgetContainer = document.getElementById("widgetContainer" + num);
  widgetContainer.innerHTML = ""; // Clear any previous content

  const songList = document.createElement("ul"); // Use <ul> for an unordered list
  songList.classList.add("song-list");
  if ((type === "track") | (type === "artist")) {
    recData.items.forEach((item, index) => {
      if (type === "track") {
        const songElement = document.createElement("li");
        songElement.classList.add("song");
        const songName = item.name;
        const artistNames = item.artists[0].name;
        const songImgUrl = item.album.images[2].url;

        const songNumber = document.createElement("span");
        songNumber.classList.add("song-number");
        songNumber.innerText = `${index + 1}.  `;

        const songImage = new Image();
        songImage.src = songImgUrl;
        songImage.alt = `${songName} - ${artistNames}`;
        songImage.classList.add("song-image");

        if (item.preview_url) {
          const audioPlayer = new Audio(item.preview_url);

          const songButton = document.createElement("button");
          songButton.classList.add("play-button");
          songButton.innerText = "▶";

          songButton.addEventListener("click", (event) => {
            playAudio(audioPlayer, songButton);
          });
          songElement.appendChild(songButton);
        }

        const songText = document.createElement("span");
        songText.classList.add("song-text");
        songText.innerHTML = `   ${songName} - ${artistNames} `;

        songElement.appendChild(songNumber);
        songElement.appendChild(songImage);
        songElement.appendChild(songText);
        songList.appendChild(songElement);
      } else if (type === "artist") {
        const artistName = item.name;
        const songImgUrl = item.images[2].url;

        const songNumber = document.createElement("span");
        songNumber.classList.add("song-number");
        songNumber.innerText = `${index + 1}.  `;

        const songImage = new Image();
        songImage.src = songImgUrl;
        songImage.alt = `${artistName}`;
        songImage.classList.add("song-image");

        const songElement = document.createElement("li"); // Use <li> for list items
        songElement.classList.add("artist-top");
        const songText = document.createElement("span");
        songText.classList.add("song-text");
        songText.innerHTML = `   ${artistName} `;

        songElement.appendChild(songNumber);
        songElement.appendChild(songImage);
        songElement.appendChild(songText);
        songList.appendChild(songElement);
      }
    });
  } else if (type === "rec") {
    recData.tracks.forEach((track, index) => {
      const songName = track.name;
      const artistName = track.artists[0].name;

      const songElement = document.createElement("li");
      songElement.classList.add("song-rec");
      songElement.innerText = `${index + 1}. ${songName} - ${artistName}`;
      songList.appendChild(songElement);
    });
  } else if (type === "recart") {
    for (let index = 0; index < recData.length; index++) {
      const artistName = recData[index];
      const artistElement = document.createElement("li"); // Use <li> for list items
      artistElement.classList.add("artist-rec");
      artistElement.innerText = `${index + 1}. ${artistName}`;
      songList.appendChild(artistElement);
    }
  } else if (type === "topSongs") {
    recData.items.forEach((item, index) => {
      const songName = item.track.name;
      const artistNames = item.track.artists[0].name;
      const songImgUrl = item.track.album.images[2].url;

      const songElement = document.createElement("li");
      songElement.classList.add("song");

      const songNumber = document.createElement("span");
      songNumber.classList.add("song-number");
      songNumber.innerText = `${index + 1} `;

      const songImage = new Image();
      songImage.src = songImgUrl;
      songImage.alt = `${songName} - ${artistNames}`;
      songImage.classList.add("song-image");

      if (item.track.preview_url) {
        const audioPlayer = new Audio(item.track.preview_url);

        const songButton = document.createElement("button");
        songButton.classList.add("play-button");
        songButton.innerText = "▶";

        songButton.addEventListener("click", (event) => {
          playAudio(audioPlayer, songButton);
        });
        songElement.appendChild(songButton);
      }

      const songText = document.createElement("span");
      songText.classList.add("song-text");
      songText.innerHTML = `   ${songName} - ${artistNames} `;

      songElement.appendChild(songNumber);
      songElement.appendChild(songImage);
      songElement.appendChild(songText);
      songList.appendChild(songElement);
    });
  }

  widgetContainer.appendChild(songList);
}

function playAudio(player, playButton) {
  if (!playing) {
    player.pause();
    player.currentTime = 0;
    playButton.textContent = "▶";
  } else {
    player.play();
    playButton.textContent = "⏸";
  }

  playing = !playing;
}

async function getTrackRec() {
  try {
    const topTracksResponseId = await fetchWebApi(
      `v1/me/top/tracks?time_range=short_term&limit=5&offset=0`,
      "GET"
    );
    const topTracksData = await topTracksResponseId;

    // console.log("Top tracks data: ",topTracksData);
    const topTrackIds = topTracksData.items.map((track) => track.id);
    // console.log(topTrackIds);
    const topTracks = await fetchWebApi(
      `v1/recommendations?limit=5&seed_tracks=${topTrackIds.join(",")}`,
      "GET"
    );
    console.log("Result: ", topTracks);
    return populateWidget(topTracks, 3, "rec");
  } catch (error) {
    console.error("Error fetching Rec Tracks:", error.message);
  }
}

// async function getArtistRec() {
//   try {
//     const topArtistData = await fetchWebApi(`v1/me/top/artists?time_range=short_term&limit=5&offset=0`,'GET');
//     // const response = await topArtist;
//     // console.log("Artist: ",topArtist);
//     const topArtistIds = topArtistData.items.map(artist =>artist.id);
//     // console.log(topArtistIds);
//     const topArtist = await fetchWebApi(`v1/recommendations?limit=5&seed_artists=${topArtistIds.join(",")}`,'GET')
//     console.log("Artist response: ",topArtist)
//     const artistName = topArtist.items.map
//   } catch (error) {
//     console.error('Error fetching Rec Artist:', error.message);
//   }
// }

async function getArtistRec() {
  try {
    let relatedArtistNames = [];
    let finalArtist = [];
    const top5Artist = await fetchWebApi(
      `v1/me/top/artists?time_range=short_term&limit=5&offset=0`,
      "GET"
    );
    const top5ArtistId = top5Artist.items.map((artist) => artist.id);
    console.log(top5ArtistId);
    for (let index = 0; index < top5ArtistId.length; index++) {
      const relatedArtist = await fetchWebApi(
        `v1/artists/${top5ArtistId[index]}/related-artists`,
        "GET"
      );
      // console.log("Loop: ",relatedArtist);
      // relatedArtistName = relatedArtist.artists.map(artist => artist.name)
      // console.log("loop: ",relatedArtistName)
      let relatedArtistName = relatedArtist.artists[0].name;
      // console.log("First related artist:", relatedArtistName);
      if (!relatedArtistNames.includes(relatedArtistName)) {
        relatedArtistNames.push(relatedArtistName);
        finalArtist.push(relatedArtistName);
      } else {
        relatedArtistName = relatedArtist.artists[1].name;
        finalArtist.push(relatedArtistName);
      }
    }
    console.log("Final result: ", finalArtist);
    return populateWidget(finalArtist, 4, "recart");
  } catch (error) {
    console.error("Error fetching Rec Artist:", error.message);
  }
}

async function getTopSongsGlobal() {
  const PLAYLIST_ID = "37i9dQZEVXbMDoHDwVN2tF"; // Top 50 - Global
  const widgetContainer = document.getElementById("widgetContainer5");
  if (widgetContainer) {
    widgetContainer.innerHTML = "<p style='margin:10px;color:rgba(255,255,255,0.7)'>Loading Top 50 Global…</p>";
  }

  try {
    // Fetch playlist tracks directly (avoid Spotify embed iframe)
    const data = await fetchWebApi(
      `v1/playlists/${PLAYLIST_ID}/tracks?limit=50&market=CA`,
      "GET"
    );

    const tracks = (data?.items || [])
      .map(it => it?.track)
      .filter(Boolean);

    if (!tracks.length) {
      throw new Error("No tracks returned for Top 50 Global.");
    }

    // Reuse existing widget renderer (expects {items:[tracks...]})
    populateWidget({ items: tracks }, 5, "track");
  } catch (error) {
    console.error("Error fetching Top Songs:", error?.message || error);
    if (widgetContainer) {
      widgetContainer.innerHTML = `
        <div style="padding:12px">
          <h3 style="margin:0 0 8px 0;color:rgba(255,255,255,0.9)">Top 50 Global isn’t loading</h3>
          <p style="margin:0 0 12px 0;color:rgba(255,255,255,0.7)">
            This can happen if Spotify is timing out or blocking the request. Try refresh, or open it directly in Spotify.
          </p>
          <a href="https://open.spotify.com/playlist/${PLAYLIST_ID}" target="_blank" rel="noreferrer"
             style="display:inline-block;padding:10px 16px;border-radius:999px;background:#1db954;color:#0b0f14;font-weight:800;text-decoration:none">
             Open in Spotify
          </a>
        </div>`;
    }
  }
}
