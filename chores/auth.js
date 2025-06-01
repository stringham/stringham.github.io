// auth.js

const LOCAL_STORAGE_TOKEN_KEY = 'gis_access_token';
const LOCAL_STORAGE_TOKEN_EXPIRY_KEY = 'gis_token_expiry';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentAccessToken = null;

// Default callbacks, will be overridden by initializeAuthSystem
let authCallbacks = {
    onSuccess: (tokenResponse) => { console.warn("Auth success: No 'onSuccess' callback configured.", tokenResponse); },
    onError: (errorMessage) => { console.warn("Auth error: No 'onError' callback configured.", errorMessage); },
    onSignOut: () => { console.warn("Auth sign out: No 'onSignOut' callback configured."); }
};

/**
 * Helper function to clear stored token details from localStorage.
 */
function clearStoredToken() {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_EXPIRY_KEY);
    console.log("Stored GIS token cleared from localStorage.");
}

/**
 * Tries to resume a session using a token stored in localStorage.
 * This is called internally by initializeGis.
 * @returns {boolean} True if a session was successfully resumed, false otherwise.
 */
function tryResumeSessionFromStorage() {
    const storedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
    const storedExpiry = localStorage.getItem(LOCAL_STORAGE_TOKEN_EXPIRY_KEY);

    if (storedToken && storedExpiry) {
        const expiryTime = parseInt(storedExpiry, 10);
        if (expiryTime > Date.now()) { // Token is still valid
            currentAccessToken = storedToken;
            console.log("GIS: Session resumed from localStorage. Token expires at:", new Date(expiryTime));

            // If gapi.client is already initialized, set the token for it
            if (gapiInited && gapi && gapi.client) {
                gapi.client.setToken({ access_token: currentAccessToken });
                console.log("GIS: Resumed token set for gapi.client.");
            }

            // Notify the calling application of success
            // Create a mock tokenResponse similar to what GIS provides
            const expiresInSeconds = Math.floor((expiryTime - Date.now()) / 1000);
            authCallbacks.onSuccess({
                access_token: currentAccessToken,
                expires_in: expiresInSeconds,
                resumed: true // Flag to indicate this was a resumed session
            });
            return true;
        } else {
            console.log("GIS: Stored token found but has expired. Clearing.");
            clearStoredToken();
        }
    }
    return false;
}

/**
 * Main initialization function for the auth system.
 * Stores callbacks provided by the calling script (main.js or parent.js).
 * @param {Object} callbacksObject - { onSuccess, onError, onSignOut }
 */
function initializeAuthSystem(callbacksObject) {
    if (callbacksObject) {
        authCallbacks.onSuccess = callbacksObject.onSuccess || authCallbacks.onSuccess;
        authCallbacks.onError = callbacksObject.onError || authCallbacks.onError;
        authCallbacks.onSignOut = callbacksObject.onSignOut || authCallbacks.onSignOut;
    }
    // The actual GIS/GAPI initializations are triggered by their respective script loads
    // calling main.onGisLoad() -> auth.initializeGis()
    // and main.onGapiClientLoad() -> auth.initializeGapiClient()
}

/**
 * Initializes the Google Identity Services (GIS) token client.
 * This is called from main.js (or parent.js) after the GIS script loads.
 */
function initializeGis() {
    return new Promise((resolve, reject) => {
        if (gisInited) {
            // If already initialized, check if we can resume (e.g. if GAPI client just loaded)
            if (!currentAccessToken) tryResumeSessionFromStorage();
            resolve();
            return;
        }
        try {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID, // from config.js
                scope: SCOPES,       // from config.js
                callback: (tokenResponse) => { // This callback handles NEW token responses
                    if (tokenResponse && tokenResponse.access_token) {
                        currentAccessToken = tokenResponse.access_token;
                        const expiryTime = Date.now() + (tokenResponse.expires_in * 1000);
                        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, currentAccessToken);
                        localStorage.setItem(LOCAL_STORAGE_TOKEN_EXPIRY_KEY, expiryTime.toString());
                        console.log("GIS: New access token received and stored. Expires at:", new Date(expiryTime));

                        if (gapiInited && gapi && gapi.client) {
                            gapi.client.setToken({ access_token: currentAccessToken });
                            console.log("GIS: New token set for gapi.client");
                        }
                        authCallbacks.onSuccess(tokenResponse); // Notify app
                    } else {
                        console.error("GIS: Token response error or empty token from new request.", tokenResponse);
                        clearStoredToken(); // Clear any potentially inconsistent stored token
                        authCallbacks.onError("Failed to get a valid access token from Google.");
                    }
                },
                error_callback: (error) => {
                    console.error("GIS: Error from token client (e.g., user closed popup):", error);
                    currentAccessToken = null; // Ensure no stale token
                    clearStoredToken();
                    if (gapiInited && gapi && gapi.client) {
                        gapi.client.setToken(null);
                    }
                    authCallbacks.onError(error.message || error.type || "Authorization attempt failed or was cancelled.");
                }
            });
            gisInited = true;
            console.log("GIS Token Client Initialized by initializeGis.");

            // After initializing the token client, immediately try to resume session
            if (!tryResumeSessionFromStorage()) {
                // No session resumed, means user is effectively signed out or needs to sign in.
                // The UI should reflect this (e.g., show "Connect & Authorize" button).
                // updateAuthDisplayGis in main.js (called via checkApiReadinessAndProceed) will handle this.
                console.log("GIS: No active session resumed from storage.");
            }
            resolve();
        } catch (err) {
            console.error("GIS: Failed to initialize token client in initializeGis", err);
            reject(err);
        }
    });
}

