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

This sheet controls the overall settings for your bingo board. Click on the Config tab and set it up exactly like this.

| A | B |
| :---- | :---- |
| **Setting** | **Value** |
| Page Title | OSRS Bingo |
| Max Page Width | 1200 |
| Tile Locked | \#808080 |
| Tile Unlocked | \#FFFF00 |
| Tile Partially Complete | \#FFD700 |
| Tile Submitted | \#00FF00 |
| Tile Verified | \#0000FF |
| Tile Requires Action | \#9932CC |
| Locked Opacity | 0.7 |
| Unlocked Opacity | 0.7 |
| Partially Complete Opacity | 0.7 |
| Submitted Opacity | 0.7 |
| Verified Opacity | 0.7 |
| Requires Action Opacity | 0.8 |
| Bingo Board Image | *Paste your image link here* |
| Team Names | Team 1, Team 2, Team 3 |
| Team Passwords | pass1, pass2, pass3 |
| Evidence Field Label | Proof (Link, Screenshot Name, etc.) |
| Unlock on Verified Only | TRUE |
| Show Tile Names | TRUE |
| Show Scoreboard | TRUE |
| Load First Team by Default | TRUE |

**Important Notes:**

* **Max Page Width:** Sets the maximum width of the content in pixels (e.g., 1200). The page will still be responsive on smaller screens.  
* **Team Passwords:** This must be a comma-separated list that corresponds exactly to your Team Names list.  
* **Load First Team by Default:** Set to TRUE to automatically load the first team's board. Set to FALSE to require users to select a team from the dropdown first.

### **Step 4: Populate the 'Tiles' Tab**

This sheet defines every tile on your board. A "Points" column is required.

| A | B | C | D | E | F | G | H | I |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **TileID** | **Name** | **Description** | **Prerequisites** | **Top (%)** | **Left (%)** | **Width (%)** | **Height (%)** | **Points** |
| A1 | Fire Cape | Obtain a Fire Cape. |  | 10 | 5 | 15 | 15 | 10 |

### **Step 5: Set Up the 'Submissions' Tab**

This sheet will automatically log all player submissions.

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

## **How to Use**

* **Players**: Open the web app link, select their team, and click on an unlocked tile. They can fill out the form and update their submission as many times as they need for multi-part tasks.  
* **Admins**: To verify a submission, go to the Submissions tab in the Google Sheet. Review the evidence. If it's valid, **tick the checkbox** in the Admin Verified column.

## **Admin Management**

Once the board is set up, here are two essential steps for making it easier to manage during an event.

### **Filtering Submissions**

To easily find submissions that need review, you can add filters to the Submissions sheet. **This will not break the script.**

1. Click on the **Submissions** tab.  
2. Select the entire first row by clicking the row number **"1"** on the far left.  
3. In the menu, go to **Data \-\> Create a filter**.

You will now see dropdown arrows in each header. You can click the arrow in the Admin Verified column and uncheck "TRUE" to see only the unverified submissions.

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
