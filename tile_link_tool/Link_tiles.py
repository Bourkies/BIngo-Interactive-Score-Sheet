# link_tiles.py

# It's crucial to initialize tkinter and its root window *before* importing
# matplotlib.pyplot. Pyplot may implicitly create its own tkinter root when
# imported, which can conflict with the one created later in the script,
# leading to unexpected behavior like hanging dialogs.
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# Create and hide the root window immediately. This instance will be used by
# both the script's dialogs and implicitly by matplotlib if it uses the TkAgg backend.
root = tk.Tk()
root.withdraw()

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Button, RadioButtons, RangeSlider, CheckButtons
import csv, logging
import json
import os
from scipy.spatial import KDTree

class SetupDialog(tk.Toplevel):
    """A modal dialog to get column configuration from the user."""
    def __init__(self, parent, columns):
        super().__init__(parent)
        self.transient(parent)
        self.title("Select Columns")
        self.result = None
        self.columns = [''] + columns  # Add a blank option

        tk.Label(self, text="Please map your CSV columns:").grid(row=0, column=0, columnspan=2, padx=10, pady=10)

        self.mappings = {}
        # Separate required and optional fields for clarity
        required_fields = {"Tile ID": "id_col", "Top Coordinate": "top_col", "Left Coordinate": "left_col"}
        optional_fields = {"Width (optional)": "width_col", "Height (optional)": "height_col"}
        all_fields = {**required_fields, **optional_fields}

        row_index = 1
        for label, key in all_fields.items():
            tk.Label(self, text=f"{label}:").grid(row=row_index, column=0, padx=10, pady=5, sticky='w')
            self.mappings[key] = ttk.Combobox(self, values=self.columns, state="readonly")
            self.mappings[key].grid(row=row_index, column=1, padx=10, pady=5, sticky='ew')
            row_index += 1

        # Add the OK button to confirm selections
        ok_button = ttk.Button(self, text="OK", command=self.on_ok)
        ok_button.grid(row=row_index, column=0, columnspan=2, pady=10)

        # The following is necessary to make a modal Toplevel dialog appear and
        # function correctly when its parent (the root window) is withdrawn.
        self.protocol("WM_DELETE_WINDOW", self.on_cancel)
        self.update_idletasks() # Force geometry calculation

        # Center the dialog on the screen
        x = (self.winfo_screenwidth() // 2) - (self.winfo_reqwidth() // 2)
        y = (self.winfo_screenheight() // 2) - (self.winfo_reqheight() // 2)
        self.geometry(f'+{x}+{y}')

        self.deiconify() # Show the window (it's withdrawn by default if parent is)
        self.grab_set()  # Make modal
        self.wait_window(self)

    def on_ok(self):
        self.result = {key: combo.get() for key, combo in self.mappings.items()}
        if not all([self.result["id_col"], self.result["top_col"], self.result["left_col"]]):
            messagebox.showerror("Error", "Tile ID, Top, and Left columns must be selected.", parent=self)
            self.result = None
            return
        self.destroy()

    def on_cancel(self):
        self.result = None
        self.destroy()

class HexLinkerUI:
    """
    A UI tool to visually define and export adjacency-based prerequisites
    for a hex tile board.
    """
    def __init__(self):
        self.tiles_df = pd.DataFrame()
        self.id_col = self.top_col = self.left_col = self.width_col = self.height_col = self.desc_col = None
        self.adjacencies = {}
        self.lines = []
        self.start_tiles = set()
        self.bg_image = None
        self.coords = None
        self.kdtree = None
        self.coord_map = {}
        self.selected_tile = None
        self.selected_tile_marker = None
        self.edit_mode = 'Auto'
        self.scatter = None
        self.tile_texts = []

        self.setup_ui()
        logging.info("HexLinkerUI initialized in empty state.")

    def prepare_data(self):
        """Prepares data structures for the UI."""
        logging.info(f"Preparing data for {len(self.tiles_df)} tiles.")
        # Identify starting tiles to exclude them from prerequisites later
        self.start_tiles = set()
        if self.desc_col and self.desc_col in self.tiles_df.columns:
            self.start_tiles = set(
                self.tiles_df[self.tiles_df[self.desc_col].str.contains('start', na=False, case=False)][self.id_col]
            )
            logging.info(f"Found {len(self.start_tiles)} starting tiles: {self.start_tiles if self.start_tiles else 'None'}")
        else:
            logging.warning("Description column not specified or found. No start tiles will be identified.")

        # Initialize adjacency list for all tiles
        for tile_id in self.tiles_df[self.id_col]:
            self.adjacencies[tile_id] = set()

        # This will build the coordinate-based structures, scaling if needed
        self._rebuild_spatial_data()
        logging.info("Data preparation complete.")

    def _rebuild_spatial_data(self):
        """
        Builds coordinate-dependent data structures (self.coords, self.kdtree, self.coord_map).
        This method accounts for whether a background image is present, scaling coordinates
        from percentages if necessary.
        """
        if self.tiles_df.empty:
            self.coords = None
            self.kdtree = None
            self.coord_map = {}
            return

        left = self.tiles_df[self.left_col].values
        top = self.tiles_df[self.top_col].values

        # Check for optional width and height columns to calculate center points
        use_centering = (self.width_col and self.width_col in self.tiles_df.columns and
                         self.height_col and self.height_col in self.tiles_df.columns)

        if use_centering:
            logging.info("Width and Height columns provided. Calculating tile centers.")
            # Use fillna(0) so that rows missing these optional values don't break the calculation
            width = self.tiles_df[self.width_col].fillna(0).values
            height = self.tiles_df[self.height_col].fillna(0).values
            left = left + width / 2.0
            top = top + height / 2.0
        else:
            logging.info("Using top/left coordinates directly (no width/height provided).")

        if self.bg_image:
            logging.info("Scaling coordinates to background image dimensions (assuming percentages).")
            h, w, _ = self.bg_image.get_array().shape
            # Assuming coordinates are percentages (0-100), scale them to image pixels
            scaled_left = (left / 100.0) * w
            scaled_top = (top / 100.0) * h
            self.coords = np.vstack([scaled_left, scaled_top]).T
        else:
            logging.info("Using raw coordinates (no background image).")
            # Use raw coordinates directly
            self.coords = np.vstack([left, top]).T

        self.kdtree = KDTree(self.coords)
        self.coord_map = dict(zip(self.tiles_df[self.id_col], self.coords))
        logging.info("Rebuilt spatial data structures (KDTree, coord_map).")

    def setup_ui(self):
        """Initializes the matplotlib plot and widgets."""
        self.fig, self.ax = plt.subplots(figsize=(15, 12))
        plt.subplots_adjust(left=0.18, bottom=0.2, right=0.98, top=0.95)

        self.ax.set_title('Hex Tile Adjacency Linker - Please Load a CSV')
        self.ax.set_xlabel('Left Coordinate')
        self.ax.set_ylabel('Top Coordinate')
        self.ax.invert_yaxis() # Always use an inverted Y-axis (0 at top)
        self.ax.set_aspect('equal', adjustable='box')
        self.ax.grid(True, linestyle='--', alpha=0.6)

        # Slider for distance threshold
        ax_slider = plt.axes([0.25, 0.1, 0.55, 0.03])
        self.slider = RangeSlider(ax=ax_slider, label='Distance Range', valmin=0, valmax=200, valinit=(0, 6.5))
        self.slider.on_changed(self.update_links_by_distance)
        self.slider.ax.set_visible(False) # Hide until data is loaded

        # Load CSV Button
        ax_load_button = plt.axes([0.025, 0.9, 0.12, 0.04])
        self.load_button = Button(ax_load_button, 'Load CSV')
        self.load_button.on_clicked(self.load_data_flow)

        # Load BG Image Button
        ax_load_bg_button = plt.axes([0.025, 0.84, 0.12, 0.04])
        self.load_bg_button = Button(ax_load_bg_button, 'Load BG Image')
        self.load_bg_button.on_clicked(self.load_bg_image)

        # Export Button
        ax_export_button = plt.axes([0.85, 0.025, 0.1, 0.04])
        self.button = Button(ax_export_button, 'Export CSV')
        self.button.on_clicked(self.export_csv)
        self.button.ax.set_visible(False) # Hide until data is loaded

        # Mode selection Radio Buttons
        ax_radio = plt.axes([0.025, 0.7, 0.12, 0.12])
        self.radio = RadioButtons(ax_radio, ('Auto', 'Add Link', 'Remove Link'))
        # Explicitly set label properties to avoid rendering glitches where
        # labels might not appear on some backends or configurations.
        for label in self.radio.labels:
            label.set_color('black')
            label.set_zorder(10)
        self.radio.on_clicked(self.set_mode)
        self.radio.ax.set_visible(False) # Hide until data is loaded

        # Connect canvas click event
        self.fig.canvas.mpl_connect('button_press_event', self.on_click)

        plt.show()

    def plot_data(self):
        """Clears the axes and plots the current tile data."""
        # Clear previous scatter/text
        if self.scatter:
            self.scatter.remove()
        for text in self.tile_texts:
            text.remove()
        self.tile_texts.clear()

        if self.tiles_df.empty:
            self.ax.set_title('Hex Tile Adjacency Linker - Please Load a CSV')
            self.fig.canvas.draw_idle()
            return

        self.ax.set_title('Hex Tile Adjacency Linker')
        self.ax.set_xlabel(self.left_col)
        self.ax.set_ylabel(self.top_col)

        # Plot tiles as dots with labels using the potentially scaled coordinates
        self.scatter = self.ax.scatter(self.coords[:, 0], self.coords[:, 1], s=50, zorder=5)
        for i, row in self.tiles_df.iterrows():
            # Use the index to get the correct scaled coordinate
            x, y = self.coords[i]
            # Offset for text should be relative to axis scale to look good at any zoom
            offset = max(self.ax.get_xlim()) * 0.002
            text = self.ax.text(x + offset, y + offset, row[self.id_col], fontsize=8, zorder=6,
                               bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', boxstyle='round,pad=0.2'))
            self.tile_texts.append(text)

        self.apply_view_settings()

    def apply_view_settings(self):
        """Applies axis limits, inversion, and aspect ratio."""
        if self.bg_image:
            h, w, _ = self.bg_image.get_array().shape
            self.ax.set_xlim(0, w)
            self.ax.set_ylim(h, 0) # imshow extent already handles inversion, this syncs the axis
        else:
            self.ax.relim()
            self.ax.autoscale_view()

        self.ax.set_aspect('equal', adjustable='box')
        self.fig.canvas.draw_idle()
    def load_data_flow(self, event):
        """Handles the entire process of loading and setting up data from a CSV."""
        logging.info("Load data flow started.")
        csv_path = filedialog.askopenfilename(
            title="Select your tiles CSV file",
            filetypes=[("CSV files", "*.csv")]
        )
        if not csv_path:
            logging.warning("No file selected during load.")
            return

        try:
            logging.info(f"User selected file: {csv_path}")
            df = pd.read_csv(csv_path)
            logging.info(f"CSV loaded successfully. Shape: {df.shape}. Columns: {df.columns.tolist()}")
        except Exception as e:
            logging.error(f"Failed to read or process CSV file: {e}", exc_info=True)
            messagebox.showerror("Error", f"Failed to read or process CSV file:\n{e}", parent=root)
            return

        # The dialog should be parented to the matplotlib window, not the hidden
        # root window, to ensure it appears correctly and is modal to the app.
        try:
            # This works for TkAgg backend
            dialog_parent = self.fig.canvas.manager.window
        except AttributeError:
            dialog_parent = root # Fallback for other backends

        dialog = SetupDialog(dialog_parent, df.columns.tolist())
        config = dialog.result

        if not config:
            logging.warning("Column selection cancelled.")
            return

        logging.info(f"User selected column mappings: {config}")

        # --- Data is loaded and configured, now update the UI state ---
        self.tiles_df = df
        self.id_col = config["id_col"]
        self.top_col = config["top_col"]
        self.left_col = config["left_col"]
        self.width_col = config.get("width_col")
        self.height_col = config.get("height_col")
        self.desc_col = None # Description column is no longer selected by user
        # Coerce selected coordinate columns to numeric and drop invalid rows
        coord_cols = [self.top_col, self.left_col]
        if self.width_col:
            coord_cols.append(self.width_col)
        if self.height_col:
            coord_cols.append(self.height_col)

        for col in coord_cols:
            if col and col in self.tiles_df.columns:
                self.tiles_df[col] = pd.to_numeric(self.tiles_df[col], errors='coerce')

        initial_rows = len(self.tiles_df)
        self.tiles_df.dropna(subset=[self.top_col, self.left_col], inplace=True)
        self.tiles_df.reset_index(drop=True, inplace=True)
        dropped_rows = initial_rows - len(self.tiles_df)
        if dropped_rows > 0:
            logging.warning(f"Dropped {dropped_rows} rows with non-numeric or missing coordinate values.")

        # If a background image was loaded, remove it for the new data
        if self.bg_image:
            self.bg_image.remove()
            self.bg_image = None

        # Reset state and prepare new data
        for line in self.lines:
            line.remove()
        self.lines.clear()
        self.adjacencies.clear()
        self.prepare_data()
        self.plot_data()

        # Dynamically adjust the slider range based on the data's scale
        if not self.bg_image:
            # If no background image, scale is based on raw coordinate range
            if self.coords is not None and len(self.coords) > 1:
                min_coords = self.coords.min(axis=0)
                max_coords = self.coords.max(axis=0)
                data_width = max_coords[0] - min_coords[0]
                data_height = max_coords[1] - min_coords[1]
                # Use the larger of width/height as a basis for max distance
                max_dim = max(data_width, data_height)
                if max_dim > 0:
                    slider_max = max_dim * 0.25 # Set max to 25% of the data spread
                    self.slider.valmax = slider_max
                    self.slider.ax.set_xlim(0, slider_max)
                    # Set a sensible initial range, e.g., up to 50% of the new slider max
                    self.slider.set_val((0, slider_max * 0.5))
                    logging.info(f"Slider range updated for raw coordinates. Max: {slider_max:.2f}")

        # Enable UI controls
        self.slider.ax.set_visible(True)
        self.button.ax.set_visible(True)
        self.radio.ax.set_visible(True)
        self.set_mode(self.radio.value_selected) # Set mode to current radio button value

        # Trigger initial link calculation
        self.update_links_by_distance(self.slider.val)
        logging.info("Data loaded and UI updated.")

    def load_bg_image(self, event):
        """Loads a background image onto the plot canvas."""
        img_path = filedialog.askopenfilename(
            title="Select a background image",
            filetypes=[("Image files", "*.png *.jpg *.jpeg *.bmp *.gif"), ("All files", "*.*")]
        )
        if not img_path:
            logging.warning("No background image selected.")
            return

        try:
            img = plt.imread(img_path)
            logging.info(f"Loaded background image: {img_path} with dimensions {img.shape}")

            # Remove previous background image if it exists
            if self.bg_image:
                self.bg_image.remove()

            # Display the image, ensuring it's behind other plot elements
            h, w, _ = img.shape
            self.bg_image = self.ax.imshow(img, extent=[0, w, h, 0], aspect='equal', zorder=0)

            # Update slider max value based on image dimensions for a sensible range
            slider_max = max(w, h) * 0.25 # Max distance is 25% of the largest image dimension
            self.slider.valmax = slider_max
            self.slider.ax.set_xlim(0, slider_max)
            # Reset slider value to something reasonable for the new scale (40% of the new max)
            self.slider.set_val((0, slider_max * 0.4))

            if not self.tiles_df.empty:
                logging.info("Data present, rebuilding spatial data and replotting.")
                self._rebuild_spatial_data()
                self.plot_data() # Re-plot tiles at new scaled positions
                self.update_links_by_distance(self.slider.val)
            else:
                # If no data, just set the view
                self.apply_view_settings()

            logging.info("Background image loaded and plot updated.")

        except Exception as e:
            logging.error(f"Failed to load or display background image: {e}", exc_info=True)
            messagebox.showerror("Error", f"Failed to load background image:\n{e}", parent=root)

    def set_mode(self, label):
        """Callback for the radio buttons to change the edit mode."""
        logging.info(f"Mode changed to: '{label}'")
        self.edit_mode = label
        self.slider.ax.set_visible(label == 'Auto' and not self.tiles_df.empty)
        self.clear_selection()
        if label == 'Auto' and not self.tiles_df.empty:
            self.update_links_by_distance(self.slider.val)
        self.fig.canvas.draw_idle()

    def get_tile_at(self, x, y):
        """Finds the nearest tile to a click coordinate if it's close enough."""
        if x is None or y is None or self.kdtree is None:
            return None
        dist, idx = self.kdtree.query([x, y])
        # Click tolerance is 1% of the axis range
        click_tolerance = max(self.ax.get_xlim()) * 0.01
        if dist < click_tolerance:
            return self.tiles_df.iloc[idx][self.id_col]
        return None

    def on_click(self, event):
        """Handles mouse clicks on the canvas for manual linking."""
        if event.inaxes != self.ax or self.edit_mode == 'Auto' or self.tiles_df.empty:
            self.clear_selection()
            return

        clicked_tile_id = self.get_tile_at(event.xdata, event.ydata)

        if not clicked_tile_id:
            self.clear_selection()
            return

        if not self.selected_tile:
            # This is the first tile selected
            self.selected_tile = clicked_tile_id
            self.highlight_selection()
        else:
            # This is the second tile, complete the link/unlink action
            id1, id2 = self.selected_tile, clicked_tile_id
            if id1 == id2: # Clicked the same tile twice
                self.clear_selection()
                return

            if self.edit_mode == 'Add Link':
                self.adjacencies[id1].add(id2)
                self.adjacencies[id2].add(id1)
                logging.info(f"Manually added link: {id1} <-> {id2}")
            elif self.edit_mode == 'Remove Link':
                self.adjacencies[id1].discard(id2)
                self.adjacencies[id2].discard(id1)
                logging.info(f"Manually removed link: {id1} <-> {id2}")

            self.clear_selection()
            self.redraw_canvas()

    def highlight_selection(self):
        """Visually marks the currently selected tile."""
        if self.selected_tile_marker:
            self.selected_tile_marker.remove()

        idx = self.tiles_df[self.tiles_df[self.id_col] == self.selected_tile].index[0]
        x, y = self.coords[idx]
        self.selected_tile_marker = self.ax.scatter(x, y, s=150, facecolors='none', edgecolors='cyan', linewidths=2, zorder=10)
        self.fig.canvas.draw_idle()

    def clear_selection(self):
        """Removes the visual marker from the selected tile."""
        if self.selected_tile_marker:
            self.selected_tile_marker.remove()
            self.selected_tile_marker = None
        self.selected_tile = None
        self.fig.canvas.draw_idle()

    def redraw_canvas(self):
        """Clears and redraws all lines based on the current adjacencies."""
        # Clear previous lines from the plot
        for line in self.lines:
            line.remove()
        self.lines.clear()

        if self.tiles_df.empty:
            self.fig.canvas.draw_idle()
            return

        drawn_pairs = set()
        for id1, neighbors in self.adjacencies.items():
            for id2 in neighbors:
                # Avoid drawing the same line twice
                if tuple(sorted((id1, id2))) in drawn_pairs:
                    continue

                pos1 = self.coord_map.get(id1)
                pos2 = self.coord_map.get(id2)

                if pos1 is None or pos2 is None:
                    logging.warning(f"Could not find coordinates for link between {id1} and {id2}. Skipping.")
                    continue

                line, = self.ax.plot([pos1[0], pos2[0]], [pos1[1], pos2[1]], 'r-', alpha=0.7, lw=1.5, zorder=1)
                self.lines.append(line)
                drawn_pairs.add(tuple(sorted((id1, id2))))

        self.fig.canvas.draw_idle()

    def update_links_by_distance(self, distance_range):
        """Calculates adjacencies based on a distance range and redraws the plot."""
        if self.tiles_df.empty or self.kdtree is None:
            return

        min_dist, max_dist = distance_range
        logging.info(f"Auto-linking with distance range: [{min_dist:.2f}, {max_dist:.2f}]")

        # Initialize/clear adjacencies for all tiles
        for tile_id in self.tiles_df[self.id_col]:
            self.adjacencies[tile_id] = set()

        # Use the KDTree to find all pairs of points within the MAX distance.
        pairs = self.kdtree.query_pairs(r=max_dist)

        # Get a mapping from dataframe index to tile ID for quick lookups
        tile_ids = self.tiles_df[self.id_col].values

        link_count = 0
        for i, j in pairs:
            # Filter by MIN distance by calculating the precise distance
            dist = np.linalg.norm(self.coords[i] - self.coords[j])
            if dist >= min_dist:
                id1 = tile_ids[i]
                id2 = tile_ids[j]
                self.adjacencies[id1].add(id2)
                self.adjacencies[id2].add(id1)
                link_count += 1

        logging.info(f"Found {link_count} links within the specified range.")
        self.redraw_canvas()

    def export_csv(self, event):
        """Exports the full dataframe with updated prerequisites to a new CSV."""
        if self.tiles_df.empty:
            messagebox.showwarning("No Data", "Please load a CSV file before exporting.", parent=root)
            logging.warning("Export attempted with no data loaded.")
            return

        logging.info("'Export CSV' button clicked. Opening save file dialog.")
        # Ask user where to save the file
        save_path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            title="Save Updated Tiles CSV",
            initialfile="tiles_with_prerequisites.csv"
        )

        if not save_path:
            messagebox.showinfo("Cancelled", "Export cancelled.", parent=root)
            logging.warning("Export cancelled by user.")
            return

        output_data = []
        export_df = self.tiles_df.copy()

        prereq_map = {}
        for tile_id, neighbors in self.adjacencies.items():
            if tile_id not in self.start_tiles and neighbors:
                # Each neighbor is a separate "OR" condition, meaning any one of them can unlock this tile.
                # The format [["E1"],["E2"]] means (E1) OR (E2).
                or_groups = [[str(neighbor)] for neighbor in sorted(list(neighbors))]
                prereq_map[tile_id] = json.dumps(or_groups, separators=(',', ':'))

        # Map the generated prerequisites to the dataframe
        # Ensure a 'Prerequisites' column exists
        if 'Prerequisites' not in export_df.columns:
            export_df['Prerequisites'] = ''
        export_df['Prerequisites'] = export_df[self.id_col].map(prereq_map).fillna(export_df['Prerequisites'])

        try:
            # Use pandas to_csv which handles quoting correctly
            export_df.to_csv(save_path, index=False, quoting=csv.QUOTE_ALL)
            logging.info(f"Successfully exported updated tile data to: {save_path}")
            messagebox.showinfo("Success", f"Successfully exported updated tile data to:\n{save_path}", parent=root)
        except Exception as e:
            logging.error(f"Failed to write CSV file: {e}", exc_info=True)
            messagebox.showerror("Error", f"Failed to write CSV file:\n{e}", parent=root)

if __name__ == '__main__':
    # Use a Tkinter root for file dialogs, but hide the main window
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    # The root window is now created at the top of the script, before other imports.
    logging.info("Application starting...")
    logging.info("Initializing main UI.")
    app = HexLinkerUI()