/**
 * Initializes the Google API Client (for Sheets API).
 * This is called from main.js (or parent.js) after the GAPI script loads.
 */
function initializeGapiClient() {
    return new Promise((resolve, reject) => {
        if (gapiInited) {
            resolve();
            return;
        }
        if (typeof gapi === 'undefined' || !gapi.load) {
            const msg = "GAPI script not loaded yet for initializeGapiClient";
            console.error(msg);
            reject(msg);
            return;
        }
        gapi.load('client', () => {
            if (typeof gapi.client === 'undefined' || !gapi.client.load) {
                 const msg = "gapi.client not available after loading 'client'";
                 console.error(msg);
                 reject(msg);
                 return;
            }
            gapi.client.load(DISCOVERY_DOCS[0]) // Load Sheets API discovery document
                .then(() => {
                    gapiInited = true;
                    console.log("GAPI client for Sheets API initialized.");
                    // If an access token was already obtained (e.g., resumed session or GIS init happened first), set it now.
                    if (currentAccessToken && gapi && gapi.client) {
                        gapi.client.setToken({ access_token: currentAccessToken });
                        console.log("GAPI Client: Token set from existing GIS session during GAPI client init.");
                    }
                    resolve();
                })
                .catch(err => {
                    console.error("Error loading GAPI client discovery doc:", err);
                    reject(err);
                });
        });
    });
}

/**
 * Initiates the token request flow. User will be prompted if not signed in or needs to grant consent.
 */
function requestAccessToken() {
    if (!gisInited || !tokenClient) {
        console.error("GIS Token Client not initialized. Cannot request token.");
        authCallbacks.onError("Authentication service not ready. Please refresh.");
        return;
    }
    // An empty prompt often attempts a silent sign-in if possible.
    // Use 'consent' or 'select_account' if you always want to show a popup.
    tokenClient.requestAccessToken({ prompt: '' });
    console.log("GIS: requestAccessToken called.");
}

/**
 * Revokes the current access token and clears it from storage.
 */
function revokeAccessToken() {
    const tokenToRevoke = currentAccessToken; // Capture current token before clearing
    currentAccessToken = null; // Immediately invalidate current token
    clearStoredToken(); // Clear from localStorage

    if (gapiInited && gapi && gapi.client) {
        gapi.client.setToken(null); // Clear token from gapi client
    }

    if (tokenToRevoke && gisInited && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        google.accounts.oauth2.revoke(tokenToRevoke, () => {
            console.log('GIS: Access token revoked with Google.');
            // The onSignOut callback might have already been called due to currentAccessToken being nulled.
            // Calling it again ensures the app knows.
            authCallbacks.onSignOut();
        });
    } else {
        console.log('GIS: No current access token to revoke with Google, or GIS not fully ready. Session cleared locally.');
        authCallbacks.onSignOut(); // Ensure app state is reset
    }
}

/**
 * Checks if there's a current valid access token.
 * @returns {boolean} True if a token is present, false otherwise.
 */
function isUserSignedInGis() {
    // Could also check expiry here if we want to be very strict before an API call,
    // but typically API call failure (401) is the trigger for re-auth if token expires.
    return !!currentAccessToken;
}

// Expose public functions
const auth = {
    initializeAuthSystem,
    initializeGis,
    initializeGapiClient,
    requestAccessToken,
    revokeAccessToken,
    isUserSignedInGis,
    tryResumeSessionFromStorage // Exposing this if main.js wants to call it at a specific time, though initializeGis now handles it.
};