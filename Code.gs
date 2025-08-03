/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file authorization
 * to only the current spreadsheet. This is a best practice for security.
 */

// The main function that serves the web app.
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Fetches all necessary data from the spreadsheet to build the bingo board.
 * This function is called by the frontend JavaScript.
 * @param {string} teamName The name of the team to get the board state for.
 * @returns {Object} An object containing board configuration, tiles, and their statuses.
 */
function getBoardData(teamName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    const tilesSheet = ss.getSheetByName('Tiles');
    const submissionsSheet = ss.getSheetByName('Submissions');

    // 1. Get Configuration Data robustly by name
    const configRange = configSheet.getRange('A1:B' + configSheet.getLastRow()).getValues();
    const config = configRange.reduce((acc, row) => {
        const key = row[0] ? row[0].trim() : '';
        if (key) acc[key] = row[1];
        return acc;
    }, {});
    
    // Validate required config settings
    const requiredSettings = ['Page Title', 'Tile Locked', 'Tile Unlocked', 'Tile Partially Complete', 'Tile Submitted', 'Tile Verified', 'Tile Requires Action', 'Team Names', 'Team Passwords'];
    for (const setting of requiredSettings) {
        if (!config[setting]) {
            throw new Error(`Configuration Error: Setting "${setting}" is missing or empty in the 'Config' sheet.`);
        }
    }

    // --- Image URL Handling ---
    let finalImageUrl = '';
    let imageUrlError = null;
    const boardImageLink = String(config['Bingo Board Image'] || '').trim();
    if (boardImageLink) {
        if (boardImageLink.includes('google.com')) {
            const fileId = extractGoogleDriveId(boardImageLink);
            finalImageUrl = fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : null;
            if (!finalImageUrl) imageUrlError = "Invalid Google Drive link format.";
        } else {
            finalImageUrl = boardImageLink;
        }
    }
    config.boardImageUrl = finalImageUrl;

    // 2. Get Tile Definitions, including points
    const tileData = tilesSheet.getRange('A2:I' + tilesSheet.getLastRow()).getValues();
    const tiles = tileData.map(row => ({
        id: row[0], name: row[1], description: row[2],
        prerequisites: row[3] ? String(row[3]).split(',').map(p => p.trim()) : [],
        top: row[4], left: row[5], width: row[6], height: row[7], 
        points: parseInt(row[8]) || 0, // Add points, default to 0 if not a number
        status: 'Locked'
    }));
    const tilePointsMap = tiles.reduce((acc, tile) => {
        acc[tile.id] = tile.points;
        return acc;
    }, {});


    // 3. Get Submissions Data
    const submissions = submissionsSheet.getLastRow() > 1 ? submissionsSheet.getRange('A2:I' + submissionsSheet.getLastRow()).getValues() : [];
    
    // --- Scoreboard Calculation ---
    const teamScores = {};
    const teamNamesList = String(config['Team Names']).split(',').map(t => t.trim());
    teamNamesList.forEach(name => { teamScores[name] = 0; }); // Initialize all teams with 0 points

    submissions.forEach(sub => {
        const team = sub[2];
        const tileId = sub[3];
        const isVerified = sub[6] === true;
        if (isVerified && teamScores.hasOwnProperty(team) && tilePointsMap[tileId]) {
            teamScores[team] += tilePointsMap[tileId];
        }
    });
    const scoreboardData = Object.entries(teamScores)
                                .map(([team, score]) => ({ team, score }))
                                .sort((a, b) => b.score - a.score);


    // --- Current Team Tile Status Calculation ---
    const teamSubmissions = teamName && teamName.toLowerCase() !== 'select team' ? submissions.filter(sub => sub[2] === teamName) : [];
    const tileStates = {};
    teamSubmissions.forEach(sub => {
        const tileId = sub[3];
        tileStates[tileId] = {
            verified: sub[6] === true, complete: sub[7] === true, requiresAction: sub[8] === true,
            hasSubmission: true,
            details: { playerName: sub[1], evidence: sub[4], notes: sub[5], isComplete: sub[7], requiresAction: sub[8] }
        };
    });

    const unlockOnVerifiedOnly = config['Unlock on Verified Only'] === true;
    tiles.forEach(tile => {
        const state = tileStates[tile.id] || {};
        if (state.verified) {
            tile.status = 'Verified';
        } else if (state.requiresAction) {
            tile.status = 'Requires Action';
        } else if (state.complete) {
            tile.status = 'Submitted';
        } else if (state.hasSubmission) {
            tile.status = 'Partially Complete';
        } else {
            const prereqsMet = tile.prerequisites.every(prereqId => {
                const prereqState = tileStates[prereqId] || {};
                return unlockOnVerifiedOnly ? prereqState.verified : (prereqState.verified || prereqState.complete);
            });
            tile.status = prereqsMet ? 'Unlocked' : 'Locked';
        }
    });
    
    const submissionDetails = {};
    Object.keys(tileStates).forEach(tileId => {
        submissionDetails[tileId] = tileStates[tileId].details;
    });

    return {
      config: {
        pageTitle: config['Page Title'],
        maxPageWidth: parseInt(config['Max Page Width']) || 900,
        colors: {
          'Locked': config['Tile Locked'], 'Unlocked': config['Tile Unlocked'],
          'Partially Complete': config['Tile Partially Complete'], 'Submitted': config['Tile Submitted'],
          'Verified': config['Tile Verified'], 'Requires Action': config['Tile Requires Action']
        },
        opacity: {
          'Locked': parseFloat(config['Locked Opacity']) || 0.7, 'Unlocked': parseFloat(config['Unlocked Opacity']) || 0.7,
          'Partially Complete': parseFloat(config['Partially Complete Opacity']) || 0.7, 'Submitted': parseFloat(config['Submitted Opacity']) || 0.7,
          'Verified': parseFloat(config['Verified Opacity']) || 0.7, 'Requires Action': parseFloat(config['Requires Action Opacity']) || 0.8,
        },
        boardImageUrl: config.boardImageUrl, imageUrlError: imageUrlError,
        teamNames: teamNamesList,
        evidenceLabel: config['Evidence Field Label'], 
        showTileNames: config['Show Tile Names'] === true,
        showScoreboard: config['Show Scoreboard'] === true,
        loadFirstTeamByDefault: config['Load First Team by Default'] === true
      },
      tiles: tiles, 
      submissionDetails: submissionDetails,
      scoreboard: scoreboardData
    };

  } catch (error) {
    Logger.log(error);
    return { error: 'An error occurred: ' + error.message };
  }
}

