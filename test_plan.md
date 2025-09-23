# Comprehensive Test Plan for Interactive Bingo Score Sheet

## 1. Introduction

This document outlines the test plan for the "BIngo-Interactive-Score-Sheet" application. The purpose is to provide a structured approach to testing all features and functionalities to ensure they work as expected, are free of critical bugs, and provide a good user experience.

## 2. Development Cycle

This project follows a standard development lifecycle.

1.  **Feature Development:** Initial creation and implementation of core features.
2.  **Optimization:** Refactoring code for performance, clarity, and efficiency.
3.  **Bug Fixing / Final Testing:** Identifying and resolving issues, and comprehensive testing before a release.

**Current Phase:** The project is currently in the **Bug Fixing / Final Testing** phase for the current version.

## 3. Pre-Test Setup

Before starting the tests, the following setup is required:

1.  **Google Account:** A valid Google account.
2.  **Google Sheet:**
    *   Create a new Google Sheet.
    *   Create three tabs and name them exactly: `Config`, `Tiles`, `Submissions`.
    *   Populate the `Config` and `Tiles` tabs with initial data as described in `README.md`. It is recommended to prepare two versions of the `Config` sheet for testing: one with multiple teams (4-5) and one with a single team to test both modes.
    *   Populate the `Submissions` tab with the required headers from the `README.md`.
3.  **Google Apps Script:**
    *   Deploy the web app with `Code.gs`, `index.html`, `overview.html`, `admin.html`, and `setup.html`.
    *   In the deployment configuration, set "Who has access" to "Anyone".
    *   Authorize the script when prompted.
4.  **Sample Data:**
    *   Have a sample board image URL ready (e.g., a direct link to a .png or .jpg).
    *   Have sample stamp image URLs ready for testing the stamp feature.

---

## 4. Test Cases

### Section 1: Initial Setup & Configuration

| Test Case ID | Description | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SETUP-01** | Correct Sheet Population | Copy and paste the tables from `README.md` into the `Config` and `Tiles` sheets. | Data appears correctly in the sheets without formatting issues. The app loads without "Sheet not found" errors. | |
| **TC-SETUP-02** | Initial Deployment | Deploy the web app for the first time and grant permissions when prompted. | The deployment succeeds and a web app URL is generated. The app loads without "Authorization required" errors for the owner. The "Google hasn't verified this app" flow works as described. | |

### Section 2: Player View (`index.html`)

| Test Case ID | Description | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-PLAYER-01** | Page Load & Default View (Multi-Team) | Open the main web app URL with a multi-team configuration. | The page loads. The title from `Config` is displayed. If `Load First Team by Default` is TRUE, the first team's board is shown. If FALSE, the team selector shows "Select a Team...". The board background image loads correctly. If the image fails, an error message is shown, and tiles are still rendered. | |
| **TC-PLAYER-02** | Team Selection | Select a team from the dropdown menu. | The board view updates to show the selected team's progress. The URL does not change. The page title updates to include the team name. | |
| **TC-PLAYER-03** | Tile States & Colors | Observe the board for a selected team. | Tiles are colored correctly based on their status (Locked, Unlocked, etc.) as defined in `Config`. The color key at the bottom matches the tile colors. | |
| **TC-PLAYER-04** | Tile Tooltips | Hover the mouse over any tile. | A tooltip appears showing the Tile ID, Name, and Description. The tile border changes color/width as defined in `Config`. | |
| **TC-PLAYER-05** | Open Submission Modal | 1. Click on a "Locked" tile. <br> 2. Click on an "Unlocked" tile. | 1. Clicking the locked tile does nothing (or shows a message). <br> 2. Clicking the unlocked tile opens the submission modal. | |
| **TC-PLAYER-06** | Submission Form - New Submission | 1. Open the modal for an un-submitted tile. <br> 2. Fill in Player Name. <br> 3. Add two evidence items with links and names. <br> 4. Add notes. <br> 5. Check "Mark as complete". <br> 6. Enter the correct team password. <br> 7. Click "Save Progress". | The modal closes. A success message appears. The board refreshes, and the tile status changes to "Submitted". The data is correctly saved in the `Submissions` sheet. | |
| **TC-PLAYER-07** | Submission Form - Update Submission | 1. Open the modal for a "Partially Complete" or "Submitted" tile. <br> 2. Change the player name and notes. <br> 3. Remove one evidence item. <br> 4. Uncheck "Mark as complete". <br> 5. Enter the correct password and save. | The modal closes. A success message appears. The board refreshes, and the tile status changes to "Partially Complete". The data is correctly updated in the `Submissions` sheet. | |
| **TC-PLAYER-08** | Submission Form - Invalid Password | Attempt to submit the form with an incorrect team password. | An error message "Invalid password for this team" is displayed. The modal remains open. The form is not submitted. | |
| **TC-PLAYER-09** | Scoreboard Display | Check the scoreboard at the bottom of the page. | If `Show Scoreboard` is TRUE, the scoreboard is visible and shows teams ranked by score. If FALSE, it is hidden. | |
| **TC-PLAYER-10**| Refresh Button | 1. Manually verify a tile in the `Submissions` sheet. <br> 2. Click the "Refresh Data" button on the player view. | The board updates to reflect the change without a full page reload. A success message is shown. | |
| **TC-PLAYER-11**| Single-Team Mode Functionality | 1. In the `Config` sheet, set "Team Names" to a single team name (e.g., "Solo Team") and "Team Passwords" to a single password. <br> 2. Reload the Player View. | The team selector dropdown is either hidden, disabled, or contains only the one team. The board loads automatically for the single team. Submissions function correctly. | |

