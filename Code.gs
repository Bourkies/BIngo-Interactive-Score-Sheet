/**
 * @OnlyCurrentDoc
 */

// Serves the correct HTML page based on the URL parameter.
function doGet(e) {
  let template;
  if (e.parameter.page === 'overview') {
    template = HtmlService.createTemplateFromFile('overview');
  } else if (e.parameter.page === 'admin') {
    template = HtmlService.createTemplateFromFile('admin');
  } else if (e.parameter.page === 'Setup') {
    template = HtmlService.createTemplateFromFile('Setup');
  } else {
    template = HtmlService.createTemplateFromFile('index');
  }
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Helper to get sheet data as an array of objects, using the first row as keys.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to process.
 * @returns {{data: Object[], headers: string[]}} An object containing the data and headers.
 */
function getSheetDataAsObjects(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return { data: [], headers: [] };
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(h => String(h || '').trim());
  
  const data = values.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  return { data, headers };
}

/**
 * Helper to get sheet headers as a list and a name-to-index map.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to process.
 * @returns {{list: string[], map: Object<string, number>}} An object with the header list and map.
 */
function getHeaders(sheet) {
    if (!sheet || sheet.getLastRow() < 1) return { list: [], map: {} };
    const list = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim());
    const map = list.reduce((acc, header, i) => {
        if (header) acc[header] = i + 1; // 1-based index for ranges
        return acc;
    }, {});
    return { list, map };
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
    const { data: tileObjects } = getSheetDataAsObjects(tilesSheet);
    const tiles = tileObjects.map(row => {
      let overrides = {};
      try {
        if (row['Overrides (JSON)']) overrides = JSON.parse(row['Overrides (JSON)']);
      } catch (e) { /* Ignore invalid JSON */ }
      return {
        id: row['TileID'], name: row['Name'], description: row['Description'],
        prerequisites: row['Prerequisites'] ? String(row['Prerequisites']).split(',').map(p => p.trim()) : [],
        top: row['Top (%)'], left: row['Left (%)'], width: row['Width (%)'], height: row['Height (%)'], 
        points: parseInt(row['Points']) || 0,
        rotation: row['Rotation'] || '0deg',
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
    const { data: submissions } = getSheetDataAsObjects(submissionsSheet);
    
    const sub = submissions.slice().reverse().find(s => s['TileID'] === tileId && s['Team'] === teamName);

    if (sub) {
      return {
        playerName: sub['Player Name'], evidence: sub['Evidence'], notes: sub['Notes'],
        isComplete: sub['IsComplete'] === true, requiresAction: sub['RequiresAction'] === true
      };
    }
    return null;
  } catch(e) {
    return { error: 'Failed to get tile details: ' + e.message };
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

    const { data: tileObjects } = getSheetDataAsObjects(tilesSheet);
    const tilePointsMap = tileObjects.reduce((acc, row) => {
        if (row['TileID']) acc[row['TileID']] = parseInt(row['Points']) || 0;
        return acc;
    }, {});

    const { data: submissions } = getSheetDataAsObjects(submissionsSheet);
    const teamNamesList = String(config['Team Names'] || '').split(',').map(t => t.trim());
    const teamData = {};
    teamNamesList.forEach(name => {
      teamData[name] = { scores: 0, tileStates: {} };
    });

    // Determine the latest state for each team's tile
    const latestStates = {};
    submissions.forEach(sub => {
        const team = sub['Team'];
        const tileId = sub['TileID'];
        if (!team || !tileId) return;
        const key = `${team}-${tileId}`;
        latestStates[key] = {
            verified: sub['Admin Verified'] === true,
            complete: sub['IsComplete'] === true,
            requiresAction: sub['RequiresAction'] === true,
            hasSubmission: true
        };
    });

    const scoreOnVerifiedOnly = config['Score on Verified Only'] !== false; // Default to TRUE

    // Populate teamData with states and calculate scores based on the latest state
    for (const key in latestStates) {
        const [team, tileId] = key.split('-');
        if (teamData[team]) {
            const state = latestStates[key];
            teamData[team].tileStates[tileId] = state;

            const pointValue = tilePointsMap[tileId] || 0;
            const shouldScore = scoreOnVerifiedOnly ? state.verified : state.complete;
            if (shouldScore && pointValue > 0) {
                teamData[team].scores += pointValue;
            }
        }
    }

    const scoreboardData = Object.entries(teamData)
                                .map(([team, data]) => ({ team: team, score: data.scores }))
                                .sort((a, b) => b.score - a.score);

    return { teamData, scoreboard: scoreboardData };
  } catch (e) {
    Logger.log(e.stack);
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
    const { list: headers, map: headerMap } = getHeaders(submissionsSheet);
    const submissions = submissionsSheet.getDataRange().getValues();
    let rowIndex = -1;

    const teamColIndex = headerMap['Team'] - 1;
    const tileIdColIndex = headerMap['TileID'] - 1;

    let existingRowValues = null;
    let existingIsComplete = false;
    const completionTimestampColIndex = headerMap['CompletionTimestamp'] ? headerMap['CompletionTimestamp'] - 1 : -1;

    // Search backwards for the most recent entry
    for (let i = submissions.length - 1; i >= 1; i--) {
      if (submissions[i][teamColIndex] === submissionData.team && submissions[i][tileIdColIndex] === submissionData.tileId) {
        rowIndex = i + 1;
        existingRowValues = submissions[i];
        existingIsComplete = existingRowValues[headerMap['IsComplete'] - 1] === true;
        break;
      }
    }

    const rowData = headers.map(header => {
        switch(header) {
            case 'Timestamp': return new Date();
            case 'CompletionTimestamp':
                const isNowComplete = submissionData.isComplete;
                if (isNowComplete && !existingIsComplete) {
                    return new Date(); // Transitioning to complete
                } else if (!isNowComplete && existingIsComplete) {
                    return ''; // Transitioning away from complete
                } else {
                    // No change in completion status, keep old value or set initial
                    return existingRowValues && completionTimestampColIndex !== -1 ? existingRowValues[completionTimestampColIndex] : (isNowComplete ? new Date() : '');
                }
            case 'Player Name': return submissionData.playerName;
            case 'Team': return submissionData.team;
            case 'TileID': return submissionData.tileId;
            case 'Evidence': return submissionData.evidence;
            case 'Notes': return submissionData.notes;
            case 'Admin Verified': return false; // Always false on player submission/update
            case 'IsComplete': return submissionData.isComplete;
            case 'RequiresAction': return submissionData.requiresAction;
            default: return '';
        }
    });

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
    const { data: tileObjects } = getSheetDataAsObjects(tilesSheet);
    const tilesMap = tileObjects.reduce((acc, row) => {
      const tileId = row['TileID'];
      if (tileId) {
        acc[tileId] = {
          name: row['Name'],
          description: row['Description']
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

/**
 * Fetches and processes data for the overview page.
 */
function getOverviewData() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const config = getFullConfig(ss);
        const tilesSheet = ss.getSheetByName('Tiles');
        const submissionsSheet = ss.getSheetByName('Submissions');

        if (!tilesSheet || !submissionsSheet) {
            return { success: false, error: "Required sheet not found." };
        }

        // --- Get latest data for scores and states ---
        const latestData = getLatestTeamData();
        if (latestData.error) return latestData;

        // --- Process for Leaderboard ---
        const scoreOnVerifiedOnlyForLeaderboard = config['Score on Verified Only'] !== false;
        const leaderboard = latestData.scoreboard.map(item => {
            const teamName = item.team;
            const teamStates = latestData.teamData[teamName].tileStates;
            const completedTiles = Object.values(teamStates).filter(state => {
                return scoreOnVerifiedOnlyForLeaderboard ? state.verified : state.complete;
            }).length;
            return { team: teamName, score: item.score, completedTiles: completedTiles };
        });

        // --- Process for Feed & Chart ---
        const { data: submissions } = getSheetDataAsObjects(submissionsSheet);
        const { data: tileObjects } = getSheetDataAsObjects(tilesSheet);
        const tileInfoMap = tileObjects.reduce((acc, row) => {
            if (row['TileID']) {
                acc[row['TileID']] = {
                    name: row['Name'],
                    points: parseInt(row['Points']) || 0
                };
            }
            return acc;
        }, {});

        const feedItems = submissions
            .filter(s => s['IsComplete'] || s['Admin Verified'])
            .sort((a, b) => new Date(b['Timestamp']) - new Date(a['Timestamp']))
            .slice(0, 20)
            .map(s => ({
                team: s['Team'],
                tileId: s['TileID'],
                tileName: tileInfoMap[s['TileID']] ? tileInfoMap[s['TileID']].name : 'Unknown',
                timestamp: new Date(s['Timestamp']).toLocaleString(),
                status: s['Admin Verified'] ? 'Verified' : 'Completed'
            }));

        // --- Process for Chart Data (historical analysis) ---
        const scoreOnVerifiedOnlyForChart = config['Score on Verified Only'] !== false;
        const allEvents = submissions
            .map(s => ({
                timestamp: new Date(s['Timestamp']),
                team: s['Team'],
                tileId: s['TileID'],
                isScorable: scoreOnVerifiedOnlyForChart ? s['Admin Verified'] === true : s['IsComplete'] === true
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        const teamScoresOverTime = {};
        const teamCompletedTiles = {};
        const chartDataPoints = [];
        const teamNamesList = String(config['Team Names'] || '').split(',').map(t => t.trim());

        teamNamesList.forEach(team => {
            teamScoresOverTime[team] = 0;
            teamCompletedTiles[team] = {};
        });

        allEvents.forEach(event => {
            if (!event.team || !event.tileId || !tileInfoMap.hasOwnProperty(event.tileId)) return;
            const pointValue = tileInfoMap[event.tileId].points;
            const wasScored = teamCompletedTiles[event.team][event.tileId] === true;
            if (event.isScorable && !wasScored) {
                teamScoresOverTime[event.team] += pointValue;
                teamCompletedTiles[event.team][event.tileId] = true;
            } else if (!event.isScorable && wasScored) {
                teamScoresOverTime[event.team] -= pointValue;
                teamCompletedTiles[event.team][event.tileId] = false;
            } else { return; } // No change in score status for this tile, so no new data point
            const dataPoint = { timestamp: event.timestamp.toISOString() };
            teamNamesList.forEach(team => { dataPoint[team] = teamScoresOverTime[team]; });
            chartDataPoints.push(dataPoint);
        });

        return { success: true, feed: feedItems, leaderboard: leaderboard, chartData: chartDataPoints, config: { pageTitle: config['Page Title'], teamNames: teamNamesList } };
    } catch (e) {
        Logger.log(e.stack);
        return { success: false, error: e.message };
    }
}

function updateSubmissionStatus(updateData) {
   if (!verifyAdminPassword(updateData.password)) {
      return { success: false, message: 'Invalid Admin Password. Session may have expired.' };
   }

   try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const submissionsSheet = ss.getSheetByName('Submissions');
    const { map: headerMap } = getHeaders(submissionsSheet);
    const submissions = submissionsSheet.getDataRange().getValues();
    let rowIndex = -1;

    const timestampColIndex = headerMap['Timestamp'] - 1;
    const teamColIndex = headerMap['Team'] - 1;
    const tileIdColIndex = headerMap['TileID'] - 1;

    let oldIsComplete = false;

    // Search backwards to find the exact submission by timestamp, team, and tileId
    for (let i = submissions.length - 1; i >= 1; i--) {
      const rowTimestamp = new Date(submissions[i][timestampColIndex]).toISOString();
      const rowTeam = submissions[i][teamColIndex];
      const rowTileId = submissions[i][tileIdColIndex];
      if (rowTimestamp === updateData.timestamp && rowTeam === updateData.team && rowTileId === updateData.tileId) {
        rowIndex = i + 1;
        oldIsComplete = submissions[i][headerMap['IsComplete'] - 1] === true;
        break;
      }
    }

    if (rowIndex === -1) {
      return { success: false, message: 'Could not find the submission to update. It may have been modified.' };
    }
    
    const newIsComplete = updateData.isComplete;

    // Update the correct columns based on the sheet structure
    submissionsSheet.getRange(rowIndex, headerMap['Notes']).setValue(updateData.notes);
    submissionsSheet.getRange(rowIndex, headerMap['Admin Verified']).setValue(updateData.adminVerified);
    submissionsSheet.getRange(rowIndex, headerMap['IsComplete']).setValue(newIsComplete);
    submissionsSheet.getRange(rowIndex, headerMap['RequiresAction']).setValue(updateData.requiresAction);
    
    // NEW: Update CompletionTimestamp based on change in 'IsComplete' status
    if (headerMap['CompletionTimestamp']) {
        if (newIsComplete && !oldIsComplete) { submissionsSheet.getRange(rowIndex, headerMap['CompletionTimestamp']).setValue(new Date()); }
        else if (!newIsComplete && oldIsComplete) { submissionsSheet.getRange(rowIndex, headerMap['CompletionTimestamp']).setValue(''); }
    }
    
    return { success: true, message: 'Submission updated!' };
  } catch (error) {
    Logger.log(`Error in updateSubmissionStatus after password verification: ${error.stack}`);
    return { success: false, message: 'An error occurred while updating the submission.' };
  }
}

// --- SETUP PAGE FUNCTIONS ---

/**
 * Fetches all data required for the setup page from the Google Sheet.
 * @return {object} An object containing CSV strings for tiles and styles,
 *                  and a configuration object for security settings.
 */
function getSetupPageData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tileSheet = ss.getSheetByName('Tiles');
    const configSheet = ss.getSheetByName('Config');

    if (!tileSheet || !configSheet) {
      throw new Error('Could not find "Tiles" or "Config" sheet.');
    }

    // 1. Get Tile Data as CSV
    const tileData = tileSheet.getDataRange().getValues();
    const tileCsv = tileData.map(row => {
      return row.map(cell => {
        const strCell = String(cell);
        if (strCell.includes(',') || strCell.includes('"') || strCell.includes('\n')) {
          return `"${strCell.replace(/"/g, '""')}"`;
        }
        return strCell;
      }).join(',');
    }).join('\n');

    // 2. Get Config/Style Data as CSV
    const configData = configSheet.getDataRange().getValues();
    const styleCsv = configData.map(row => `"${String(row[0]).replace(/"/g, '""')}","${String(row[1]).replace(/"/g, '""')}"`).join('\n');

    // 3. Get Security/Team Data from Config
    const config = getFullConfig(ss);
    const teamNames = (config['Team Names'] || '').split(',').map(t => t.trim()).filter(Boolean);
    
    const securityConfig = {
      teams: teamNames.map(name => ({ name: name }))
      // We don't send passwords to the client
    };

    return {
      tileCsv: tileCsv,
      styleCsv: styleCsv,
      securityConfig: securityConfig
    };
  } catch (e) {
    Logger.log('Error in getSetupPageData: ' + e.toString());
    throw new Error('Could not load data from the spreadsheet. Check sheet names ("Tiles", "Config").');
  }
}

/**
 * Saves all setup data from the page back to the Google Sheet.
 * @param {object} payload The data object from the client.
 *                         { tileCsv: string, styleCsv: string, securityConfig: object }
 */
function saveSetupPageData(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Wait up to 30 seconds.
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Save Tile Data
    const tileSheet = ss.getSheetByName('Tiles');
    const tileData = Utilities.parseCsv(payload.tileCsv);
    tileSheet.clearContents();
    if (tileData.length > 0) {
      tileSheet.getRange(1, 1, tileData.length, tileData[0].length).setValues(tileData);
    }

    // 2. Save Config/Style Data
    const configSheet = ss.getSheetByName('Config');
    const currentConfig = getFullConfig(ss);
    
    const styleData = Utilities.parseCsv(payload.styleCsv);
    styleData.shift(); // remove header
    styleData.forEach(row => {
      const key = row[0];
      if (key && key !== 'Team Names' && key !== 'Team Passwords' && key !== 'Admin Password') {
        currentConfig[key] = row[1];
      }
    });

    const security = payload.securityConfig;
    if (security.adminPass) currentConfig['Admin Password'] = security.adminPass;

    const oldTeamNames = (currentConfig['Team Names'] || '').split(',').map(t => t.trim());
    const oldTeamPasswords = (currentConfig['Team Passwords'] || '').split(',').map(p => p.trim());
    const oldPasswordsMap = oldTeamNames.reduce((acc, name, i) => { acc[name] = oldTeamPasswords[i] || ''; return acc; }, {});

    const newTeamNames = security.teams.map(t => t.name).filter(Boolean);
    const newTeamPasswords = newTeamNames.map(name => {
        const teamPayload = security.teams.find(t => t.name === name);
        return teamPayload.password || oldPasswordsMap[name] || '';
    });

    currentConfig['Team Names'] = newTeamNames.join(',');
    currentConfig['Team Passwords'] = newTeamPasswords.join(',');

    const newConfigData = Object.keys(currentConfig).map(key => [key, currentConfig[key]]);
    configSheet.clearContents();
    if (newConfigData.length > 0) configSheet.getRange(1, 1, newConfigData.length, 2).setValues(newConfigData);

    return 'Success';
  } catch (e) {
    Logger.log('Error in saveSetupPageData: ' + e.toString() + ' ' + e.stack);
    throw new Error('Failed to save data. The sheet might be busy. Please try again.');
  } finally {
    lock.releaseLock();
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
