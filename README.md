## Overview
This project is a demonstration for the DHSI Course "Digital Humanities Programming Pedagogy in the Age of AI". It showcases AI-assisted coding, code pedagogy concepts, and integration with local LLMs through Ollama.

---

## 🆕 Recent Updates (Latest)

### Integrated Narrative-Code Design (Implemented Today)

The project now features an innovative **Integrated Narrative-Code Design** that seamlessly blends storytelling with coding education. Dr. Rodriguez's archaeological narrative is woven directly into the coding workflow, providing contextual feedback and progressive story reveals as students write code.

#### New Layout Structure

```
┌─────────────────────────────────────────────┐
│  📜 NARRATIVE STRIP (Always Visible)       │
│  Story Progress | 🎯 Current Objective     │
└─────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────┐
│ 📚 Reference │  💻 Code Panel (Primary)     │
│ (Compact)    │  (Wider, Prominent)          │
│              │                              │
│ Data Card    │  Editor                      │
│ Python Ref   │  Output                      │
│ Discoveries  │  Dr. Rodriguez Reaction      │
└──────────────┴──────────────────────────────┘
```

#### Key Features Implemented

**1. Narrative Strip (Top)**
- Story progress from Dr. Rodriguez
- Current objective display
- Dynamic updates as students progress

**2. Reference Panel (Left - Compact)**
- 📊 Data card with stage-specific data
- 🔍 Collapsible Python quick references
- � Live discoveries log tracking student progress
- Scannable, not overwhelming design

**3. Code Panel (Right - Primary Focus)**
- Wider column (1.5x reference panel)
- 3px border and shadow for visual prominence
- White background for better code contrast
- Integrated code editor

**4. Inline Narrative Reactions**
- 👨‍🔬 Dr. Rodriguez responds to actual code output
- Character avatar with contextual messages
- Appears directly below code execution
- Reactions based on real student results

**5. Excavation Layers UI (Multi-Cell Stages)**
- Progressive unlocking: � → ⚒️ → ✓
- Archaeological metaphor for depth of investigation
- Visual progression feedback
- Automatic transitions on completion

**6. Live Discoveries Tracking**
- Real-time log of student findings
- Animated slide-in entries
- Chronological display

#### JavaScript API Added

Seven new functions for narrative integration:

```javascript
// Display Dr. Rodriguez inline reaction
showInlineNarrative(cellIndex, output, message);

// Add discovery to investigation log
updateDiscoveriesLog(discovery);

// Update top narrative strip
updateNarrativeStrip(storyText, objectiveText);

// Update reference panel data
updateDataCard(stageData);

// Create progressive excavation layers
createExcavationLayers(cells);

// Unlock next layer on success
unlockNextLayer(currentIndex);

// Get contextual narrative response
getNarrativeResponse(stageId, cellIndex, output);
```

#### CSS Enhancements

110+ lines of new CSS including:
- Grid-based responsive layout
- Excavation layers with state transitions
- Inline narrative styling
- Discovery log animations
- Enhanced visual hierarchy

#### Benefits

✅ **Story integrated into workflow** (not separate)  
✅ **Code area is primary visual focus**  
✅ **Reference material is compact and scannable**  
✅ **Narrative responds to actual code behavior**  
✅ **Progressive unlocking provides clear progression**  
✅ **Reduced cognitive load**  
✅ **Enhanced engagement through reactive storytelling**

#### Testing

- **Visual Demo**: Open `narrative-test.html` for interactive demonstration
- **Main App**: All features integrated into `index.html`
- **No Errors**: All syntax and runtime errors resolved

### Bug Fixes (Also Today)

Fixed critical AI features issues:

**1. Model Selection UI Error** ✅
- Fixed incorrect element ID references (`model-info` → `llm-model-info`)
- Added null checks for safety

**2. Missing Methods** ✅
- Added `getRequestMessage()` - generates hint request messages
- Added `getCurrentCode()` - retrieves active editor code
- Added `getLastError()` - finds most recent error in output

**3. Missing Avatar** ✅
- Created `rodriguez-avatar.svg` - scalable vector avatar
- Added fallback to emoji (👨‍🔬) if image fails to load

**4. All AI Features Working** ✅
- Model selection toggle functional
- Character hint requests working
- Quick actions (hint/error/story) operational
- LLM integration fully functional

---

