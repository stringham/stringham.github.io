// ui.js

// Cache DOM elements that are frequently accessed
const elements = {
    appContainer: document.getElementById('appContainer'),
    parentSetupView: document.getElementById('parentSetupView'),
    mainAppView: document.getElementById('mainAppView'),
    sheetIdInput: document.getElementById('sheetIdInput'),
    authorizeButton: document.getElementById('authorizeGisButton'), // Ensure this ID matches your HTML
    saveSheetIdButton: document.getElementById('saveSheetIdButton'),
    signoutButton: document.getElementById('signoutGisButton'),     // Ensure this ID matches your HTML
    setupFeedback: document.getElementById('setupFeedback'),
    childTabsContainer: document.getElementById('childTabsContainer'),
    currentChildTitle: document.getElementById('currentChildTitle'),
    allowanceInfo: document.getElementById('allowanceInfo'),
    choreDisplayArea: document.getElementById('choreDisplayArea'),
    choreListHeader_Yesterday: document.getElementById('yesterdayHeader'),
    choreListHeader_Today: document.getElementById('todayHeader'),
    choreList: document.getElementById('choreList'), // Changed from choreListContainer to choreList for <ul>
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorDisplay: document.getElementById('errorDisplay')
};

/**
 * Shows a specific view and hides others.
 */
function showView(viewId) {
    if (elements.parentSetupView) elements.parentSetupView.style.display = 'none';
    if (elements.mainAppView) elements.mainAppView.style.display = 'none';

    const viewToShow = document.getElementById(viewId);
    if (viewToShow) {
        viewToShow.style.display = 'block';
    } else {
        console.error("showView: View ID not found -", viewId);
    }
}

/**
 * Displays an error message to the user.
 */
function displayError(message) {
    if (elements.errorDisplay) {
        elements.errorDisplay.textContent = message;
        elements.errorDisplay.style.display = message ? 'block' : 'none'; // Show only if message exists
    }
    console.error("UI Error Displayed:", message);
}

/**
 * Clears any currently displayed error message.
 */
function clearError() {
    if (elements.errorDisplay) {
        elements.errorDisplay.textContent = '';
        elements.errorDisplay.style.display = 'none';
    }
}

/**
 * Shows or hides the loading indicator.
 */
function showLoading(isLoading) {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
}

/**
 * Updates the display of authentication-related buttons (for GIS flow).
 */
function updateAuthDisplayGis(isSignedIn) {
    const authorizeGisButton = elements.authorizeButton; // Using cached element
    const signoutGisButton = elements.signoutButton;
    const saveSheetIdButton = elements.saveSheetIdButton;
    const sheetIdInput = elements.sheetIdInput;

    const storedSheetId = localStorage.getItem('spreadsheetId');

    if (isSignedIn) {
        if (authorizeGisButton) authorizeGisButton.style.display = 'none';
        if (signoutGisButton) signoutGisButton.style.display = 'inline-block';

        if (storedSheetId) {
            if (saveSheetIdButton) saveSheetIdButton.style.display = 'none';
            if (sheetIdInput) {
                sheetIdInput.value = storedSheetId;
                sheetIdInput.disabled = true;
            }
        } else {
            if (saveSheetIdButton) saveSheetIdButton.style.display = 'inline-block';
            if (sheetIdInput) {
                sheetIdInput.disabled = false;
                sheetIdInput.placeholder = "Enter Google Sheet ID here";
            }
        }
    } else { // Not signed in
        if (authorizeGisButton) authorizeGisButton.style.display = 'inline-block';
        if (signoutGisButton) signoutGisButton.style.display = 'none';
        if (saveSheetIdButton) saveSheetIdButton.style.display = 'none';

        if (sheetIdInput) {
            sheetIdInput.disabled = false;
            sheetIdInput.value = storedSheetId || '';
        }
    }
}

/**
 * Displays feedback messages on the parent setup screen.
 */
function displaySetupFeedback(message, isSuccess = true) {
    if (elements.setupFeedback) {
        elements.setupFeedback.textContent = message;
        elements.setupFeedback.className = 'feedback-area';
        if (message) { // Only add class if message exists
             elements.setupFeedback.classList.add(isSuccess ? 'success-message' : 'error-message');
             elements.setupFeedback.style.display = 'block';
        } else {
            elements.setupFeedback.style.display = 'none';
        }
    }
}

/**
 * Renders the child selection tabs.
 */
function renderChildTabs(childNamesArray, activeChildName, tabClickHandler) {
    if (!elements.childTabsContainer) return;
    elements.childTabsContainer.innerHTML = ''; // Clear existing tabs
    childNamesArray.forEach(name => {
        const tabButton = document.createElement('button');
        tabButton.className = 'child-tab';
        tabButton.textContent = name;
        tabButton.dataset.childName = name;
        if (name === activeChildName) {
            tabButton.classList.add('active-tab');
        }
        tabButton.addEventListener('click', () => tabClickHandler(name));
        elements.childTabsContainer.appendChild(tabButton);
    });
}

/**
 * Updates the child-specific information area (name and allowance).
 */
function updateChildSpecificInfo(childName, choreCount, choreValueConstant) {
    if (elements.currentChildTitle) elements.currentChildTitle.textContent = `${childName}'s Chores`;
    if (elements.allowanceInfo) {
        const totalValue = (choreCount * choreValueConstant).toFixed(2);
        elements.allowanceInfo.innerHTML = `✨ ${childName}, you've done <strong>${choreCount}</strong> chores (worth <strong>$${totalValue}</strong>)! ✨`;
    }
}

