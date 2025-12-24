// servers.js (cleaned)
//
// Run: node servers.js
// Visit: http://127.0.0.1:8000
//
// IMPORTANT: Move your client secret to environment variables before publishing.

const express = require("express");
const axios = require("axios");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 8000;

// --- Spotify App Credentials ---
const clientId = process.env.SPOTIFY_CLIENT_ID;
// ⚠️ Prefer: process.env.SPOTIFY_CLIENT_SECRET
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

// Spotify now requires loopback IP literals (not localhost)
const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

const BASE_URL = process.env.BASE_URL; // e.g. https://your-app.onrender.com

// Scopes needed by your pages
const scopes =
  "user-read-private user-read-email user-top-read user-library-read playlist-read-private";

// Cookie name used by frontend (apiCall.js)
const ACCESS_COOKIE = "accessToken";

// --- Middleware ---
app.use(cookieParser());
app.use(
  session({
    secret: "spotify-session-secret",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.static(__dirname));

// --- Routes ---
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "Starting.html")));

app.get("/login", (req, res) => {
  const authUrl =
    `https://accounts.spotify.com/authorize?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&show_dialog=true`;

  console.log("AUTH URL redirect_uri =", redirectUri);
  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;
    const expiresIn = tokenResponse.data.expires_in; // seconds

    console.log("Access Token:", accessToken);
    console.log("Refresh Token:", refreshToken);

    // Store for later if you want to refresh server-side (optional)
    req.session.refreshToken = refreshToken;

    // Set cookie for frontend JS to use
    res.cookie(ACCESS_COOKIE, accessToken, {
      sameSite: "lax",
      maxAge: expiresIn * 1000,
    });

    // Redirect so refresh/back doesn't re-use the code
    return res.redirect("/success.html");
  } catch (error) {
    console.error(
      "Error exchanging authorization code:",
      error.response?.data || error.message
    );
    return res.status(500).send("Token exchange failed");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(ACCESS_COOKIE);
    res.redirect("/");
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
