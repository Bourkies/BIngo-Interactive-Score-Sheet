# BIngo-Interactive-Score-Sheet
A basic interactive template for bingo competitions using google web aps and google sheets

Welcome to the Interacrive bingo score sheet\! This guide provides everything you need to set up your own free, secure, and easy-to-use bingo board for your clan or community event.  
The system uses a Google Sheet as a database and a Google Apps Script Web App as the user-facing interface.

## **Part 1: Setting Up The Google Sheet**

This sheet will be the heart of your bingo event, storing all configuration, tile data, and player submissions.

### **Step 1: Create a New Google Sheet**

1. Go to [sheets.new](https://sheets.new) to create a new, blank Google Sheet.  
2. Give it a memorable name, like "OSRS Bingo Admin Sheet".

### **Step 2: Create the Required Tabs**

You need to create three tabs at the bottom of the sheet. Rename them exactly as follows:

1. Config  
2. Tiles  
3. Submissions

### **Step 3: Populate the 'Config' Tab**

This sheet controls the overall settings for your bingo board. Click and copy the following table into the sheet then update the settings as desired.

| A | B | C |
| :---- | :---- | :---- |
| **Setting** | **Value** | **Description** |
| **General Settings** |  |  |
| Page Title | Bingo Board | Page or board title. |
| Admin Password | your\_secret\_password | A password to access the new Admin Verification page. |
| Max Page Width | 1400 | Sets the maximum width of the content in pixels (e.g., 1200). |
| Team Names | Team 1, Team 2, Team 3 | Comma-separated list of each team name. |
| Team Passwords | pass1, pass2, pass3 | Comma-separated list that corresponds exactly to your Team Names list. |
| Evidence Field Label | Proof (Link, Screenshot Name, etc.) | Text description above the evidence field in the submission form. |
| Unlock on Verified Only | FALSE | Sets if tiles are unlocked only after a prerequisite tile is verified by an admin (TRUE), or as soon as it's marked complete by a player (FALSE). |
| Show Tile Names | FALSE | Sets if the tile name is drawn on the box. |
| Show Scoreboard | TRUE | Sets if the scoreboard is displayed. |
| Load First Team by Default | TRUE | Set to TRUE to automatically load the first team's board. Set to FALSE to require users to select a team first. |
| Bingo Board Image | *Paste your image link here* | Image or GIF link to your bingo board (Supports direct links, Imgur, and Google Drive links). |
| **Tile Status Colors** |  |  |
| Tile Locked | \#808080 | Hex colour code for the tile status. |
| Tile Unlocked | \#FFFF00 | Hex colour code for the tile status. |
| Tile Partially Complete | \#FFD700 | Hex colour code for the tile status. |
| Tile Submitted | \#00FF00 | Hex colour code for the tile status. |
| Tile Verified | \#0000FF | Hex colour code for the tile status. |
| Tile Requires Action | \#9932CC | Hex colour code for the tile status. |
| **Tile Status Opacity** |  |  |
| Locked Opacity | 0.1 | Tile status opacity level from 0 (transparent) to 1 (opaque). |
| Unlocked Opacity | 0.1 | Tile status opacity level from 0 to 1\. |
| Partially Complete Opacity | 0.1 | Tile status opacity level from 0 to 1\. |
| Submitted Opacity | 0.1 | Tile status opacity level from 0 to 1\. |
| Verified Opacity | 0.1 | Tile status opacity level from 0 to 1\. |
| Requires Action Opacity | 0.1 | Tile status opacity level from 0 to 1\. |
| **Default Tile Styling** |  |  |
| Default Tile Shape | Square | Default shape for all tiles. Options: Square, Circle, Diamond, Triangle, Hexagon. |
| Default Tile Border Width | 2px | Default border thickness for tiles (e.g., 2px, 0.5rem). |
| Default Tile Border Color | transparent | Default border color for tiles (e.g., transparent, \#FFFFFF, blue). |
| Hover Tile Border Width | 3px | Border thickness when hovering over a tile. |
| Hover Tile Border Color | \#00b8d4 | Border color when hovering over a tile. |
| **Stamp Image Settings** |  | **Optional:** Add a "stamp" image on top of tiles based on their status. |
| Use Stamp by Default (Verified) | FALSE | Master switch (TRUE/FALSE) to show the 'Verified' stamp by default. |
| Stamp Image (Verified) |  | URL for the stamp image for 'Verified' tiles. |
| Stamp Scale (Verified) | 1 | Size of the stamp. 1 is original size, 0.5 is half, 2 is double. |
| Stamp Rotation (Verified) | 0deg | Rotation of the stamp (e.g., 15deg, \-10deg). |
| Stamp Position (Verified) | center | Position of the stamp. Use CSS values like center, top right, 50% 50%. |
| ... | ... | ...You can add Stamp settings for any status: (Partially Complete), (Unlocked), etc. |


### **Step 4: Populate the 'Tiles' Tab**

This sheet defines every tile on your board, copy the following table into the sheet. Its recommended to wait until the web app is running before adding tiles as this will allow you to visually set the location of each tile as you add them.

| A | B | C | D | E | F | G | H | I | J | K |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **TileID** | **Name** | **Description** | **Prerequisites** | **Top (%)** | **Left (%)** | **Width (%)** | **Height (%)** | **Points** | **Rotation** | **Overrides (JSON)** |
| E1 | Tile 1 | Get x item |  | 10 | 5 | 15 | 15 | 10 | 0deg |  |
| E2 | Tile 2 | Get y item | E1 | 25 | 5 | 15 | 15 | 10 | 15deg | {"Default Tile Shape": "Circle", "Tile Verified": "\#00FF00"} |
| E3 | Tile 3 | Get z item |  | 40 | 5 | 15 | 15 | 10 | 0deg | {"Use Stamp by Default (Verified)": false} |

* **Rotation:** Sets the rotation of the entire tile. (e.g., 5deg, \-10deg). Defaults to 0deg.  
* **Overrides (JSON):** A powerful feature to override any setting from the Config sheet for a single tile.  
  * Must be in valid JSON format: {"key": "value", "key2": "value2"}.  
  * The key must match a setting name from the Config sheet *exactly* (e.g., "Tile Unlocked", "Use Stamp by Default (Verified)").  
  * If the JSON is invalid, it will be ignored.

### **Step 5: Set Up the 'Submissions' Tab**

This sheet will automatically log all player submissions. Admins verify tiles by setting the “Admin Verified” value of a submission to “TRUE”, after which the tile is then scored.

| A | B | C | D | E | F | G | H | I |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Timestamp** | **Player Name** | **Team** | **TileID** | **Evidence** | **Notes** | **Admin Verified** | **IsComplete** | **RequiresAction** |

## **Part 2: Setting Up The Google Apps Script**

This script connects your sheet to the web app.

### **Step 1: Open the Script Editor**

1. In your Google Sheet, go to **Extensions \-\> Apps Script**.

### **Step 2: Create the Script Files**

1. **Code.gs**: Delete any content inside and copy-paste the code from the Code.gs document provided.  
2. **index.html**: Delete any content inside and copy-paste the code from the index.html document provided.

### **Step 3: Save and Deploy**

1. Click the floppy disk icon (💾 Save project).  
2. At the top right, click **Deploy \-\> New deployment**. This is required for your changes to go live.  
3. Set **Who has access** to **"Anyone"**.  
4. Click **Deploy** and authorize the script if prompted.  
5. Share the new Web app URL with your players.

## **Part 3: How to Use**

### **Player View**

* Players open the main Web app URL, select their team, and click on an unlocked tile.  
* They can fill out the form and update their submission as many times as they need.

### **Admin View**

Admins have two ways to manage submissions:  
**1\. The New Admin Verification Page (Recommended)**

1. Take your Web app URL and add ?page=admin to the end of it.  
   * Example: https://script.google.com/macros/s/..../exec?page=admin  
2. Enter the Admin Password you set in the Config sheet.  
3. You will see a list of all submissions. You can filter them by status.  
4. Click on any row to open an edit modal and update the status checkboxes.

**2\. The Google Sheet (Manual Method)**

* Go to the Submissions tab in the Google Sheet.  
* Review the evidence. If it's valid, set the value in the Admin Verified column to TRUE.  
* If a submission needs changes, set RequiresAction to TRUE and add notes for the player in the Notes column.

### **Protecting Sheets**

To prevent other admins from accidentally breaking the board's configuration, it's highly recommended to protect the Config and Tiles sheets.

1. Click on the **Config** tab.  
2. Click the small down-arrow on the tab itself, and select **Protect sheet**.  
3. A sidebar will open. You can add a description like "Board Configuration \- Do Not Edit".  
4. Click **Set permissions**.  
5. By default, it will be set to "Only you". This is ideal. Click **Done**.

Repeat these steps for the **Tiles** sheet. Now, only you (the owner of the spreadsheet) can edit these two critical sheets, but other admins you've shared the sheet with can still view them and manage the Submissions sheet.

## **Note on AI Generation**

This project was created collaboratively with Google's Gemini. While the logic and functionality have been guided and tested by a human developer, much of the boilerplate code and documentation was AI-generated.
