// parent/parent.js

// App state specific to the parent page
const parentAppState = {
    spreadsheetId: null,
    isAuthenticated: false, // True when GIS token is successfully obtained/resumed
    isGisReady: false,      // True when GIS library is loaded and its client part in auth.js is init
    isGapiClientReady: false, // True when GAPI client library is loaded and Sheets API part in auth.js is init
    children: [], // Array of child names
    selectedChild: null,
    currentChores: [], // Array of chore description strings for selected child
    currentAllowanceCount: 0
};

// DOM Elements
const parentElements = {
    authSection: document.getElementById('authSection'),
    parentAuthorizeButton: document.getElementById('parentAuthorizeButton'),
    parentSignoutButton: document.getElementById('parentSignoutButton'),
    parentAuthFeedback: document.getElementById('parentAuthFeedback'),
    parentSheetIdInput: document.getElementById('parentSheetIdInput'),
    parentSaveSheetIdButton: document.getElementById('parentSaveSheetIdButton'),

    parentMainContent: document.getElementById('parentMainContent'),
    childSelector: document.getElementById('childSelector'),
    childConfigurationArea: document.getElementById('childConfigurationArea'),
    selectedChildNameDisplay: document.getElementById('selectedChildNameDisplay'),

    choreListEditor: document.getElementById('choreListEditor'),
    newChoreInput: document.getElementById('newChoreInput'),
    addChoreButton: document.getElementById('addChoreButton'),
    saveChoreListButton: document.getElementById('saveChoreListButton'),
    choreMgmtFeedback: document.getElementById('choreMgmtFeedback'),

    currentAllowanceCountDisplay: document.getElementById('currentAllowanceCountDisplay'),
    currentAllowanceValueDisplay: document.getElementById('currentAllowanceValueDisplay'),
    resetAllowanceButton: document.getElementById('resetAllowanceButton'),
    allowanceMgmtFeedback: document.getElementById('allowanceMgmtFeedback'),

    loadingIndicator: document.getElementById('parentLoadingIndicator'),
    errorDisplay: document.getElementById('parentErrorDisplay')
};

