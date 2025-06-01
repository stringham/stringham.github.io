// config.js

// Google API Configuration
const CLIENT_ID = '766286854262-jarbjdeo9jckoljt4ii442qs4n996dp7.apps.googleusercontent.com';

// API_KEY is generally not required for OAuth 2.0 flows that access user-private data
// when using the Google API Client Library for JavaScript. The authorization is handled
// via the OAuth flow and access tokens.
const API_KEY = ''; // Keep empty or remove if not used.

// Discovery Docs are URLs that describe the SSheets API, helping the client library understand how to interact with it.
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];

// Scopes define the permissions your app is requesting from the user.
// https://www.googleapis.com/auth/spreadsheets grants full read/write access to the user's spreadsheets.
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// Application-Specific Configuration
const CHORE_VALUE = 0.20; // Monetary value assigned to each completed chore (e.g., $0.20).

// Google Sheet Cell Configuration for Allowance Tracking (per child's sheet)
// As per the requirements, "A specific cell/area in each child's tab will store CurrentAllowanceChoreCount".
// We'll assume the label is in A1 and the actual numerical count is in B1 of each child's sheet.
const LAST_ALLOWANCE_PAID_DATE_CELL = 'A1';
const ALLOWANCE_COUNT_LABEL_CELL = 'A1'; // Cell where the "Allowance Chore Count:" label might be (for reference or if you want to write it).
const ALLOWANCE_COUNT_VALUE_CELL = 'B1'; // Cell where the numerical value of the chore count is stored and updated.

// You can add other app-wide constants here as needed.
// For example, if you had specific names for PWA caches that are used in multiple places,
// though we've kept the cache name directly in sw.js for now.