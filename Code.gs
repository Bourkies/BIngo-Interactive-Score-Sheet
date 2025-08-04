/**
 * @OnlyCurrentDoc
 */

// Serves the correct HTML page based on the URL parameter.
function doGet(e) {
  if (e.parameter.page === 'admin') {
    return HtmlService.createTemplateFromFile('admin')
      .evaluate()
      .setTitle('Bingo Admin Verification')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
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
    const tileData = tilesSheet.getRange('A2:K' + tilesSheet.getLastRow()).getValues();
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
    });
    
    const latestData = getLatestTeamData(); // Get initial team data

    // --- Prepare Config for Frontend ---
    const frontendConfig = {
      pageTitle: config['Page Title'],
      teamNames: String(config['Team Names']).split(',').map(t => t.trim()),
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
      teamData: latestData.teamData, // Contains statuses and details for all teams
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
    const config = getFullConfig(ss); // Needed for team names
    const tilesSheet = ss.getSheetByName('Tiles');
    const submissionsSheet = ss.getSheetByName('Submissions');

    const tileData = tilesSheet.getRange('A2:I' + tilesSheet.getLastRow()).getValues();
    const tilePointsMap = tileData.reduce((acc, row) => {
        acc[row[0]] = parseInt(row[8]) || 0;
        return acc;
    }, {});

    const submissions = submissionsSheet.getLastRow() > 1 ? submissionsSheet.getRange('A2:I' + submissionsSheet.getLastRow()).getValues() : [];
    const teamNamesList = String(config['Team Names']).split(',').map(t => t.trim());
    const teamData = {};
    teamNamesList.forEach(name => {
      teamData[name] = { scores: 0, tileStates: {}, submissionDetails: {} };
    });

    submissions.forEach(sub => {
        const team = sub[2];
        const tileId = sub[3];
        const isVerified = sub[6] === true;

        if (teamData[team]) {
            if (isVerified && tilePointsMap[tileId]) {
                teamData[team].scores += tilePointsMap[tileId];
            }
            teamData[team].tileStates[tileId] = {
                verified: isVerified,
                complete: sub[7] === true,
                requiresAction: sub[8] === true,
                hasSubmission: true
            };
            teamData[team].submissionDetails[tileId] = {
                playerName: sub[1], evidence: sub[4], notes: sub[5],
                isComplete: sub[7] === true, requiresAction: sub[8] === true
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
    for (let i = 1; i < submissions.length; i++) {
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
    const configSheet = ss.getSheetByName('Config');
    const configValues = configSheet.getRange('A1:B' + configSheet.getLastRow()).getValues();
    let adminPasswordFromSheet;

    for (const row of configValues) {
      if (row[0] && String(row[0]).trim() === 'Admin Password') {
        adminPasswordFromSheet = String(row[1]).trim();
        break;
      }
    }
    
    if (adminPasswordFromSheet === undefined) return false;
    return (passwordFromClient === adminPasswordFromSheet);

  } catch (e) {
    Logger.log(`[Verification] CRITICAL ERROR during password check: ${e.message}`);
    return false;
  }
}

function getAdminData(password) {
  if (!verifyAdminPassword(password)) {
    return { success: false, message: 'Invalid Admin Password.' };
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionsSheet = ss.getSheetByName('Submissions');
    const headers = submissionsSheet.getRange(1, 1, 1, submissionsSheet.getLastColumn()).getValues()[0];
    const data = submissionsSheet.getLastRow() > 1 ? submissionsSheet.getRange(2, 1, submissionsSheet.getLastRow() - 1, submissionsSheet.getLastColumn()).getValues() : [];

    const submissions = data.map(row => {
      const submissionObject = {};
      headers.forEach((header, i) => {
        if (row[i] instanceof Date) {
          submissionObject[header] = row[i].toISOString();
        } else {
          submissionObject[header] = row[i];
        }
      });
      return submissionObject;
    });
    
    return { success: true, submissions: submissions.reverse() };
  } catch (error) {
    Logger.log(`Error in getAdminData after password verification: ${error.stack}`);
    return { success: false, message: 'An error occurred while fetching submission data.' };
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

    for (let i = 1; i < submissions.length; i++) {
      const rowTimestamp = new Date(submissions[i][0]).toISOString();
      if (rowTimestamp === updateData.timestamp) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, message: 'Could not find the submission to update. It may have been modified.' };
    }
    
    submissionsSheet.getRange(rowIndex, 6).setValue(updateData.notes);
    submissionsSheet.getRange(rowIndex, 7).setValue(updateData.adminVerified);
    submissionsSheet.getRange(rowIndex, 8).setValue(updateData.isComplete);
    submissionsSheet.getRange(rowIndex, 9).setValue(updateData.requiresAction);
    
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
    const match1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) id = match1[1];
    const match2 = url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (match2 && match2[1]) id = match2[1];
    return id;
}