const parentApp = {
    init: function() {
        console.log("Parent app initializing...");
        parentAppState.spreadsheetId = localStorage.getItem('spreadsheetId'); // Try to load shared ID
        if (parentElements.parentSheetIdInput) {
            parentElements.parentSheetIdInput.value = parentAppState.spreadsheetId || '';
        }

        this.initEventListeners();

        if (typeof auth !== 'undefined' && auth.initializeAuthSystem) {
            auth.initializeAuthSystem({
                onSuccess: this.onAuthSuccess.bind(this),
                onError: this.onAuthError.bind(this),
                onSignOut: this.onAuthSignOut.bind(this)
            });
            console.log("Parent Auth system callbacks configured.");
        } else {
            this.displayError("CRITICAL: Authentication module (auth.js) not found or not correctly loaded.");
            return;
        }
        this.showLoading(true);
        // GIS and GAPI client loading are triggered by their onload attributes in parent/index.html,
        // which then call parentApp.onGisLoad and parentApp.onGapiClientLoad.
    },

    onGisLoad: function() {
        console.log("parentApp.onGisLoad executed.");
        if (typeof auth !== 'undefined' && auth.initializeGis) {
            auth.initializeGis()
                .then(() => {
                    parentAppState.isGisReady = true;
                    console.log("Parent GIS Token Client part of Auth initialized.");
                    this.checkApiReadinessAndProceed();
                })
                .catch(err => {
                    this.displayError("Failed to initialize Parent Google Sign-In.");
                    console.error("GIS init error from parentApp.onGisLoad:", err);
                    this.showLoading(false);
                });
        } else {
            this.displayError("Authentication module (auth.js) or initializeGis not found.");
        }
    },

    onGapiClientLoad: function() {
        console.log("parentApp.onGapiClientLoad executed.");
        if (typeof auth !== 'undefined' && auth.initializeGapiClient) {
            auth.initializeGapiClient()
                .then(() => {
                    parentAppState.isGapiClientReady = true;
                    console.log("Parent GAPI Client (for Sheets) part of Auth initialized.");
                    this.checkApiReadinessAndProceed();
                })
                .catch(err => {
                    this.displayError("Failed to initialize Parent Google Sheets access.");
                    console.error("GAPI client init error from parentApp.onGapiClientLoad:", err);
                    this.showLoading(false);
                });
        } else {
            this.displayError("Authentication module (auth.js) or initializeGapiClient not found.");
        }
    },

    checkApiReadinessAndProceed: function() {
        if (parentAppState.isGisReady && parentAppState.isGapiClientReady) {
            console.log("Parent: Both GIS and GAPI Client are now ready.");
            const isSignedIn = auth.isUserSignedInGis(); // This reflects current token state in auth.js
            // parentAppState.isAuthenticated should have been set by onAuthSuccess/onAuthSignOut

            this.updateAuthDisplay(parentAppState.isAuthenticated);

            if (parentAppState.isAuthenticated) {
                if (parentAppState.spreadsheetId) {
                    console.log("Parent: Authenticated and Sheet ID known. Showing main content and loading children list.");
                    parentElements.parentMainContent.style.display = 'block';
                    this.loadChildrenList(); // This will turn off its own loading indicator
                } else {
                    console.log("Parent: Authenticated, but no Sheet ID. Prompting for Sheet ID.");
                    this.displayAuthFeedback("Authorized! Please enter and save your Google Sheet ID.", true);
                    if (parentElements.parentSheetIdInput) parentElements.parentSheetIdInput.focus();
                    this.showLoading(false); // Turn off general loading
                }
            } else {
                // Not authenticated
                console.log("Parent: Not authenticated. Waiting for user to authorize.");
                this.displayAuthFeedback("Please authorize and set your Google Sheet ID to manage chores.", false);
                this.showLoading(false);
            }
        } else {
            console.log("Parent: APIs not fully ready yet (GIS Ready: " + parentAppState.isGisReady + ", GAPI Client Ready: " + parentAppState.isGapiClientReady + ")");
        }
    },

    initEventListeners: function() {
        parentElements.parentAuthorizeButton.addEventListener('click', () => {
             if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
        });
        parentElements.parentSignoutButton.addEventListener('click', () => {
            if (typeof auth !== 'undefined' && auth.revokeAccessToken) auth.revokeAccessToken();
        });
        parentElements.parentSaveSheetIdButton.addEventListener('click', this.handleSaveSheetId.bind(this));
        parentElements.childSelector.addEventListener('change', this.handleChildSelection.bind(this));
        parentElements.addChoreButton.addEventListener('click', this.handleAddChoreToList.bind(this));
        parentElements.saveChoreListButton.addEventListener('click', this.handleSaveChoresToSheet.bind(this));
        parentElements.resetAllowanceButton.addEventListener('click', this.handleResetAllowance.bind(this));

        parentElements.choreListEditor.addEventListener('click', (event) => {
            if (event.target.classList.contains('edit-chore-btn')) {
                this.toggleChoreEditMode(event.target.closest('li'), true);
            } else if (event.target.classList.contains('save-edit-chore-btn')) {
                this.saveChoreEdit(event.target.closest('li'));
            } else if (event.target.classList.contains('cancel-edit-chore-btn')) {
                this.toggleChoreEditMode(event.target.closest('li'), false);
            } else if (event.target.classList.contains('delete-chore-btn')) {
                this.handleDeleteChoreFromList(event.target.closest('li'));
            }
        });
    },

    updateAuthDisplay: function(isSignedIn) {
        if (isSignedIn) {
            parentElements.parentAuthorizeButton.style.display = 'none';
            parentElements.parentSignoutButton.style.display = 'inline-block';
            parentElements.parentSaveSheetIdButton.style.display = parentAppState.spreadsheetId ? 'none' : 'inline-block';
            parentElements.parentSheetIdInput.disabled = !!parentAppState.spreadsheetId;
            if (parentAppState.spreadsheetId) { // If sheet ID known and signed in, show main content area
                parentElements.parentMainContent.style.display = 'block';
            }
        } else {
            parentElements.parentAuthorizeButton.style.display = 'inline-block';
            parentElements.parentSignoutButton.style.display = 'none';
            parentElements.parentSaveSheetIdButton.style.display = 'none';
            parentElements.parentSheetIdInput.disabled = false;
            parentElements.parentMainContent.style.display = 'none';
        }
    },

    displayAuthFeedback: function(message, isSuccess = true) {
        parentElements.parentAuthFeedback.textContent = message;
        parentElements.parentAuthFeedback.className = 'feedback-area ' + (isSuccess ? 'success-message' : 'error-message');
        parentElements.parentAuthFeedback.style.display = 'block';
        setTimeout(() => { if(parentElements.parentAuthFeedback) parentElements.parentAuthFeedback.style.display = 'none'; }, 5000);
    },

    onAuthSuccess: function(tokenResponse) {
        console.log("Parent Auth Success:", tokenResponse);
        parentAppState.isAuthenticated = true;
        this.displayAuthFeedback("Successfully authorized with Google!", true);
        // this.updateAuthDisplay(true); // Called by checkApiReadinessAndProceed
        this.checkApiReadinessAndProceed(); // Re-check conditions now that auth is successful
    },

    onAuthError: function(errorMessage) {
        console.error("Parent Auth Error:", errorMessage);
        parentAppState.isAuthenticated = false;
        this.updateAuthDisplay(false);
        this.displayError(`Authorization Failed: ${errorMessage}`);
        this.showLoading(false);
    },

    onAuthSignOut: function() {
        console.log("Parent Signed Out.");
        parentAppState.isAuthenticated = false;
        parentAppState.selectedChild = null;
        parentAppState.children = [];
        parentAppState.currentChores = [];
        parentAppState.currentAllowanceCount = 0;

        this.updateAuthDisplay(false);
        parentElements.parentMainContent.style.display = 'none';
        parentElements.childConfigurationArea.style.display = 'none';
        if (parentElements.childSelector) parentElements.childSelector.innerHTML = '<option value="">-- Select Child --</option>';
        if (parentElements.choreListEditor) parentElements.choreListEditor.innerHTML = '';

        this.displayAuthFeedback("You have been signed out.", false);
        this.showLoading(false);
    },

    handleSaveSheetId: function() {
        const sheetId = parentElements.parentSheetIdInput.value.trim();
        if (sheetId) {
             if (sheetId.length < 30 || sheetId.includes(" ") || !/^[a-zA-Z0-9-_]+$/.test(sheetId)) {
                this.displayAuthFeedback("Invalid Google Sheet ID format.", false); return;
            }
            parentAppState.spreadsheetId = sheetId;
            localStorage.setItem('spreadsheetId', sheetId); // Shared with kids' app
            this.displayAuthFeedback("Sheet ID saved!", true);
            parentElements.parentSheetIdInput.disabled = true;
            parentElements.parentSaveSheetIdButton.style.display = 'none';
            if (parentAppState.isAuthenticated) { // If already authed, now load children
                parentElements.parentMainContent.style.display = 'block';
                this.loadChildrenList();
            } else {
                this.displayAuthFeedback("Sheet ID saved! Please authorize to continue.", false);
            }
        } else {
            this.displayAuthFeedback("Please enter a valid Sheet ID.", false);
        }
    },

    loadChildrenList: async function() {
        if (!parentAppState.spreadsheetId || !parentAppState.isAuthenticated || !parentAppState.isGapiClientReady) {
            this.displayError("Cannot load children list: App not ready or not authorized.");
            console.warn("loadChildrenList pre-condition fail:", parentAppState);
            return;
        }
        this.showLoading(true);
        try {
            if (!gapi || !gapi.client || typeof gapi.client.getToken !== 'function' || !gapi.client.getToken()) {
                this.handleApiError({message: "GAPI client not ready or token missing for loadChildrenList"}, "loading children list");
                if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
                return;
            }
            console.log("Parent: Attempting to load children (sheet tabs) with ID:", parentAppState.spreadsheetId);
            const tabs = await sheetsService.getSpreadsheetTabs(parentAppState.spreadsheetId);
            parentAppState.children = tabs.map(name => ({ name })); // Store as objects if needed, or just names

            parentElements.childSelector.innerHTML = '<option value="">-- Select Child --</option>';
            tabs.forEach(childName => {
                const option = document.createElement('option');
                option.value = childName;
                option.textContent = childName;
                parentElements.childSelector.appendChild(option);
            });
            console.log("Parent: Children list loaded.", tabs);
            parentElements.childConfigurationArea.style.display = 'none'; // Hide until child selected
        } catch (error) {
            this.handleApiError(error, "loading children list");
        } finally {
            this.showLoading(false);
        }
    },

    handleChildSelection: async function(event) {
        parentAppState.selectedChild = event.target.value;
        if (!parentAppState.selectedChild) {
            parentElements.childConfigurationArea.style.display = 'none';
            return;
        }

        if (!parentAppState.isAuthenticated || !parentAppState.isGapiClientReady) {
            this.displayError("Please authorize and ensure API is ready before selecting a child.");
            return;
        }
        console.log("Selected child for config:", parentAppState.selectedChild);
        parentElements.selectedChildNameDisplay.textContent = `Configuring for: ${parentAppState.selectedChild}`;
        parentElements.childConfigurationArea.style.display = 'block';
        document.querySelectorAll('.dynamic-child-name').forEach(el => el.textContent = parentAppState.selectedChild);

        this.showLoading(true);
        try {
            if (!gapi || !gapi.client || typeof gapi.client.getToken !== 'function' || !gapi.client.getToken()) {
                this.handleApiError({message: "GAPI client not ready or token missing for handleChildSelection"}, `loading data for ${parentAppState.selectedChild}`);
                if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
                return;
            }
            // Fetch chores (only descriptions needed for parent editor)
            const choreData = await sheetsService.getChoresAndStatuses(parentAppState.spreadsheetId, parentAppState.selectedChild, "", ""); // Dates not strictly needed for chore list editing
            parentAppState.currentChores = choreData.chores.map(c => c.description); // Store as array of strings
            this.renderChoreEditor();

            parentAppState.currentAllowanceCount = await sheetsService.getAllowanceCount(parentAppState.spreadsheetId, parentAppState.selectedChild);
            this.updateAllowanceDisplay();

        } catch (error) {
            this.handleApiError(error, `loading data for ${parentAppState.selectedChild}`);
            parentElements.childConfigurationArea.style.display = 'none';
        } finally {
            this.showLoading(false);
        }
    },

    renderChoreEditor: function() {
        parentElements.choreListEditor.innerHTML = '';
        if (!parentAppState.currentChores) return;

        parentAppState.currentChores.forEach((choreDesc, index) => {
            const li = document.createElement('li');
            li.dataset.index = index; // Store original index for easy update/delete

            const textSpan = document.createElement('span');
            textSpan.className = 'chore-text-display';
            textSpan.textContent = choreDesc;

            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.value = choreDesc;
            editInput.className = 'edit-chore-input';
            editInput.style.display = 'none';

            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'edit-chore-btn action-btn';

            const saveButton = document.createElement('button');
            saveButton.textContent = 'Save';
            saveButton.className = 'save-edit-chore-btn action-btn';
            saveButton.style.display = 'none';

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.className = 'cancel-edit-chore-btn action-btn secondary-btn';
            cancelButton.style.display = 'none';

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'delete-chore-btn action-btn destructive-btn';

            li.appendChild(textSpan);
            li.appendChild(editInput);
            li.appendChild(editButton);
            li.appendChild(saveButton);
            li.appendChild(cancelButton);
            li.appendChild(deleteButton);
            parentElements.choreListEditor.appendChild(li);
        });
    },

    toggleChoreEditMode: function(listItem, isEditing) {
        const textSpan = listItem.querySelector('.chore-text-display');
        const editInput = listItem.querySelector('.edit-chore-input');
        const editButton = listItem.querySelector('.edit-chore-btn');
        const saveButton = listItem.querySelector('.save-edit-chore-btn');
        const cancelButton = listItem.querySelector('.cancel-edit-chore-btn');
        const deleteButton = listItem.querySelector('.delete-chore-btn');

        textSpan.style.display = isEditing ? 'none' : 'inline';
        editInput.style.display = isEditing ? 'inline-block' : 'none';
        saveButton.style.display = isEditing ? 'inline-block' : 'none';
        cancelButton.style.display = isEditing ? 'inline-block' : 'none';

        editButton.style.display = isEditing ? 'none' : 'inline-block';
        // Keep delete button visible unless actively editing and want to hide it
        deleteButton.style.display = isEditing ? 'none' : 'inline-block';

        if (isEditing) {
            editInput.value = textSpan.textContent; // Ensure current value is in input
            editInput.focus();
        }
    },

    saveChoreEdit: function(listItem) {
        const index = parseInt(listItem.dataset.index);
        const editInput = listItem.querySelector('.edit-chore-input');
        const newDescription = editInput.value.trim();

        if (newDescription && index >= 0 && index < parentAppState.currentChores.length) {
            parentAppState.currentChores[index] = newDescription;
            // No need to re-render entire list, just update the text span for this item
            listItem.querySelector('.chore-text-display').textContent = newDescription;
            this.displayChoreMgmtFeedback("Chore updated in list. Save all changes to persist.", true);
        } else if (!newDescription) {
            this.displayChoreMgmtFeedback("Chore description cannot be empty.", false);
            editInput.value = parentAppState.currentChores[index]; // Revert input to old value
        }
        this.toggleChoreEditMode(listItem, false);
    },

    handleAddChoreToList: function() {
        const description = parentElements.newChoreInput.value.trim();
        if (description && parentAppState.selectedChild) {
            parentAppState.currentChores.push(description);
            this.renderChoreEditor(); // Re-render the list to include the new chore
            parentElements.newChoreInput.value = '';
            this.displayChoreMgmtFeedback("Chore added to list. Don't forget to 'Save All Chore Changes'.", true);
        } else if (!parentAppState.selectedChild) {
             this.displayChoreMgmtFeedback("Please select a child first.", false);
        } else {
            this.displayChoreMgmtFeedback("Please enter a chore description.", false);
        }
    },

    handleDeleteChoreFromList: function(listItem) {
        const index = parseInt(listItem.dataset.index);
        if (index >= 0 && index < parentAppState.currentChores.length) {
            parentAppState.currentChores.splice(index, 1);
            this.renderChoreEditor(); // Re-render
            this.displayChoreMgmtFeedback("Chore removed from list. Don't forget to 'Save All Chore Changes'.", true);
        }
    },

    handleSaveChoresToSheet: async function() {
        if (!parentAppState.selectedChild || !parentAppState.spreadsheetId || !parentAppState.isAuthenticated || !parentAppState.isGapiClientReady) {
            this.displayChoreMgmtFeedback("Cannot save: No child selected, Sheet ID not set, or not authorized.", false);
            return;
        }
        this.showLoading(true);
        this.displayChoreMgmtFeedback("Saving chores...", true);
        try {
            if (!gapi || !gapi.client || typeof gapi.client.getToken !== 'function' || !gapi.client.getToken()) {
                this.handleApiError({message: "GAPI client not ready or token missing for saveChores"}, "saving chores");
                if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
                return;
            }
            await sheetsService.updateChoreDescriptions(
                parentAppState.spreadsheetId,
                parentAppState.selectedChild,
                parentAppState.currentChores // This is an array of strings
            );
            this.displayChoreMgmtFeedback("Chores saved successfully to Google Sheet!", true);
        } catch (error) {
            this.handleApiError(error, `saving chores for ${parentAppState.selectedChild}`);
            this.displayChoreMgmtFeedback("Failed to save chores to Google Sheet.", false);
        } finally {
            this.showLoading(false);
        }
    },

    updateAllowanceDisplay: function() {
        parentElements.currentAllowanceCountDisplay.textContent = parentAppState.currentAllowanceCount;
        const value = (parentAppState.currentAllowanceCount * CHORE_VALUE).toFixed(2); // CHORE_VALUE from config.js
        parentElements.currentAllowanceValueDisplay.textContent = `$${value}`;
    },

    handleResetAllowance: async function() {
        if (!parentAppState.selectedChild || !parentAppState.spreadsheetId || !parentAppState.isAuthenticated || !parentAppState.isGapiClientReady) {
            this.displayAllowanceMgmtFeedback("Please select a child and ensure you are authorized.", false);
            return;
        }

        if (!confirm(`Are you sure you want to reset allowance chores for ${parentAppState.selectedChild} to 0? This action cannot be undone.`)) {
            return;
        }

        this.showLoading(true);
        this.displayAllowanceMgmtFeedback("Resetting allowance count...", true);
        try {
            if (!gapi || !gapi.client || typeof gapi.client.getToken !== 'function' || !gapi.client.getToken()) {
                this.handleApiError({message: "GAPI client not ready or token missing for resetAllowance"}, "resetting allowance");
                if (typeof auth !== 'undefined' && auth.requestAccessToken) auth.requestAccessToken();
                return;
            }
            await sheetsService.updateAllowanceCount(
                parentAppState.spreadsheetId,
                parentAppState.selectedChild,
                0 // Reset to zero
            );
            parentAppState.currentAllowanceCount = 0;
            this.updateAllowanceDisplay();
            this.displayAllowanceMgmtFeedback("Allowance count reset to 0 successfully!", true);
        } catch (error) {
            this.handleApiError(error, `resetting allowance for ${parentAppState.selectedChild}`);
            this.displayAllowanceMgmtFeedback("Failed to reset allowance count.", false);
        } finally {
            this.showLoading(false);
        }
    },

    displayChoreMgmtFeedback: function(message, isSuccess = true) {
        parentElements.choreMgmtFeedback.textContent = message;
        parentElements.choreMgmtFeedback.className = 'feedback-area ' + (isSuccess ? 'success-message' : 'error-message');
        parentElements.choreMgmtFeedback.style.display = 'block';
        setTimeout(() => { if(parentElements.choreMgmtFeedback) parentElements.choreMgmtFeedback.style.display = 'none'; }, 4000);
    },

    displayAllowanceMgmtFeedback: function(message, isSuccess = true) {
        parentElements.allowanceMgmtFeedback.textContent = message;
        parentElements.allowanceMgmtFeedback.className = 'feedback-area ' + (isSuccess ? 'success-message' : 'error-message');
        parentElements.allowanceMgmtFeedback.style.display = 'block';
        setTimeout(() => { if(parentElements.allowanceMgmtFeedback) parentElements.allowanceMgmtFeedback.style.display = 'none'; }, 4000);
    },

    showLoading: function(isLoading) {
        if (parentElements.loadingIndicator) {
            parentElements.loadingIndicator.style.display = isLoading ? 'block' : 'none';
        }
    },
    displayError: function(message) {
        if (parentElements.errorDisplay) {
            parentElements.errorDisplay.textContent = message;
            parentElements.errorDisplay.style.display = 'block';
        }
        console.error("Parent Page Error:", message);
    },
    handleApiError: function(error, contextMessage) {
        console.error(`API Error in ${contextMessage}:`, error);
        let userMessage = `Error ${contextMessage}.`;
        if (error.result && error.result.error) {
            userMessage += ` Details: ${error.result.error.message || error.result.error.status}`;
            if (error.result.error.code === 401 || error.result.error.code === 403) {
                userMessage += " Your session might have expired or permissions changed. Please try re-authorizing.";
                if (typeof auth !== 'undefined' && auth.revokeAccessToken) auth.revokeAccessToken(); // This will trigger onAuthSignOut
            }
        } else if (error.message) {
            userMessage += ` Details: ${error.message}`;
        } else {
            userMessage += ' An unknown error occurred.';
        }
        this.displayError(userMessage);
        this.showLoading(false); // Ensure loading is hidden on API error
    }
};

window.parentApp = parentApp; // Expose parentApp to global scope for onload callbacks

document.addEventListener('DOMContentLoaded', () => {
    if (window.parentApp && typeof window.parentApp.init === 'function') {
        window.parentApp.init();
    } else {
        console.error("parentApp object or parentApp.init function not found on DOMContentLoaded.");
        // Display a critical error to the user if parentApp is not defined
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = '<div style="padding: 20px; text-align: center; color: red; font-size: 1.2em;">Critical application error: Parent app script did not load correctly. Please check the console.</div>';
        }
    }
});