## Overview
This project is a demonstration for the DHSI Course "Digital Humanities Programming Pedagogy in the Age of AI". It showcases AI-assisted coding, code pedagogy concepts, and integration with local LLMs through Ollama.

## Project Structure
```
├── game-content.json    # Game data/content configuration
├── index.html          # Main HTML entry point
├── script.js           # JavaScript application logic
├── style.css           # Styling for the application
├── IMPLEMENTATION_SUMMARY.md  # Implementation details
├── LICENSE             # MIT License
└── README.md           # This file
```

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
     python -m http.server 8000
     
     # Node.js (if http-server is installed)
     http-server -p 8000
     ```

### Working with GitHub Copilot
- Use inline suggestions while editing script.js
- Open Copilot Chat (Ctrl+I) for code explanations
- Ask Copilot to help with:
  - Implementing new features
  - Debugging existing code
  - Writing documentation
  - Optimizing performance

### Ollama Integration
If the project integrates with Ollama:
1. Install Ollama: https://ollama.ai
2. Pull required models:
   ```bash
   ollama pull llama2  # or appropriate model
   ```
3. Ensure Ollama is running locally
4. Check script.js for API endpoint configuration

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

## Development Tips

1. **Check the implementation details** in IMPLEMENTATION_SUMMARY.md
2. **Game content** is configured in game-content.json
3. **Styling** can be modified in style.css
4. **Main logic** is in script.js

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Support
For questions about the DHSI 2025 course or this demonstration, please contact John T. Murray.
