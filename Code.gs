/**
 * @OnlyCurrentDoc
 */

// Serves the correct HTML page based on the URL parameter.
function doGet(e) {
  let template;
  if (e.parameter.page === 'admin') {
    template = HtmlService.createTemplateFromFile('admin');
  } else {
    template = HtmlService.createTemplateFromFile('index');
  }
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Intelligently parses a value from the spreadsheet.
 * @param {any} value The value from the spreadsheet cell.
 * @returns {boolean|string} The parsed value.
 */
function parseConfigValue(value) {
    if (value === null || value === undefined) return '';
    const sValue = String(value).trim();
    if (sValue.toLowerCase() === 'true') return true;
    if (sValue.toLowerCase() === 'false') return false;
    return sValue;
}


/**
 * Utility to get all config values from the 'Config' sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} spreadsheet The active spreadsheet.
 * @returns {Object} The configuration object.
 */
function getFullConfig(spreadsheet) {
    const configSheet = spreadsheet.getSheetByName('Config');
    if (!configSheet) throw new Error("Sheet 'Config' not found.");
    const configRange = configSheet.getRange('A1:B' + configSheet.getLastRow()).getValues();
    return configRange.reduce((acc, row) => {
        const key = row[0] ? String(row[0]).trim() : '';
        if (key) acc[key] = parseConfigValue(row[1]);
        return acc;
    }, {});
}


/**
 * Fetches all data required to initialize the bingo board, including statuses for all teams.
 * This is called only on the initial page load.
 */
function getBoardData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = getFullConfig(ss);
    const tilesSheet = ss.getSheetByName('Tiles');
    if (!tilesSheet) return { error: "Sheet 'Tiles' not found." };
    
    // --- Image URL Handling ---
    let finalImageUrl = '';
    let imageUrlError = null;
    const boardImageLink = config['Bingo Board Image'] || '';
    if (boardImageLink) {
        if (boardImageLink.includes('google.com')) {
            const fileId = extractGoogleDriveId(boardImageLink);
            finalImageUrl = fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : null;
            if (!finalImageUrl) imageUrlError = "Invalid Google Drive link format.";
        } else {
            finalImageUrl = boardImageLink;
        }
    }
    
    // --- Get Tile Definitions ---
    const tileData = tilesSheet.getLastRow() > 1 ? tilesSheet.getRange('A2:K' + tilesSheet.getLastRow()).getValues() : [];
    const tiles = tileData.map(row => {
      let overrides = {};
      try {
        if (row[10]) overrides = JSON.parse(row[10]);
      } catch (e) { /* Ignore invalid JSON */ }
      return {
        id: row[0], name: row[1], description: row[2],
        prerequisites: row[3] ? String(row[3]).split(',').map(p => p.trim()) : [],
        top: row[4], left: row[5], width: row[6], height: row[7], 
        points: parseInt(row[8]) || 0,
        rotation: row[9] || '0deg',
        overrides: overrides
      };
    }).filter(t => t.id); // Ensure tile has an ID
    
    const latestData = getLatestTeamData(); // Get initial team data

    // --- Prepare Config for Frontend ---
    const frontendConfig = {
      pageTitle: config['Page Title'],
      teamNames: String(config['Team Names'] || '').split(',').map(t => t.trim()),
      evidenceLabel: config['Evidence Field Label'], 
      showScoreboard: config['Show Scoreboard'],
      loadFirstTeamByDefault: config['Load First Team by Default'],
      unlockOnVerifiedOnly: config['Unlock on Verified Only'],
      boardImageUrl: finalImageUrl,
      imageUrlError: imageUrlError,
      fullConfig: config 
    };

    return {
      config: frontendConfig,
      tiles: tiles,
      teamData: latestData.teamData,
      scoreboard: latestData.scoreboard
    };

  } catch (error) {
    Logger.log(error.stack);
    return { error: 'An error occurred: ' + error.message };
  }
}

/**
 * A lightweight function to get the latest submission details for a specific tile.
 * @param {string} tileId The ID of the tile.
 * @param {string} teamName The name of the team.
 * @returns {Object|null} The submission details or null if none exist.
 */
