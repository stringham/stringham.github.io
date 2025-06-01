// sheetsService.js (NEW VERSION - replace existing content with this)

/**
 * Helper function to convert a 0-based column index to a spreadsheet column letter.
 */
function _columnToLetter(column) {
    let temp, letter = '';
    while (column >= 0) {
        temp = column % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        column = Math.floor(column / 26) - 1;
    }
    return letter;
}

/**
 * Helper function to convert a spreadsheet column letter to a 0-based index.
 */
function _letterToColumn(letter) {
    let column = 0, length = letter.length;
    for (let i = 0; i < length; i++) {
        column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
    }
    return column - 1;
}

/**
 * Fetches spreadsheet details, primarily the names of the sheets (tabs).
 */
async function getSpreadsheetTabs(spreadsheetId) {
    try {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            fields: 'sheets.properties.title'
        });
        if (response.result && response.result.sheets && response.result.sheets.length > 0) {
            return response.result.sheets.map(sheet => sheet.properties.title);
        }
        return [];
    } catch (error) {
        console.error("Error fetching spreadsheet tabs:", error);
        throw error;
    }
}

/**
 * Fetches chore names, dates, statuses, and calculates allowance count.
 * Adds missing dates to Column A if needed.
 * New Structure:
 * A1: Last Allowance Paid Date (YYYY-MM-DD)
 * B1, C1, D1... : Chore Names
 * A2, A3, A4... : Dates (YYYY-MM-DD) for tracking
 * B2, C2, D2... : Statuses ('x')
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {string} todayStr (YYYY-MM-DD)
 * @param {string} yesterdayStr (YYYY-MM-DD)
 * @returns {Promise<Object>}
 */
