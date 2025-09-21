# Tile Adjacency Linker

A visual tool to generate prerequisite links between tiles on a game board, based on their proximity. This tool is designed to take a CSV of tile data, allow for automatic and manual linking, and export a new CSV with the prerequisite information formatted in JSON.

## Features

- **Load from CSV**: Import tile data including ID and position.
- **Background Image**: Load a background image of your board to visually align tiles.
- **Automatic Linking**: Automatically create links between tiles based on a configurable minimum and maximum distance.
- **Manual Editing**: Manually add or remove links between specific tiles.
- **Coordinate Centering**: Optionally use tile width and height to calculate center points for more accurate distance measurements.
- **Prerequisite Export**: Export the complete tile list to a new CSV, with a `Prerequisites` column populated with the correct JSON format for complex `OR` logic.

## Setup

### Prerequisites

- Python 3.8+

### Installation

1.  Ensure you have Python installed and it's added to your system's PATH.
2.  Double-click `install_dependencies.bat`. This will run a script to download and install the required Python libraries (`pandas`, `numpy`, `matplotlib`, `scipy`).
    - Alternatively, you can install them manually from your terminal: `pip install pandas numpy matplotlib scipy`

## How to Use

1.  Double-click `launch_tool.bat` to start the application.
    - Alternatively, run the main Python script from your terminal.

2.  **Load Data**:
    - Click the **"Load CSV"** button and select your tile data file.

3.  **Map Columns**:
    - A dialog will appear. You must map the columns from your CSV to the required fields:
      - **Tile ID**: The unique identifier for each tile (e.g., `E1`, `A5`).
      - **Top Coordinate**: The vertical position of the tile.
      - **Left Coordinate**: The horizontal position of the tile.
    - You can also map optional fields for more accuracy:
      - **Width (optional)**: The width of the tile.
      - **Height (optional)**: The height of the tile.
    - If `Width` and `Height` are provided, the tool calculates the center of each tile for plotting and distance checks. Otherwise, it uses the `Top`/`Left` coordinates directly.
    - **Note**: If a background image is used, coordinates are interpreted as percentages (0-100). Without a background image, they are treated as absolute pixel coordinates.
    - Click **"OK"** to load the tiles onto the canvas.

4.  **Load Background Image (Optional)**:
    - Click **"Load BG Image"** and select an image of your game board.
    - When a background image is used, the `Top` and `Left` coordinates from your CSV are assumed to be **percentages (0-100)** and will be scaled to fit the image dimensions.

5.  **Link Tiles**:
    - **Auto Mode**: This is the default mode. Use the **"Distance Range"** slider at the bottom to define a minimum and maximum distance for creating links. The tool will automatically connect all tiles that fall within this range.
    - **Add Link Mode**: Select this mode to manually create a link. Click on the first tile, then click on the second tile to create a connection between them.
    - **Remove Link Mode**: Select this mode to manually remove a link. Click on the first tile, then click on the second tile to delete the connection.

6.  **Export Results**:
    - Once you are satisfied with the links, click the **"Export CSV"** button.
    - Choose a name and location for your new file (e.g., `tiles_with_prerequisites.csv`).
    - The tool will generate a new CSV containing all original data, plus an updated `Prerequisites` column.

## CSV Input Format

Your input CSV should contain at least the following columns. The names can be anything, as you will map them in the tool.

```csv
TileID,Top (%),Left (%),Width (%),Height (%)
A1,10.5,5.2,8.0,8.0
A2,10.5,15.3,8.0,8.0
...
```

- `TileID`: A unique string for each tile.
- `Top (%)`, `Left (%)`: The position of the tile's top-left corner. If using a background image, these should be percentages.
- `Width (%)`, `Height (%)`: (Optional) The dimensions of the tile. If provided, the tool will calculate the center point.

## Prerequisite Output Format

The exported CSV will include a `Prerequisites` column. The main bingo application understands two formats for this column:

1.  **Simple `AND` Logic**: A comma-separated string of `TileID`s.
    - *Example*: `E1,E2`
    - *Meaning*: The tile requires **both** `E1` AND `E2` to be completed.

2.  **Complex `AND`/`OR` Logic**: A JSON string representing an array of arrays. Each inner array is an `AND` group, and these groups are `OR`'d together.
    - *Example*: `[["E1","E2"],["E4"]]`
    - *Meaning*: The tile requires (`E1` AND `E2`) OR (`E4`) to be completed.

### This Tool's Output

This tool is designed to create simple `OR` conditions between adjacent tiles. It exclusively uses the **Complex `AND`/`OR` Logic** format to achieve this.

For each tile, it creates a link to its neighbors. Each neighbor is placed in its own `AND` group.

*Example*: If a tile is linked to `E1` and `E2`, the generated prerequisite will be `[["E1"],["E2"]]`.
*Meaning*: The tile can be unlocked if (`E1` is complete) **OR** (`E2` is complete). This is ideal for setting up initial paths for a tile race or bingo event.