### Section 3: Admin View (`admin.html`)

| Test Case ID | Description | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-ADMIN-01** | Admin Login | 1. Navigate to the Admin page. <br> 2. Enter an incorrect password. <br> 3. Enter the correct admin password. | 1. The incorrect password shows an error. <br> 2. The correct password grants access to the admin view. | |
| **TC-ADMIN-02** | Submissions Table | View the submissions table after logging in. | All non-archived submissions are displayed. Columns include Timestamp, Team, Tile ID, Tile Name, Player(s), and Status. | |
| **TC-ADMIN-03** | Filtering and Searching | 1. Use the search box to filter by a player name, team name, and tile ID. <br> 2. Use the team dropdown to filter by a specific team. <br> 3. Use the status checkboxes to show/hide different submission statuses. | The table updates in real-time to show only the matching submissions. | |
| **TC-ADMIN-04** | Sorting | 1. Click on each column header (Timestamp, Team, etc.). <br> 2. Click the same header again. | Clicking a header sorts the table by that column in ascending order. Clicking again sorts in descending order. A sort indicator (▲/▼) appears next to the active sort column. | |
| **TC-ADMIN-05** | Edit Submission Modal | Click on any row in the submissions table. | A modal opens displaying all details for that submission, including player name, evidence (as clickable links), and notes. | |
| **TC-ADMIN-06** | Update Submission | 1. In the edit modal, check "Admin Verified". <br> 2. Check "Requires Action". <br> 3. Add text to the "Notes" field. <br> 4. Click "Update Submission". | The modal closes. A success message appears. The table refreshes, and the submission's status and data are updated. The changes are reflected in the `Submissions` sheet. | |
| **TC-ADMIN-07** | Duplicate Resolution Panel | 1. Create a duplicate submission (same team, same tile ID). <br> 2. Refresh the admin page. | The "Resolve Duplicate Submissions" panel appears, showing the conflicting entries. | |
| **TC-ADMIN-08** | Resolve Duplicates | 1. In the duplicates panel, select one submission to keep. <br> 2. Click "Resolve This Group". | A success message appears. The page refreshes. The duplicate panel for that group disappears. In the `Submissions` sheet, the non-selected entry has `IsArchived` set to TRUE. | |

### Section 4: Overview Page (`overview.html`)

| Test Case ID | Description | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-OVERVIEW-01**| Page Load | Navigate to the Overview page. | The page loads, showing the Leaderboard, Points Over Time chart, and Latest Activity feed. | |
| **TC-OVERVIEW-02**| Leaderboard Accuracy | Compare the leaderboard scores with a manual calculation based on the `Submissions` and `Tiles` sheets. | The scores and rankings are accurate based on the `Score on Verified Only` setting. | |
| **TC-OVERVIEW-03**| Activity Feed | 1. Make a new submission from the Player View. <br> 2. Refresh the Overview page. | The new submission appears at the top of the "Latest Activity" feed. | |
| **TC-OVERVIEW-04**| Chart Accuracy | Verify a few submissions at different times. Compare the chart's data points with the expected scores at those times. | The chart accurately plots the score progression for each team over time. | |
| **TC-OVERVIEW-05**| Filtering | Use the filter dropdown in the "Latest Activity" section to select a specific team. | The activity feed updates to show only items for that team. The chart also updates to show only the line for the selected team. Selecting "All Teams" restores the original view. | |
| **TC-OVERVIEW-06**| Refresh Button | 1. Make a change in the `Submissions` sheet. <br> 2. Click the "Refresh Data" button on the overview page. | All components (leaderboard, chart, feed) update to reflect the change without a full page reload. | |

