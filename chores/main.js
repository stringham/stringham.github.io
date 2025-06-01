// main.js

// Main application state
const appState = {
    currentSpreadsheetId: null,
    currentChildName: null,
    childrenList: [],
    choreNames: [],
    currentStatuses: { yesterday: {}, today: {} },
    allowanceResetDate: '',
    currentAllowanceCount: 0,
    todayRowIndex: null,
    yesterdayRowIndex: null,
    choreNameToColLetter: {},
    isGisReady: false,
    isGapiClientReady: false,
    isAuthenticated: false,
    dataLoadingInitiated: false,
    todayString: '',
    yesterdayString: '',
};

const main = {
    init: function() {
        console.log("Main app initializing (main.init)...");
        this.registerServiceWorker();
        this.initEventListeners();
        this.loadDates(); // Ensure dates are loaded early
        appState.currentSpreadsheetId = localStorage.getItem('spreadsheetId');

        if (typeof auth !== 'undefined' && auth.initializeAuthSystem) {
            auth.initializeAuthSystem({
                onSuccess: this.onAuthSuccess.bind(this),
                onError: this.onAuthError.bind(this),
                onSignOut: this.onAuthSignOut.bind(this)
            });
            console.log("Auth system callbacks configured in main.init.");
        } else {
            console.error("CRITICAL: auth.initializeAuthSystem not found! App will not function correctly.");
            if(typeof ui !== 'undefined' && ui.displayError) ui.displayError("Critical error: Authentication system failed to load.");
            return;
        }

        if (typeof ui !== 'undefined' && ui.showLoading) {
            ui.showLoading(true); // Show loading until API readiness and auth state is resolved
        }
        console.log("main.init() complete. Callbacks set. Waiting for GIS & GAPI client scripts to load via global callbacks...");
    },

    onGisLoad: function() {
        console.log("main.onGisLoad() executed.");
        appState.isGisReady = true;
        if (typeof auth !== 'undefined' && auth.initializeGis) {
            auth.initializeGis()
                .then(() => {
                    console.log("GIS Token Client part of Auth initialized via main.");
                    this.checkApiReadinessAndProceed();
                })
                .catch(err => {
                    if (typeof ui !== 'undefined' && ui.displayError) ui.displayError("Failed to set up Google Sign-In. Please try refreshing.");
                    console.error("Error during auth.initializeGis from main.onGisLoad:", err);
                    if (typeof ui !== 'undefined' && ui.showLoading) ui.showLoading(false);
                });
        } else {
            console.error("auth.initializeGis function not found during main.onGisLoad.");
            if(typeof ui !== 'undefined' && ui.displayError) ui.displayError("Critical error: GIS Auth setup failed.");
        }
    },

    onGapiClientLoad: function() {
        console.log("main.onGapiClientLoad() executed.");
        if (typeof auth !== 'undefined' && auth.initializeGapiClient) {
            auth.initializeGapiClient()
                .then(() => {
                    appState.isGapiClientReady = true;
                    console.log("GAPI Client (for Sheets) part of Auth initialized via main.");
                    this.checkApiReadinessAndProceed();
                })
                .catch(err => {
                    if (typeof ui !== 'undefined' && ui.displayError) ui.displayError("Failed to set up Google Sheets access. Please try refreshing.");
                    console.error("Error during auth.initializeGapiClient from main.onGapiClientLoad:", err);
                    if (typeof ui !== 'undefined' && ui.showLoading) ui.showLoading(false);
                });
        } else {
            console.error("auth.initializeGapiClient function not found during main.onGapiClientLoad.");
            if(typeof ui !== 'undefined' && ui.displayError) ui.displayError("Critical error: Sheets API setup failed.");
        }
    },

    checkApiReadinessAndProceed: function() {
        if (appState.isGisReady && appState.isGapiClientReady) {
            console.log("MAIN.JS: Both GIS and GAPI Client are now ready (checkApiReadinessAndProceed).");

            let isSignedIn = false;
            if (typeof auth !== 'undefined' && typeof auth.isUserSignedInGis === 'function') {
                isSignedIn = auth.isUserSignedInGis();
            } else {
                console.error("MAIN.JS: auth object or auth.isUserSignedInGis method is not available!");
                if(typeof ui !== 'undefined' && ui.displayError) ui.displayError("Authentication check failed. Auth module error.");
                if(typeof ui !== 'undefined' && ui.showLoading) ui.showLoading(false);
                return;
            }

            appState.isAuthenticated = isSignedIn;
            console.log(`MAIN.JS: isSignedIn status from auth module: ${isSignedIn}`);

            if (typeof ui !== 'undefined' && typeof ui.updateAuthDisplayGis === 'function') {
                 ui.updateAuthDisplayGis(isSignedIn);
            } else {
                console.warn("MAIN.JS: ui.updateAuthDisplayGis is not available to update button states.");
            }

            if (isSignedIn) { // appState.isAuthenticated should reflect this
                console.log("MAIN.JS: User IS considered signed in (checkApiReadinessAndProceed).");
                if (appState.currentSpreadsheetId) {
                    if (!this.dataLoadingInitiated) {
                        console.log("MAIN.JS: Authenticated and Sheet ID known. Triggering loadInitialAppData.");
                        if (typeof ui !== 'undefined' && typeof ui.showView === 'function') {
                            console.log("MAIN.JS: Calling ui.showView('mainAppView') because user is signed in and has Sheet ID.");
                            ui.showView('mainAppView');
                        } else {
                            console.error("MAIN.JS: ui.showView is not available!");
                        }
                        this.loadInitialAppData();
                    } else {
                        console.log("MAIN.JS: Data loading was already handled for this session (or in progress).");
                        if (typeof ui !== 'undefined' && typeof ui.showView === 'function') ui.showView('mainAppView');
                    }
                } else {
                    console.log("MAIN.JS: Authenticated, but no Sheet ID. Intending to show parentSetupView for Sheet ID entry.");
                    if (typeof ui !== 'undefined') {
                        console.log("MAIN.JS: ABOUT TO CALL ui.showView('parentSetupView') for Sheet ID entry (signed in).");
                        ui.showView('parentSetupView');
                        console.log("MAIN.JS: CALLED ui.showView('parentSetupView') for Sheet ID entry (signed in).");
                        ui.displaySetupFeedback("Authorized! Now please enter your Google Sheet ID and save.", true);
                        if (ui.elements && ui.elements.sheetIdInput) ui.elements.sheetIdInput.focus();
                    } else {
                        console.error("MAIN.JS: ui object is not available to show parentSetupView for Sheet ID entry!");
                    }
                }
            } else { // Not authenticated
                console.log("MAIN.JS: User IS NOT signed in (checkApiReadinessAndProceed). Intending to show parentSetupView.");
                if (typeof ui !== 'undefined' && typeof ui.showView === 'function') {
                    console.log("MAIN.JS: ABOUT TO CALL ui.showView('parentSetupView') because user is NOT signed in.");
                    ui.showView('parentSetupView');
                    console.log("MAIN.JS: CALLED ui.showView('parentSetupView').");

                    if (appState.currentSpreadsheetId) {
                        ui.displaySetupFeedback("Sheet ID is set. Please 'Connect & Authorize' to load your chore chart.", false);
                        if (ui.elements && ui.elements.sheetIdInput) {
                            ui.elements.sheetIdInput.value = appState.currentSpreadsheetId;
                        }
                    } else {
                        ui.displaySetupFeedback("Please set up your Sheet ID and authorize access.", false);
                    }
                } else {
                     console.error("MAIN.JS: ui object or ui.showView is not available to show parentSetupView for non-authenticated user!");
                }
            }

            if (typeof ui !== 'undefined' && typeof ui.showLoading === 'function') {
                ui.showLoading(false);
            } else {
                console.warn("MAIN.JS: ui.showLoading is not available to turn off loading indicator.");
            }
        } else {
            console.log("MAIN.JS: APIs not fully ready yet (GIS Ready: " + appState.isGisReady + ", GAPI Client Ready: " + appState.isGapiClientReady + ")");
        }
    },

    onAuthSuccess: function(tokenResponse) {
        console.log("MAIN.JS: onAuthSuccess callback executed. Token (or resume signal):", tokenResponse);
        appState.isAuthenticated = true;
        this.dataLoadingInitiated = false;

        if (typeof ui !== 'undefined') {
            ui.clearError();
            if (ui.updateAuthDisplayGis) ui.updateAuthDisplayGis(true);
        }
        if (!appState.currentSpreadsheetId) {
             appState.currentSpreadsheetId = localStorage.getItem('spreadsheetId');
             console.log("MAIN.JS: Loaded spreadsheetId in onAuthSuccess:", appState.currentSpreadsheetId);
        }
        // Crucially, call checkApiReadinessAndProceed to make the decision on view and data loading
        this.checkApiReadinessAndProceed();
    },

    onAuthError: function(errorMessage) {
        console.error("MAIN.JS: onAuthError callback executed. Error:", errorMessage);
        appState.isAuthenticated = false;
        if (typeof ui !== 'undefined') {
            ui.displayError(`Authorization failed: ${errorMessage}. Please try again.`);
            if (ui.updateAuthDisplayGis) ui.updateAuthDisplayGis(false);
            ui.showView('parentSetupView'); // Default to setup view on auth error
            ui.showLoading(false);
        }
    },

    onAuthSignOut: function() {
        console.log("MAIN.JS: onAuthSignOut callback executed.");
        appState.isAuthenticated = false;
        this.dataLoadingInitiated = false;
        appState.currentChildName = null;
        appState.childrenList = [];
        appState.choreNames = [];
        appState.currentStatuses = { yesterday: {}, today: {} };
        appState.currentAllowanceCount = 0;
        appState.allowanceResetDate = '';
        appState.todayRowIndex = null;
        appState.yesterdayRowIndex = null;
        appState.choreNameToColLetter = {};

        if (typeof ui !== 'undefined') {
            if (ui.updateAuthDisplayGis) ui.updateAuthDisplayGis(false);
            ui.showView('parentSetupView');
            if (ui.elements) {
                if(ui.elements.childTabsContainer) ui.elements.childTabsContainer.innerHTML = '';
                if(ui.elements.choreList) ui.elements.choreList.innerHTML = '';
                if(ui.elements.currentChildTitle) ui.elements.currentChildTitle.textContent = '';
                if(ui.elements.allowanceInfo) ui.elements.allowanceInfo.textContent = '';
                if (ui.elements.sheetIdInput) {
                    ui.elements.sheetIdInput.value = localStorage.getItem('spreadsheetId') || ''; // Keep sheet ID visible
                    ui.elements.sheetIdInput.disabled = false; // Allow editing if signed out
                }
            }
            ui.displaySetupFeedback("Signed out. Please sign in to access your chore chart.", false);
            ui.showLoading(false);
        }
    },

    registerServiceWorker: function() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => console.log('Service Worker registered: ', registration))
                    .catch(error => console.log('Service Worker registration failed: ', error));
            });
        }
    },

    initEventListeners: function() {
        if (typeof ui !== 'undefined' && ui.elements) {
            const authorizeGisButton = document.getElementById('authorizeGisButton');
            const signoutGisButton = document.getElementById('signoutGisButton');

            if (authorizeGisButton) {
                authorizeGisButton.addEventListener('click', () => {
                    if (typeof auth !== 'undefined' && auth.requestAccessToken) {
                        auth.requestAccessToken();
                    } else { console.error("auth.requestAccessToken not defined."); }
                });
            }
            if (signoutGisButton) {
                signoutGisButton.addEventListener('click', () => {
                     if (typeof auth !== 'undefined' && auth.revokeAccessToken) {
                        auth.revokeAccessToken();
                    } else { console.error("auth.revokeAccessToken not defined."); }
                });
            }
            if (ui.elements.saveSheetIdButton) {
                ui.elements.saveSheetIdButton.addEventListener('click', this.handleSaveSheetId.bind(this));
            }
        } else {
            console.warn("UI elements not ready for event listener attachment in main.initEventListeners.");
        }
    },

    loadDates: function() {
        const today = new Date();
        appState.todayString = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        appState.yesterdayString = yesterday.toISOString().split('T')[0];
        console.log("MAIN.JS - loadDates - Today:", appState.todayString, "Yesterday:", appState.yesterdayString);
    },

    handleSaveSheetId: function() {
        if (typeof ui === 'undefined' || !ui.elements || !ui.elements.sheetIdInput) { return; }
        const sheetId = ui.elements.sheetIdInput.value.trim();
        if (sheetId) {
            if (sheetId.length < 30 || sheetId.includes(" ") || !/^[a-zA-Z0-9-_]+$/.test(sheetId)) {
                ui.displaySetupFeedback("Invalid Google Sheet ID format. Please check and try again.", false);
                return;
            }
            appState.currentSpreadsheetId = sheetId;
            localStorage.setItem('spreadsheetId', sheetId);
            ui.displaySetupFeedback("Sheet ID saved!", true);

            if (appState.isAuthenticated) { // Check our internal isAuthenticated flag
                if (typeof ui !== 'undefined' && ui.showView) ui.showView('mainAppView');
                this.loadInitialAppData();
            } else {
                ui.displaySetupFeedback("Sheet ID saved! Please 'Connect & Authorize' to load chores.", false);
                if (typeof ui !== 'undefined' && ui.updateAuthDisplayGis) {
                    ui.updateAuthDisplayGis(false); // Ensure authorize button is visible
                }
            }
        } else { ui.displaySetupFeedback("Please enter a valid Google Sheet ID.", false); }
    },

    handleApiError: function(error, contextMessage) {
        console.error(`MAIN.JS: API Error in ${contextMessage}:`, error);
        let userMessage = `Error: ${contextMessage}.`;
        if (error.result && error.result.error) {
            userMessage += ` Details: ${error.result.error.message || error.result.error.status}`;
            if (error.result.error.code === 401 || error.result.error.code === 403) {
                userMessage += " Your session might have expired or permissions changed. Please try re-authorizing.";
                if (typeof auth !== 'undefined' && auth.revokeAccessToken) {
                    auth.revokeAccessToken(); // This will trigger onAuthSignOut
                }
                return; // Stop further processing for this error if auth related
            }
        } else if (error.message) {
            userMessage += ` Details: ${error.message}`;
        } else {
            userMessage += ' An unknown error occurred.';
        }
        if (typeof ui !== 'undefined' && ui.displayError) ui.displayError(userMessage);
        if (typeof ui !== 'undefined' && ui.showLoading) ui.showLoading(false); // Ensure loading is off
    },

    loadInitialAppData: async function() {
        if (!appState.isAuthenticated || !appState.currentSpreadsheetId || !appState.isGapiClientReady) {
            console.warn("MAIN.JS: loadInitialAppData called prematurely or with incorrect state:",
                { auth: appState.isAuthenticated, sheetId: !!appState.currentSpreadsheetId, gapiReady: appState.isGapiClientReady });
            if (typeof ui !== 'undefined') {
                 let message = "Cannot load data: ";
                if (!appState.isAuthenticated) message += "Not authorized. ";
                if (!appState.currentSpreadsheetId) message += "Sheet ID missing. ";
                if (!appState.isGapiClientReady) message += "Sheets API not ready. ";
                ui.displayError(message.trim() + "Please try authorizing or setting up again.");
                if (!appState.isAuthenticated || !appState.currentSpreadsheetId) ui.showView('parentSetupView');
                 ui.showLoading(false);
            }
            this.dataLoadingInitiated = false; // Reset flag if we bail early
            return;
        }

        if (this.dataLoadingInitiated && appState.childrenList.length > 0) { // Avoid re-fetch if already loaded this session
            console.log("MAIN.JS: loadInitialAppData: Data already loaded or in progress, skipping re-fetch of children list.");
            if (typeof ui !== 'undefined' && ui.showLoading) ui.showLoading(false);
            return;
        }
        this.dataLoadingInitiated = true;

        if (typeof ui !== 'undefined') { ui.showLoading(true); ui.clearError(); }

        try {
            if (!gapi || !gapi.client || typeof gapi.client.getToken !== 'function' || !gapi.client.getToken()) {
                this.handleApiError({message: "GAPI client not ready or token missing"}, "loading initial app data");
                if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
                this.dataLoadingInitiated = false;
                return;
            }
            console.log("MAIN.JS: Loading children list (sheet tabs) for Sheet ID:", appState.currentSpreadsheetId);
            appState.childrenList = await sheetsService.getSpreadsheetTabs(appState.currentSpreadsheetId);

            if (appState.childrenList && appState.childrenList.length > 0) {
                if (typeof ui !== 'undefined' && ui.renderChildTabs) {
                    ui.renderChildTabs(appState.childrenList, appState.childrenList[0], this.selectChild.bind(this));
                }
                await this.selectChild(appState.childrenList[0]);
            } else {
                 if (typeof ui !== 'undefined') {
                    ui.displayError("No child tabs (sheets) found in the spreadsheet. Please create a sheet for each child.");
                    if (ui.elements && ui.elements.childTabsContainer) ui.elements.childTabsContainer.innerHTML = '';
                    if (ui.elements && ui.elements.choreList) ui.elements.choreList.innerHTML = '<li>No children configured in the Sheet.</li>';
                     ui.showLoading(false); // Ensure loading is off if no children
                }
                 this.dataLoadingInitiated = false; // No data to load further
            }
        } catch (error) {
            this.handleApiError(error, "loading children list");
            this.dataLoadingInitiated = false;
        }
        // showLoading(false) is typically handled by selectChild or the error handlers.
    },

    selectChild: async function(childName) {
        if (!appState.isAuthenticated || !appState.currentSpreadsheetId || !appState.isGapiClientReady) {
            if (typeof ui !== 'undefined') ui.displayError("Cannot select child: App not ready or not authenticated.");
            return;
        }
        appState.currentChildName = childName;
        console.log("MAIN.JS: Selecting child:", childName, "with Sheet ID:", appState.currentSpreadsheetId);

        if (typeof ui !== 'undefined') {
            ui.showLoading(true);
            ui.clearError();
            if (ui.renderChildTabs) ui.renderChildTabs(appState.childrenList, childName, this.selectChild.bind(this));
        }

        try {
            if (!gapi || !gapi.client || typeof gapi.client.getToken !== 'function' || !gapi.client.getToken()) {
                this.handleApiError({message: "GAPI client not ready or token missing"}, `loading data for ${childName}`);
                if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
                return; // Exit early if token is an issue
            }

            const data = await sheetsService.getChoresAndStatuses(
                appState.currentSpreadsheetId,
                childName,
                appState.todayString,
                appState.yesterdayString
            );

            appState.choreNames = data.chores.map(c => c.name);
            appState.currentStatuses = data.statuses;
            appState.allowanceResetDate = data.allowanceResetDate;
            appState.currentAllowanceCount = data.calculatedAllowanceCount;
            appState.todayRowIndex = data.todayRowIndex;
            appState.yesterdayRowIndex = data.yesterdayRowIndex;
            appState.choreNameToColLetter = data.choreNameToColLetter;
            console.log("MAIN.JS: Data for child loaded into appState:", appState);

            if (typeof ui !== 'undefined') {
                ui.updateChildSpecificInfo(childName, appState.currentAllowanceCount, CHORE_VALUE);
                ui.renderChoreList(
                    appState.choreNames,
                    appState.currentStatuses,
                    appState.todayString,
                    appState.yesterdayString,
                    this.handleCheckboxChange.bind(this)
                );
            }
        } catch (error) {
            this.handleApiError(error, `loading chores for ${childName}`);
            if (typeof ui !== 'undefined' && ui.elements && ui.elements.choreList) ui.elements.choreList.innerHTML = '<li>Could not load chores for this child.</li>';
        } finally {
            if (typeof ui !== 'undefined') ui.showLoading(false);
        }
    },

    handleCheckboxChange: async function(event) {
        if (typeof ui === 'undefined' || !appState.isAuthenticated || !appState.currentSpreadsheetId || !appState.isGapiClientReady) {
            console.warn("MAIN.JS: Cannot handle checkbox change: App not ready or not authed.");
            if(event && event.target) event.target.checked = !event.target.checked; // Revert
            return;
        }

        const checkbox = event.target;
        const choreName = checkbox.dataset.choreName;
        const day = checkbox.dataset.day;
        const isDone = checkbox.checked;

        if (!choreName) {
            console.error("MAIN.JS: Checkbox change: choreName not found in dataset.", checkbox);
            return;
        }

        const oneBasedRowIndex = (day === 'yesterday') ? appState.yesterdayRowIndex : appState.todayRowIndex;
        const choreColumnLetter = appState.choreNameToColLetter[choreName];

        console.log(`MAIN.JS: Checkbox change for ${choreName}, day: ${day}, new status: ${isDone}, row: ${oneBasedRowIndex}, col: ${choreColumnLetter}`);

        if (!oneBasedRowIndex || !choreColumnLetter) {
            if (typeof ui !== 'undefined') ui.displayError(`Cannot save change: Missing row/column info for '${choreName}' on ${day}. Row: ${oneBasedRowIndex}, Col: ${choreColumnLetter}`);
            checkbox.checked = !isDone;
            return;
        }

        // Store old status for potential revert and for allowance calculation delta
        const oldStatusValue = appState.currentStatuses[day] ? (appState.currentStatuses[day][choreName] || '') : '';

        // Optimistic UI update for local state and visual style
        if (!appState.currentStatuses[day]) appState.currentStatuses[day] = {};
        appState.currentStatuses[day][choreName] = isDone ? 'x' : '';

        if (typeof ui !== 'undefined' && typeof ui._updateChoreRowStyle === 'function') {
            const yesterdayDone = appState.currentStatuses.yesterday ? (appState.currentStatuses.yesterday[choreName] === 'x') : false;
            const todayDone = appState.currentStatuses.today ? (appState.currentStatuses.today[choreName] === 'x') : false;
            ui._updateChoreRowStyle(checkbox.closest('li'), choreName, yesterdayDone, todayDone);
        }

        try {
            if (!gapi || !gapi.client || typeof gapi.client.getToken !== 'function' || !gapi.client.getToken()) {
                this.handleApiError({message: "GAPI client not ready or token missing"}, `saving change for '${choreName}'`);
                if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
                // Revert optimistic UI update
                appState.currentStatuses[day][choreName] = oldStatusValue;
                checkbox.checked = (oldStatusValue === 'x');
                if (typeof ui !== 'undefined' && typeof ui._updateChoreRowStyle === 'function') {
                     ui._updateChoreRowStyle(checkbox.closest('li'), choreName, appState.currentStatuses.yesterday[choreName] === 'x', appState.currentStatuses.today[choreName] === 'x');
                }
                return;
            }
            await sheetsService.updateChoreStatus(
                appState.currentSpreadsheetId,
                appState.currentChildName,
                oneBasedRowIndex,
                choreColumnLetter,
                isDone
            );
            console.log(`MAIN.JS: Chore '${choreName}' (${day}) status updated to: ${isDone} in sheet.`);

            // Recalculate allowance count after successful save
            // This is simpler than delta calculation for now, though less efficient.
            // A more optimized way would be to adjust based on oldStatusValue vs isDone.
            const newAllowanceData = await sheetsService.getChoresAndStatuses(
                appState.currentSpreadsheetId,
                appState.currentChildName,
                appState.todayString,
                appState.yesterdayString
            ); // This re-fetches everything including calculated count.

            appState.currentAllowanceCount = newAllowanceData.calculatedAllowanceCount;
            // Also update statuses from this fresh fetch to ensure consistency,
            // especially if multiple changes happened quickly.
            appState.currentStatuses = newAllowanceData.statuses;

            if (typeof ui !== 'undefined') ui.updateChildSpecificInfo(appState.currentChildName, appState.currentAllowanceCount, CHORE_VALUE);


        } catch (error) {
            this.handleApiError(error, `saving change for '${choreName}'`);
            // Revert optimistic UI update
            appState.currentStatuses[day][choreName] = oldStatusValue;
            checkbox.checked = (oldStatusValue === 'x');
            if (typeof ui !== 'undefined' && typeof ui._updateChoreRowStyle === 'function') {
                const revertedYesterdayDone = appState.currentStatuses.yesterday[choreName] === 'x';
                const revertedTodayDone = appState.currentStatuses.today[choreName] === 'x';
                ui._updateChoreRowStyle(checkbox.closest('li'), choreName, revertedYesterdayDone, revertedTodayDone);
            }
        }
    }
};

window.main = main;

document.addEventListener('DOMContentLoaded', () => {
    main.init();
});