async function getChoresAndStatuses(spreadsheetId, sheetName, todayStr, yesterdayStr) {
    try {
        console.log(`SheetService: Initiating getChoresAndStatuses for ${sheetName}. Today: ${todayStr}, Yesterday: ${yesterdayStr}`);

        // 1. Read A1 for Last Allowance Paid Date
        let allowanceResetDate = '1970-01-01'; // Default
        try {
            const allowanceDateResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!${LAST_ALLOWANCE_PAID_DATE_CELL}`
            });
            if (allowanceDateResponse.result.values && allowanceDateResponse.result.values.length > 0 && allowanceDateResponse.result.values[0][0]) {
                allowanceResetDate = allowanceDateResponse.result.values[0][0];
            }
        } catch (e) {
            console.warn(`SheetService: Could not read allowance reset date from ${LAST_ALLOWANCE_PAID_DATE_CELL}. Defaulting. Error: ${e.message}`);
        }
        console.log(`SheetService: Allowance Reset Date from A1: '${allowanceResetDate}'`);

        // 2. Read Chore Names from Row 1 (B1 onwards)
        const choreHeaderRange = `${sheetName}!B1:1`;
        const choreHeaderResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId, range: choreHeaderRange });
        const choreNames = (choreHeaderResponse.result.values ? choreHeaderResponse.result.values[0] : []).filter(name => name && name.trim() !== '');
        const choreNameToColLetter = {};
        choreNames.forEach((name, index) => { choreNameToColLetter[name] = _columnToLetter(index + 1); });
        console.log(`SheetService: Found ${choreNames.length} chores:`, JSON.stringify(choreNames), "Map:", JSON.stringify(choreNameToColLetter));

        // 3. Read existing dates from Column A (A2 onwards)
        let dateReadRange = `${sheetName}!A2:A`;
        let dateEntriesResponse = await gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: spreadsheetId, range: dateReadRange });
        let dateEntriesInSheet = (dateEntriesResponse.result.values || []).map(row => row[0]).filter(date => date && date.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date));
        console.log(`SheetService: Initial dates in sheet (A2:A):`, JSON.stringify(dateEntriesInSheet));

        // 4. Ensure all dates up to todayStr are present
        const allDatesToEnsurePresent = new Set(dateEntriesInSheet);
        const datesToAdd = []; // Array of arrays, e.g., [['2025-05-31'], ['2025-06-01']]
        const dToday = new Date(todayStr + "T00:00:00Z");

        let lastKnownDateInSheet = null;
        if (dateEntriesInSheet.length > 0) {
            // Assuming dates are mostly ordered; if not, sorting might be needed before picking last.
            // For now, trust the last entry if list is not empty.
            lastKnownDateInSheet = dateEntriesInSheet[dateEntriesInSheet.length - 1];
        }
        console.log(`SheetService: Last known date in sheet (before additions): ${lastKnownDateInSheet}`);

        if (!lastKnownDateInSheet) { // No dates in A2:A yet
            console.log("SheetService: No dates found in A2:A. Preparing to add yesterday and today.");
            // Ensure yesterday is added if it's different from today and not already (somehow) in the empty set
            if (yesterdayStr && yesterdayStr !== todayStr && !allDatesToEnsurePresent.has(yesterdayStr)) {
                datesToAdd.push([yesterdayStr]);
                allDatesToEnsurePresent.add(yesterdayStr);
            }
            // Ensure today is added
            if (todayStr && !allDatesToEnsurePresent.has(todayStr)) {
                datesToAdd.push([todayStr]);
                allDatesToEnsurePresent.add(todayStr);
            }
        } else {
            // Dates exist, fill any gaps from (lastDateInSheet + 1 day) up to todayStr
            let currentDateIterator = new Date(lastKnownDateInSheet + "T00:00:00Z");
            currentDateIterator.setUTCDate(currentDateIterator.getUTCDate() + 1);

            console.log(`SheetService: Filling dates from ${currentDateIterator.toISOString().split('T')[0]} up to ${todayStr}`);
            while (currentDateIterator <= dToday) {
                const dateStringToFill = currentDateIterator.toISOString().split('T')[0];
                if (!allDatesToEnsurePresent.has(dateStringToFill)) {
                    datesToAdd.push([dateStringToFill]);
                    allDatesToEnsurePresent.add(dateStringToFill); // Keep the set updated
                }
                currentDateIterator.setUTCDate(currentDateIterator.getUTCDate() + 1);
            }
        }
        // Sort datesToAdd to ensure they are appended in chronological order
        datesToAdd.sort((a, b) => a[0].localeCompare(b[0]));


        if (datesToAdd.length > 0) {
            console.log(`SheetService: ADDING ${datesToAdd.length} new date(s) to Column A:`, JSON.stringify(datesToAdd.map(d => d[0])));
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A:A`, // Append to column A, it will find the first empty row AFTER existing data.
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS', // This is important
                resource: { values: datesToAdd }
            });
            console.log("SheetService: Re-fetching dates after append operation.");
            dateEntriesResponse = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A2:A`
            });
            dateEntriesInSheet = (dateEntriesResponse.result.values || []).map(row => row[0]).filter(date => date && date.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date));
            console.log(`SheetService: DATES IN SHEET AFTER ADDITIONS (A2:A):`, JSON.stringify(dateEntriesInSheet));
        }

        // 5. Map all dates found in the sheet to their 1-based sheet row indices
        const allDatesWithSheetRows = {};
        dateEntriesInSheet.forEach((date, index) => { // index is 0-based from A2 data
            allDatesWithSheetRows[date] = index + 2; // A2 is row 2, so 0-based index + 2
        });
        console.log("SheetService DEBUG: allDatesWithSheetRows map:", JSON.stringify(allDatesWithSheetRows));

        const determinedTodayRowIndex = allDatesWithSheetRows[todayStr];
        const determinedYesterdayRowIndex = allDatesWithSheetRows[yesterdayStr];
        console.log(`SheetService DEBUG: For todayStr='${todayStr}', foundRowIndex=${determinedTodayRowIndex}`);
        console.log(`SheetService DEBUG: For yesterdayStr='${yesterdayStr}', foundRowIndex=${determinedYesterdayRowIndex}`);

        // 6. Fetch all statuses (rest of the function is similar to before but uses determined indices)
        let allStatusesGrid = [];
        const firstChoreColLetter = 'B';
        const lastChoreColLetter = choreNames.length > 0 ? _columnToLetter(choreNames.length) : 'B';
        const lastDateActualRowInSheet = dateEntriesInSheet.length > 0 ? dateEntriesInSheet.length + 1 : 1;

        if (choreNames.length > 0 && dateEntriesInSheet.length > 0) {
            const statusRange = `${sheetName}!${firstChoreColLetter}2:${lastChoreColLetter}${lastDateActualRowInSheet}`;
            console.log(`SheetService: Fetching status grid from range: ${statusRange}`);
            try {
                const statusResponse = await gapi.client.sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: statusRange
                });
                allStatusesGrid = statusResponse.result.values || [];
                for (let i = 0; i < dateEntriesInSheet.length; i++) { // Ensure grid has rows for all dates
                    if (!allStatusesGrid[i]) allStatusesGrid[i] = [];
                    for (let j = 0; j < choreNames.length; j++) { // Ensure each row has cols for all chores
                        if (typeof allStatusesGrid[i][j] === 'undefined') allStatusesGrid[i][j] = '';
                    }
                }
            } catch (e) { /* ... error handling for status fetch ... */ }
        }
        console.log(`SheetService: Fetched status grid with ${allStatusesGrid.length} effective rows for ${dateEntriesInSheet.length} dates.`);

        // 7. Extract statuses for today and yesterday
        const statuses = { yesterday: {}, today: {} };
        choreNames.forEach((choreName, choreIndex0Based) => {
            if (determinedYesterdayRowIndex && allStatusesGrid[determinedYesterdayRowIndex - 2]) {
                statuses.yesterday[choreName] = allStatusesGrid[determinedYesterdayRowIndex - 2][choreIndex0Based] || '';
            } else {
                statuses.yesterday[choreName] = '';
            }
            if (determinedTodayRowIndex && allStatusesGrid[determinedTodayRowIndex - 2]) {
                statuses.today[choreName] = allStatusesGrid[determinedTodayRowIndex - 2][choreIndex0Based] || '';
            } else {
                statuses.today[choreName] = '';
            }
        });

        // 8. Calculate current allowance chore count (same logic as before)
        let calculatedAllowanceCount = 0;
        // ... (allowance calculation logic remains the same, using dateEntriesInSheet and allStatusesGrid)
        const resetDateObj = allowanceResetDate ? new Date(allowanceResetDate + "T00:00:00Z") : new Date("1970-01-01T00:00:00Z");
        dateEntriesInSheet.forEach((dateStrEntry, date0BasedIndexInGrid) => { // date0BasedIndexInGrid corresponds to row in allStatusesGrid
            const entryDateObj = new Date(dateStrEntry + "T00:00:00Z");
            if (entryDateObj > resetDateObj) {
                choreNames.forEach((choreName, chore0BasedIndexInGrid) => { // chore0BasedIndexInGrid corresponds to col in allStatusesGrid[date0BasedIndexInGrid]
                    if (allStatusesGrid[date0BasedIndexInGrid] && allStatusesGrid[date0BasedIndexInGrid][chore0BasedIndexInGrid] === 'x') {
                        calculatedAllowanceCount++;
                    }
                });
            }
        });
        console.log(`SheetService: Calculated allowance count: ${calculatedAllowanceCount} (since ${allowanceResetDate})`);

        return {
            chores: choreNames.map(name => ({ name: name })),
            statuses,
            allowanceResetDate,
            calculatedAllowanceCount,
            todayRowIndex: determinedTodayRowIndex, // Use the consistently determined index
            yesterdayRowIndex: determinedYesterdayRowIndex, // Use the consistently determined index
            choreNameToColLetter
        };

    } catch (error) { /* ... (outer error handling same as before) ... */
        console.error("MAJOR Error in getChoresAndStatuses (New Structure):", error);
        return { /* ... default empty structure ... */ };
    }
}

/**
 * Updates the status of a single chore in the spreadsheet (New Structure).
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {number} oneBasedRowIndex - The 1-based row index for the date.
 * @param {string} choreName - The name of the chore.
 * @param {string} choreColumnLetter - The column letter for this chore.
 * @param {boolean} isDone - True if the chore is done ("x").
 * @returns {Promise<Object>}
 */
async function updateChoreStatus(spreadsheetId, sheetName, oneBasedRowIndex, choreColumnLetter, isDone) {
    try {
        if (!oneBasedRowIndex || !choreColumnLetter) {
            throw new Error("Missing row index or column letter for updating chore status.");
        }
        const cellAddress = `${sheetName}!${choreColumnLetter}${oneBasedRowIndex}`;
        const value = isDone ? 'x' : '';

        console.log(`SheetService: Updating chore status at ${cellAddress} to '${value}'`);
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: cellAddress,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[value]]
            }
        });
        return response;
    } catch (error) {
        console.error("Error updating chore status (New Structure):", error);
        throw error;
    }
}

/**
 * Updates the "Last Allowance Paid Date" in cell A1. (For Parent Page)
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {string} dateStr - Today's date in "YYYY-MM-DD" to set as last paid date.
 * @returns {Promise<Object>}
 */
async function updateLastAllowancePaidDate(spreadsheetId, sheetName, dateStr) {
    try {
        const range = `${sheetName}!${LAST_ALLOWANCE_PAID_DATE_CELL}`; // A1
        console.log(`SheetService: Updating last allowance paid date at ${range} to '${dateStr}'`);
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[dateStr]]
            }
        });
        return response;
    } catch (error) {
        console.error("Error updating last allowance paid date:", error);
        throw error;
    }
}

/**
 * Updates (overwrites) the list of chore names in Row 1 (from B1 onwards). (For Parent Page)
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {Array<string>} newChoreNamesArray - An array of chore name strings.
 * @returns {Promise<Object>}
 */
async function updateChoreNames(spreadsheetId, sheetName, newChoreNamesArray) {
    try {
        // 1. Clear existing chore names from B1 to the end of the row
        const clearRange = `${sheetName}!B1:1`; // Clears entire row from B1 onwards
        console.log(`SheetService: Clearing chore names in range: ${clearRange}`);
        await gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: spreadsheetId,
            range: clearRange,
        });

        if (!newChoreNamesArray || newChoreNamesArray.length === 0) {
            console.log("SheetService: Empty chore names array provided, nothing to write after clearing.");
            return { status: "success", message: "Chore names cleared." };
        }

        // 2. Prepare new values for writing (as a single row)
        const newValues = [newChoreNamesArray]; // e.g., [["Chore1", "Chore2", "Chore3"]]

        // 3. Write the new chore names starting from B1
        const lastChoreColLetter = _columnToLetter(newChoreNamesArray.length); // B is col 1, so index 0 -> B
        const writeRange = `${sheetName}!B1:${lastChoreColLetter}1`;
        console.log(`SheetService: Writing ${newChoreNamesArray.length} chore names to range: ${writeRange}`);

        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: writeRange,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: newValues
            }
        });
        console.log("SheetService: Chore names updated in sheet:", response);
        return response;
    } catch (error) {
        console.error("Error in updateChoreNames:", error);
        throw error;
    }
}


// Remove old getAllowanceCount and updateAllowanceCount as they are replaced by A1 logic
// and calculated count. Keep updateChoreDescriptions if its logic is different from updateChoreNames
// (updateChoreDescriptions was for Column A chores, updateChoreNames is for Row 1 chores)

// Exporting the new and relevant functions
const sheetsService = {
    getSpreadsheetTabs,
    getChoresAndStatuses,       // Heavily modified
    updateChoreStatus,          // Heavily modified
    updateLastAllowancePaidDate, // New for parent page
    updateChoreNames,           // New for parent page (replaces updateChoreDescriptions)
    // Old functions to be removed from export if not used:
    // getAllowanceCount, (replaced by calculated value)
    // updateAllowanceCount, (replaced by updateLastAllowancePaidDate)
    // updateChoreDescriptions (if it was specifically for vertical chore lists in col A)
};