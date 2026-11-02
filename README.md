# Pump Curve Navigator

> **Note:** This project is currently in development. New features are being added, and it is currently undergoing testing for bugs.

> **Vibe Coded:** This project was entirely vibe coded, using gemma4:31b-mlx with OpenCode.

## Description

The **Pump Curve Navigator** is a specialized tool designed to extract and analyze data from pump performance curve images. By allowing users to calibrate an uploaded image, the tool transforms a static graph into an interactive data-acquisition interface.

### Key Features:
- **Image Analysis:** Upload images of pump curves for digital analysis.
- **Calibration Wizard:** A guided process to set the global origin and reference points for flow and head, ensuring accurate data extraction.
- **Interactive Sampling:** Switch to "Analyze" mode to click anywhere on the curve and instantly retrieve the corresponding flow and head values.
- **Unit Conversion:** Support for various units (meters, feet, m³/s, gal/min, etc.) with built-in conversion logic.
- **Profile Management:** Save and load calibration profiles via a connected backend, allowing for quick switching between different pump models.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- npm (installed with Node.js)

### Running the Backend
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node index.js
   ```
   The server will start on `http://localhost:3001`.

### Running the Frontend
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the URL provided by Vite (usually `http://localhost:5173`).

## Development Environment
This project was developed on **macOS 27** on a Mac Mini M5 Pro with 48GB of RAM.