function getTileDetails(tileId, teamName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionsSheet = ss.getSheetByName('Submissions');
    if (!submissionsSheet) return null;
    const submissions = submissionsSheet.getLastRow() > 1 ? submissionsSheet.getRange('A2:I' + submissionsSheet.getLastRow()).getValues() : [];
    
    for (let i = submissions.length - 1; i >= 0; i--) {
      const sub = submissions[i];
      if (sub[3] === tileId && sub[2] === teamName) {
        return {
          playerName: sub[1], evidence: sub[4], notes: sub[5],
          isComplete: sub[7] === true, requiresAction: sub[8] === true
        };
      }
    }
    return null; // No submission found
  } catch(e) {
    return { error: e.message };
  }
}

/**
 * A lightweight function to get updated team data (statuses and scores).
 * Called by the polling mechanism.
 */
function getLatestTeamData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = getFullConfig(ss);
    const tilesSheet = ss.getSheetByName('Tiles');
    const submissionsSheet = ss.getSheetByName('Submissions');

    if (!tilesSheet || !submissionsSheet) {
      return { error: "Required sheet not found." };
    }

    const tileData = tilesSheet.getLastRow() > 1 ? tilesSheet.getRange('A2:I' + tilesSheet.getLastRow()).getValues() : [];
    const tilePointsMap = tileData.reduce((acc, row) => {
        if (row[0]) acc[row[0]] = parseInt(row[8]) || 0;
        return acc;
    }, {});

    const submissions = submissionsSheet.getLastRow() > 1 ? submissionsSheet.getRange('A2:I' + submissionsSheet.getLastRow()).getValues() : [];
    const teamNamesList = String(config['Team Names'] || '').split(',').map(t => t.trim());
    const teamData = {};
    teamNamesList.forEach(name => {
      teamData[name] = { scores: 0, tileStates: {}, submissionDetails: {} };
    });

    submissions.forEach(sub => {
        const team = sub[2];
        const tileId = sub[3];
        if (!team || !tileId) return; // Skip invalid submission rows

        const isVerified = sub[6] === true;

        if (teamData[team]) {
            if (isVerified && tilePointsMap[tileId] && !teamData[team].tileStates[tileId]?.verified) {
                teamData[team].scores += tilePointsMap[tileId];
            }
            teamData[team].tileStates[tileId] = {
                verified: isVerified,
                complete: sub[7] === true,
                requiresAction: sub[8] === true,
                hasSubmission: true
            };
        }
    });

    const scoreboardData = Object.entries(teamData)
                                .map(([team, data]) => ({ team: team, score: data.scores }))
                                .sort((a, b) => b.score - a.score);

    return { teamData, scoreboard: scoreboardData };
  } catch (e) {
    return { error: e.message };
  }
}


// Appends or updates a submission, with password verification.
function submitOrUpdateTile(submissionData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = getFullConfig(ss);

    const teamNames = String(config['Team Names']).split(',').map(t => t.trim());
    const teamPasswords = String(config['Team Passwords']).split(',').map(p => p.trim());
    const teamIndex = teamNames.indexOf(submissionData.team);

    if (teamIndex === -1 || !teamPasswords[teamIndex] || teamPasswords[teamIndex] !== submissionData.password) {
        return { success: false, message: 'Invalid password for this team.' };
    }

    const submissionsSheet = ss.getSheetByName('Submissions');
    const submissions = submissionsSheet.getDataRange().getValues();
    let rowIndex = -1;
    // Search backwards for the most recent entry
    for (let i = submissions.length - 1; i >= 1; i--) {
      if (submissions[i][2] === submissionData.team && submissions[i][3] === submissionData.tileId) {
        rowIndex = i + 1;
        break;
      }
    }

    const rowData = [ new Date(), submissionData.playerName, submissionData.team, submissionData.tileId, submissionData.evidence, submissionData.notes, false, submissionData.isComplete, submissionData.requiresAction ];

    if (rowIndex !== -1) {
      submissionsSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: 'Submission updated successfully!' };
    } else {
      submissionsSheet.appendRow(rowData);
      return { success: true, message: 'Tile submitted successfully!' };
    }
    
  } catch (error) {
    Logger.log(error.stack);
    return { success: false, message: 'An error occurred: ' + error.message };
  }
}

// --- ADMIN PAGE FUNCTIONS ---