## Project Structure
```
├── game-content.json              # Game data/content configuration
├── index.html                     # Main HTML entry point
├── script.js                      # JavaScript application logic
├── style.css                      # Styling for the application
├── llm-integration.js            # LLM provider integration
├── narrative-test.html            # Visual test for narrative features
├── rodriguez-avatar.svg           # Dr. Rodriguez avatar (SVG)
├── IMPLEMENTATION_SUMMARY.md      # Implementation details
├── LICENSE                        # MIT License
└── README.md                      # This file
```

**Documentation Files** (can be safely removed if desired):
- `NARRATIVE_INTEGRATION_GUIDE.md` - Detailed API documentation
- `IMPLEMENTATION_NARRATIVE_DESIGN.md` - Technical implementation details
- `INTEGRATION_COMPLETE.md` - Feature summary
- `LAYOUT_COMPARISON.md` - Before/after visualization
- `IMPLEMENTATION_CHECKLIST.md` - Complete checklist
- `BUG_FIXES_AI_FEATURES.md` - Bug fix details
- `QUICK_START.md` - Quick reference guide

---

## Local Development Setup

### Prerequisites
- Visual Studio Code
- GitHub Copilot extension
- Git
- Modern web browser
- Ollama (for local LLM integration)

### Getting Started
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AICodePedagogy
   ```

2. **Open in VSCode**
   ```bash
   code .
   ```

3. **Install recommended extensions**
   - GitHub Copilot
   - Live Server (for local development)
   - JavaScript/HTML/CSS language support

4. **Start local development**
   - Right-click on index.html
   - Select "Open with Live Server"
   - Or use any local HTTP server:
     ```bash
     # Python 3
     python -m http.server 8080
     
     # Node.js (if http-server is installed)
     http-server -p 8080
     ```

5. **Test the Narrative Integration**
   - Open http://localhost:8080/narrative-test.html for interactive demo
   - Click buttons to see: inline reactions, discoveries, layer unlocking
   - Open http://localhost:8080/index.html for the full application

### Working with GitHub Copilot
- Use inline suggestions while editing script.js
- Open Copilot Chat (Ctrl+I) for code explanations
- Ask Copilot to help with:
  - Implementing new features
  - Debugging existing code
  - Writing documentation
  - Optimizing performance

### LLM Provider Setup

The application supports multiple AI providers for the coding assistant:

#### Ollama (Local)
1. Install Ollama: https://ollama.ai
2. Pull required models:
   ```bash
   ollama pull llama2  # or appropriate model
   ```
3. Ensure Ollama is running locally
4. Select "Ollama (Local)" in the provider dropdown

#### OpenAI
1. Create an account at https://platform.openai.com
2. Navigate to API Keys: https://platform.openai.com/api-keys
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. In the application:
   - Select "OpenAI" as provider
   - Paste your API key and click "Save"
   - Keys are stored securely in your browser's local storage

#### Anthropic
1. Create an account at https://console.anthropic.com
2. Navigate to API Keys: https://console.anthropic.com/settings/keys
3. Click "Create Key"
4. Copy the key (starts with `sk-ant-`)
5. In the application:
   - Select "Anthropic" as provider
   - Paste your API key and click "Save"
   - Keys are stored securely in your browser's local storage

**Security Note**: API keys are stored in your browser's local storage and never sent to external servers except the respective AI provider's APIs.

---

## Customizing the Narrative Integration

### Adding Custom Narrative Responses

Edit `script.js` around line 2970 to add contextual responses:

```javascript
function getNarrativeResponse(stageId, cellIndex, output) {
  const narratives = {
    1: {  // Stage 1
      0: "Yes! {output} fragments... that matches the constellation count!",
      1: "Excellent! The total is {output} characters."
    },
    2: {  // Stage 2
      0: "Interesting pattern with {output} items...",
      1: "The distribution shows {output} - remarkable!"
    }
  };
  
  if (narratives[stageId] && narratives[stageId][cellIndex]) {
    return narratives[stageId][cellIndex].replace('{output}', output);
  }
  return "Good work! Keep investigating...";
}
```

### Adding Stage Content

In `game-content.json`, add these properties for enhanced narrative integration:

```json
{
  "id": 1,
  "narrativeIntro": "Short intro for narrative strip (100 chars max)",
  "story": "Full story text...",
  "challenge": "Challenge description",
  "data": "Data to analyze",
  "cells": [
    {
      "title": "Fragment Count",
      "layerTitle": "Surface Layer: Fragment Count",
      "layerHint": "Count the total fragments",
      "starterCode": "# Dr. Rodriguez: 'Start counting...'\nfragments = [45, 23, 67]\n",
      "expectedOutput": "3"
    }
  ]
}
```

### Adjusting Visual Design

Modify `style.css` around line 1977 for visual customization:

```css
/* Narrative strip colors */
.narrative-strip {
  background: linear-gradient(135deg, #2c1810 0%, #3d2817 100%);
  padding: 1.5rem;
}

/* Workspace column ratio (adjust 1fr and 1.5fr) */
.workspace {
  grid-template-columns: 1fr 1.5fr;  /* Make reference narrower/wider */
}

/* Reference panel styling */
.reference-panel {
  background: rgba(212, 165, 116, 0.05);
  /* Customize colors, spacing */
}
```

---

## Development Tips

### Quick Reference

**Files Modified Today:**
- `index.html` - New layout structure with narrative strip and workspace
- `style.css` - 110+ lines of new CSS for narrative integration
- `script.js` - Added 7 narrative functions + 3 helper methods
- `llm-integration.js` - Fixed element references and added null checks

**New Files Created:**
- `narrative-test.html` - Interactive demo of narrative features
- `rodriguez-avatar.svg` - Dr. Rodriguez avatar graphic

**Testing:**
- Visual demo: http://localhost:8080/narrative-test.html
- Main app: http://localhost:8080/index.html

### Common Tasks

**Update game content**: Edit `game-content.json`  
**Customize narrative responses**: Edit `getNarrativeResponse()` in `script.js`  
**Adjust layout**: Modify grid values in `.workspace` CSS  
**Style reference panel**: Edit `.reference-panel` classes in `style.css`

---

## Deployment Guide

### Basic Web Server Deployment

1. **Upload files to server**
   ```bash
   scp -r * user@server:/var/www/html/aicodepedagogy/
   ```

2. **Set appropriate permissions**
   ```bash
   chmod -R 755 /var/www/html/aicodepedagogy/
   ```

### CORS Configuration for API Access

If your application needs to access localhost APIs (like Ollama) from a deployed server:

#### Nginx Configuration
Add to your server block in `/etc/nginx/sites-available/your-site`:
```nginx
location /api/ {
    # Proxy to local Ollama or other services
    proxy_pass http://localhost:11434/;
    
    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, Content-Type, Accept, Authorization' always;
    
    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

#### Apache Configuration
Add to your `.htaccess` or virtual host configuration:
```apache
<Location /api>
    ProxyPass http://localhost:11434/
    ProxyPassReverse http://localhost:11434/
    
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, OPTIONS"
    Header always set Access-Control-Allow-Headers "Origin, Content-Type, Accept, Authorization"
    
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^(.*)$ $1 [R=204,L]
</Location>
```

### Security Considerations
⚠️ **Important**: The CORS configurations above use wildcard (`*`) for demonstration. In production:
- Replace `*` with specific allowed origins
- Implement proper authentication
- Use HTTPS for all communications
- Restrict API access as needed

---

## Troubleshooting

### Common Issues

**Narrative strip not updating?**
- Check that `updateNarrativeStrip()` is called during stage load
- Verify elements exist: `#story-progress`, `#current-objective`

**Inline reactions not appearing?**
- Ensure output area has correct ID: `output-${cellIndex}` or similar
- Check that `showInlineNarrative()` is called after code execution
- Verify the narrative response function returns a valid message

**Layers not unlocking?**
- Confirm `unlockNextLayer()` is called on successful cell completion
- Check layer elements have correct IDs: `layer-${index}`
- Ensure cells are executing successfully before unlocking

**AI features not working?**
- All AI features were fixed today - refresh browser cache (Ctrl+F5)
- Check browser console for any remaining errors
- Verify LLM provider is properly configured
- For Ollama: ensure service is running (`ollama serve`)

**Avatar not displaying?**
- SVG avatar (`rodriguez-avatar.svg`) created as fallback
- Emoji (👨‍🔬) displays if SVG fails to load
- Check browser console for 404 errors

**Discovery log not updating?**
- Verify element exists: `#live-discoveries`
- Check that `updateDiscoveriesLog()` is being called
- Ensure CSS animations are enabled in browser

---

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Support
For questions about the DHSI 2025 course or this demonstration, please contact John T. Murray.

## Acknowledgments
- Archaeological narrative design concept
- Google Colab-inspired UI elements
- Integration with Skulpt for client-side Python execution
- Support for multiple LLM providers (Ollama, OpenAI, Anthropic)