### Section 5: Board Setup Page (`setup.html`)

| Test Case ID | Description | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SETUP-01** | Authentication & Data Load | 1. Navigate to the Setup page. <br> 2. Enter the correct admin password. <br> 3. Click "Load from Sheet". | Access is granted. After clicking load, the board, tile editor, and global style editor are populated with the current data from the Google Sheet. | |
| **TC-SETUP-02** | Visual Tile Editor - Drag & Resize | 1. Drag a tile to a new position. <br> 2. Resize a tile using its edges. | The tile moves/resizes smoothly. The `Left (%)`, `Top (%)`, `Width (%)`, and `Height (%)` values in the "Edit Tile Details" panel update in real-time. The "Generated Tile Position CSV" also updates. | |
| **TC-SETUP-03** | Tile Details Editor | Select a tile. Change its Name, Description, Points, and Rotation in the editor panel. | The changes are reflected in the tile on the board (if applicable, e.g., rotation) and in the CSV output. | |
| **TC-SETUP-04** | Prerequisite Editor | Select a tile. Use the Prerequisite UI to create a complex rule like `[["E1","E2"],["E4"]]`. | The UI correctly generates the JSON string in the hidden prerequisite field. The prerequisite visualization lines update correctly when a tile is selected. | |
| **TC-SETUP-05** | Global Style Editor | In the "Global Config & Styles" panel, change a value like `Tile Unlocked` color or `Default Tile Shape`. | The change is immediately reflected on all applicable tiles on the board preview. The "Generated Config & Style CSV" updates. | |
| **TC-SETUP-06** | Tile Override Editor | Select a tile. Add an override, for example, to change its `Default Tile Shape` to "Circle". | Only the selected tile's shape changes to a circle. The `Overrides (JSON)` field in the tile editor is populated with `{"Default Tile Shape": "Circle"}`. | |
| **TC-SETUP-07** | Security & Team Management | 1. Add a new team. <br> 2. Set a new password for an existing team. <br> 3. Set a new admin password. | The UI allows for these changes. The changes are saved correctly when "Save All Changes" is clicked. | |
| **TC-SETUP-08** | Save to Sheet | After making several changes (tile positions, styles, teams), click "Save All Changes to Sheet". | A success message appears. When checking the Google Sheet, the `Tiles` and `Config` tabs are updated with all the new values. The new team and password settings are correctly written. | |
| **TC-SETUP-09** | Zoom and Pan | Use the zoom slider and click-and-drag the board background. | The board zooms in and out smoothly. Panning moves the board content. Dragging and resizing tiles still works correctly at different zoom levels. | |

### Section 6: Backend Logic (`Code.gs`)

| Test Case ID | Description | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-BACKEND-01**| Prerequisite Logic - Simple AND | 1. Set a tile's prerequisite to `E1,E2`. <br> 2. In the Player View, complete only E1. <br> 3. Then complete E2. | The tile remains locked after only E1 is complete. It becomes "Unlocked" only after both E1 and E2 are complete. | |
| **TC-BACKEND-02**| Prerequisite Logic - Complex OR/AND | 1. Set a tile's prerequisite to `[["E1","E2"],["E4"]]`. <br> 2. Complete E4. <br> 3. Reset, then complete E1 and E2. | In case 2, the tile unlocks. In case 3, the tile unlocks. | |
| **TC-BACKEND-03**| Scoring Logic | 1. Set `Score on Verified Only` to FALSE. Submit a tile with points. <br> 2. Set `Score on Verified Only` to TRUE. Submit another tile with points. | In case 1, the team's score increases immediately. In case 2, the score does not increase until an admin marks the submission as "Admin Verified". | |
| **TC-BACKEND-04**| Error Handling | 1. Temporarily rename the `Config` sheet to `Config_`. <br> 2. Try to load the Player View. | The page displays a user-friendly error message like "Sheet 'Config' not found." instead of crashing. | |

---

## 5. Regression Testing

After any code change, a subset of these tests should be performed to ensure existing functionality is not broken. At a minimum, the following core user flows should be re-tested:

*   **TC-PLAYER-06:** New Submission
*   **TC-ADMIN-06:** Update Submission
*   **TC-OVERVIEW-02:** Leaderboard Accuracy
*   **TC-SETUP-08:** Save to Sheet