/**
 * Appends or updates a submission, now with password verification.
 * @param {Object} submissionData The data from the form, including password.
 * @returns {Object} A success or error message.
 */
function submitOrUpdateTile(submissionData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    const configRange = configSheet.getRange('A1:B' + configSheet.getLastRow()).getValues();
    const config = configRange.reduce((acc, row) => {
        const key = row[0] ? row[0].trim() : '';
        if (key) acc[key] = row[1];
        return acc;
    }, {});

    const teamNames = String(config['Team Names']).split(',').map(t => t.trim());
    const teamPasswords = String(config['Team Passwords']).split(',').map(p => p.trim());
    const teamIndex = teamNames.indexOf(submissionData.team);

    if (teamIndex === -1 || !teamPasswords[teamIndex] || teamPasswords[teamIndex] !== submissionData.password) {
        return { success: false, message: 'Invalid password for this team.' };
    }

    const submissionsSheet = ss.getSheetByName('Submissions');
    if (!submissionData.playerName || !submissionData.team) throw new Error("Missing required fields.");

    const submissions = submissionsSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < submissions.length; i++) {
      if (submissions[i][2] === submissionData.team && submissions[i][3] === submissionData.tileId) {
        rowIndex = i + 1;
        break;
      }
    }

    const rowData = [
      new Date(), submissionData.playerName, submissionData.team,
      submissionData.tileId, submissionData.evidence, submissionData.notes,
      false, // Admin Verified
      submissionData.isComplete, // IsComplete
      submissionData.requiresAction // RequiresAction
    ];

    if (rowIndex !== -1) {
      submissionsSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      return { success: true, message: 'Submission updated successfully!' };
    } else {
      submissionsSheet.appendRow(rowData);
      return { success: true, message: 'Tile submitted successfully!' };
    }
    
  } catch (error) {
    Logger.log(error);
    return { success: false, message: 'An error occurred: ' + error.message };
  }
}

function extractGoogleDriveId(url) {
    if (!url) return null;
    let id = null;
    const match1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) id = match1[1];
    const match2 = url.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);
    if (match2 && match2[1]) id = match2[1];
    return id;
}