function verifyAdminPassword(passwordFromClient) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const config = getFullConfig(ss);
    const adminPasswordFromSheet = config['Admin Password'];
    
    if (adminPasswordFromSheet === undefined) return false;
    return (passwordFromClient === adminPasswordFromSheet);

  } catch (e) {
    Logger.log(`[Verification] CRITICAL ERROR during password check: ${e.message}`);
    return false;
  }
}

// UPDATED: This function now also returns tile data
function getAdminData(password) {
  if (!verifyAdminPassword(password)) {
    return { success: false, message: 'Invalid Admin Password.' };
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionsSheet = ss.getSheetByName('Submissions');
    const tilesSheet = ss.getSheetByName('Tiles');

    if (!submissionsSheet || !tilesSheet) {
      return { success: false, message: "Could not find 'Submissions' or 'Tiles' sheet." };
    }

    // Get Submissions
    const subHeaders = submissionsSheet.getRange(1, 1, 1, submissionsSheet.getLastColumn()).getValues()[0];
    const subData = submissionsSheet.getLastRow() > 1 ? submissionsSheet.getRange(2, 1, submissionsSheet.getLastRow() - 1, submissionsSheet.getLastColumn()).getValues() : [];

    const submissions = subData.map(row => {
      const submissionObject = {};
      subHeaders.forEach((header, i) => {
        if (row[i] instanceof Date) {
          submissionObject[header] = row[i].toISOString();
        } else {
          submissionObject[header] = row[i];
        }
      });
      return submissionObject;
    });

    // NEW: Get Tile data and map it by ID
    const tileData = tilesSheet.getLastRow() > 1 ? tilesSheet.getRange('A2:C' + tilesSheet.getLastRow()).getValues() : [];
    const tilesMap = tileData.reduce((acc, row) => {
      const tileId = row[0];
      if (tileId) {
        acc[tileId] = {
          name: row[1],
          description: row[2]
        };
      }
      return acc;
    }, {});
    
    // Return both submissions and the new tiles map
    return { success: true, submissions: submissions.reverse(), tiles: tilesMap };

  } catch (error) {
    Logger.log(`Error in getAdminData after password verification: ${error.stack}`);
    return { success: false, message: 'An error occurred while fetching data.' };
  }
}

function updateSubmissionStatus(updateData) {
   if (!verifyAdminPassword(updateData.password)) {
      return { success: false, message: 'Invalid Admin Password. Session may have expired.' };
   }

   try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionsSheet = ss.getSheetByName('Submissions');
    const submissions = submissionsSheet.getDataRange().getValues();
    let rowIndex = -1;

    // Search backwards to find the exact submission by timestamp, team, and tileId
    for (let i = submissions.length - 1; i >= 1; i--) {
      const rowTimestamp = new Date(submissions[i][0]).toISOString();
      const rowTeam = submissions[i][2];
      const rowTileId = submissions[i][3];
      if (rowTimestamp === updateData.timestamp && rowTeam === updateData.team && rowTileId === updateData.tileId) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, message: 'Could not find the specific submission to update. It may have been modified.' };
    }
    
    // Update the correct columns based on the sheet structure
    submissionsSheet.getRange(rowIndex, 6).setValue(updateData.notes); // Column F: Notes
    submissionsSheet.getRange(rowIndex, 7).setValue(updateData.adminVerified); // Column G: Admin Verified
    submissionsSheet.getRange(rowIndex, 8).setValue(updateData.isComplete); // Column H: IsComplete
    submissionsSheet.getRange(rowIndex, 9).setValue(updateData.requiresAction); // Column I: RequiresAction
    
    return { success: true, message: 'Submission updated!' };
  } catch (error) {
    Logger.log(`Error in updateSubmissionStatus after password verification: ${error.stack}`);
    return { success: false, message: 'An error occurred while updating the submission.' };
  }
}

// --- HELPER FUNCTIONS ---

function extractGoogleDriveId(url) {
    if (!url) return null;
    let id = null;
    // Matches drive.google.com/file/d/FILE_ID/view
    const match1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) id = match1[1];
    // Matches drive.google.com/uc?id=FILE_ID
    const match2 = url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (match2 && match2[1]) id = match2[1];
    return id;
}
