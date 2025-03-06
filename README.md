# LinkedIn Analyzer

A Chrome extension that collects and analyzes your LinkedIn feed, providing insights and summaries using AI.

## Features

- **Feed Collection**: Automatically collects posts from your LinkedIn feed
- **Data Analysis**: Analyzes collected posts to identify trends and patterns
- **AI-Powered Summaries**: Generates insightful summaries using OpenAI or Claude models
- **Engagement Tracking**: Tracks likes, comments, and other engagement metrics
- **Export Options**: Export your data in various formats (JSON, CSV, TXT)
- **Custom Prompts**: Use custom prompts for AI-generated summaries

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The LinkedIn Analyzer extension should now be installed and visible in your Chrome toolbar

## Usage

1. Navigate to LinkedIn and log in to your account
2. Click the LinkedIn Analyzer icon in your Chrome toolbar
3. Click "Start Collection" to begin collecting posts from your feed
4. Browse your LinkedIn feed as you normally would
5. Return to the extension popup to view collected posts or generate summaries
6. Use the "Generate Summary" button to create an AI-powered analysis of your feed

## Configuration

### OpenAI Integration

1. Go to the Options page by right-clicking the extension icon and selecting "Options"
2. Enter your OpenAI API key
3. Select your preferred model
4. Enter a custom default prompt (optional)
5. Click "Save Settings"

## Data Privacy

All data is stored locally in your browser using Chrome's storage API. No data is sent to any servers except when using the OpenAI/Claude API for generating summaries.

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 