/**
 * Helper to format YYYY-MM-DD date string to "Month Day" (e.g., "June 1").
 */
function _formatDateForDisplay(dateStringYYYYMMDD) {
    if (!dateStringYYYYMMDD || !/^\d{4}-\d{2}-\d{2}$/.test(dateStringYYYYMMDD)) {
        return "Date";
    }
    const date = new Date(dateStringYYYYMMDD + 'T00:00:00Z'); // Treat as UTC to get correct month/day
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Renders the list of chores with their checkboxes.
 * Adapted for new structure where chores are columns (names) and statuses are keyed by chore name.
 * @param {Array<string>} choreNamesArray - Array of chore name strings.
 * @param {Object} statuses - Object with statuses { yesterday: {choreName: 'x'}, today: {choreName: 'x'} }.
 * @param {string} todayStr - Today's date ("YYYY-MM-DD").
 * @param {string} yesterdayStr - Yesterday's date ("YYYY-MM-DD").
 * @param {Function} checkboxChangeHandler - Callback for when a checkbox changes.
 */
function renderChoreList(choreNamesArray, statuses, todayStr, yesterdayStr, checkboxChangeHandler) {
    if (!elements.choreList) return;
    elements.choreList.innerHTML = ''; // Clear existing list

    if (elements.choreListHeader_Yesterday) {
        elements.choreListHeader_Yesterday.textContent = `Yesterday (${_formatDateForDisplay(yesterdayStr)})`;
    }
    if (elements.choreListHeader_Today) {
        elements.choreListHeader_Today.textContent = `Today (${_formatDateForDisplay(todayStr)})`;
    }

    if (!choreNamesArray || choreNamesArray.length === 0) {
        const li = document.createElement('li');
        li.textContent = "No chores have been set up for this child yet.";
        li.style.textAlign = 'center';
        li.style.padding = '20px';
        li.className = 'chore-item'; // Keep consistent class for styling
        elements.choreList.appendChild(li);
        return;
    }

    choreNamesArray.forEach(choreName => {
        const li = document.createElement('li');
        li.className = 'chore-item';
        // Add a data attribute for the chore name to the <li> for easier style targeting if needed
        li.dataset.choreNameIdentifier = choreName.replace(/\s+/g, '-').toLowerCase();


        const nameSpan = document.createElement('span');
        nameSpan.className = 'chore-name';
        nameSpan.textContent = choreName;

        const yesterdayCell = document.createElement('span');
        yesterdayCell.className = 'chore-checkbox-cell';
        const yesterdayCheckbox = document.createElement('input');
        yesterdayCheckbox.type = 'checkbox';
        yesterdayCheckbox.dataset.day = 'yesterday';
        yesterdayCheckbox.dataset.choreName = choreName; // Use choreName
        yesterdayCheckbox.checked = statuses.yesterday && statuses.yesterday[choreName] === 'x';
        yesterdayCheckbox.setAttribute('aria-label', `${choreName} yesterday`);
        yesterdayCheckbox.addEventListener('change', checkboxChangeHandler);
        yesterdayCell.appendChild(yesterdayCheckbox);

        const todayCell = document.createElement('span');
        todayCell.className = 'chore-checkbox-cell';
        const todayCheckbox = document.createElement('input');
        todayCheckbox.type = 'checkbox';
        todayCheckbox.dataset.day = 'today';
        todayCheckbox.dataset.choreName = choreName; // Use choreName
        todayCheckbox.checked = statuses.today && statuses.today[choreName] === 'x';
        todayCheckbox.setAttribute('aria-label', `${choreName} today`);
        todayCheckbox.addEventListener('change', checkboxChangeHandler);
        todayCell.appendChild(todayCheckbox);

        li.appendChild(nameSpan);
        li.appendChild(yesterdayCell);
        li.appendChild(todayCell);
        elements.choreList.appendChild(li);

        _updateChoreRowStyle(li, choreName, yesterdayCheckbox.checked, todayCheckbox.checked);
    });
}

/**
 * Toggles the visual style of a chore item (e.g., strikethrough) based on completion.
 * @param {HTMLLIElement} choreLiElement - The <li> element for the chore.
 * @param {string} choreName - The name of the chore (not strictly needed if only styling nameSpan).
 * @param {boolean} isYesterdayDone - If the chore for yesterday is done.
 * @param {boolean} isTodayDone - If the chore for today is done.
 */
function _updateChoreRowStyle(choreLiElement, choreName, isYesterdayDone, isTodayDone) {
    if (!choreLiElement) return;
    const nameSpan = choreLiElement.querySelector('.chore-name');
    if (nameSpan) {
        // Example: strikethrough if either day is done for that chore.
        // Or you might want to style based on only today's completion for the main visual.
        if (isTodayDone || isYesterdayDone) { // You can customize this condition
            nameSpan.classList.add('completed');
        } else {
            nameSpan.classList.remove('completed');
        }
    }
}


// Expose public functions
const ui = {
    elements,
    showView,
    displayError,
    clearError,
    showLoading,
    updateAuthDisplayGis, // Using the GIS specific one now
    displaySetupFeedback,
    renderChildTabs,
    updateChildSpecificInfo,
    renderChoreList,
    _updateChoreRowStyle // Expose if main.js needs to call it directly after successful update
};