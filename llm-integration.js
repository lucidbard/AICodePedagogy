/**
 * LLMIntegration - Complete implementation with browser environment detection
 * This module contains the LLMIntegration class that can be safely imported in Node.js
 * by detecting the environment and only executing browser-dependent code when appropriate
 */

class LLMIntegration {
  constructor() {
    this.selectedModel = null;
    this.models = [];
    this.provider = 'ollama'; // Default to ollama

    // Set Ollama URL based on current host
    // If served from a remote host, use that host for Ollama
    // Otherwise default to localhost
    if (this.isBrowserEnvironment()) {
      const currentHost = window.location.hostname;
      const currentProtocol = window.location.protocol;

      // If not on localhost, use the current host for Ollama
      if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        this.ollamaBaseUrl = `${currentProtocol}//${currentHost}:11434`;
      } else {
        this.ollamaBaseUrl = 'http://localhost:11434';
      }
    } else {
      this.ollamaBaseUrl = 'http://localhost:11434';
    }

    // Only run browser-dependent initialization if in browser environment
    if (this.isBrowserEnvironment()) {
      this.apiKeys = this.loadApiKeys();
      this.setupEventListeners();

      // Show the footer by default (remove hidden class)
      const footer = document.querySelector('.llm-footer');
      if (footer) {
        footer.classList.remove('hidden');
      }
    } else {
      // Node.js environment - minimal initialization
      this.apiKeys = {};
    }
  }

  /**
   * Check if we're running in a browser environment
   */
  isBrowserEnvironment() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  init() {
    if (!this.isBrowserEnvironment()) return;

    // Hide footer by default
    const footer = document.querySelector('.llm-footer');
    // if (footer) footer.classList.add('hidden')

    this.setupEventListeners();

    // Check initial toggle state and initialize if enabled
    const toggle = document.getElementById('llm-enabled');
    if (toggle && toggle.checked) {
      this.toggleLLM(true);
    } else {
      this.isEnabled = false;
    }
  }

  setupEventListeners() {
    if (!this.isBrowserEnvironment()) return;
    
    const toggle = document.getElementById('llm-enabled');
    const modelSelect = document.getElementById('model-select');
    const refreshBtn = document.getElementById('refresh-models');
    const changeModelBtn = document.getElementById('change-model');
    const providerSelect = document.getElementById('provider-select');

    toggle.addEventListener('change', e => {
      this.toggleLLM(e.target.checked);
    });

    modelSelect.addEventListener('change', e => {
      this.selectedModel = e.target.value;
      if (this.selectedModel) {
        this.updateModelInfo();
        this.updateStatus('connected', `Connected to ${this.selectedModel}`);
        this.updateQueryButtonStates();
        this.updateHintSystem();
        this.hideModelSelection();
      }
    });

    refreshBtn.addEventListener('click', () => {
      this.loadModels();
    });

    changeModelBtn.addEventListener('click', () => {
      this.showModelSelection();
    });

    if (providerSelect) {
      providerSelect.addEventListener('change', e => {
        this.provider = e.target.value;
        this.updateProviderUI();
        this.loadModels();
      });
    }
  }

  loadApiKeys() {
    if (!this.isBrowserEnvironment()) return {};
    
    try {
      const keys = localStorage.getItem('aicodepedagogy_api_keys');
      return keys ? JSON.parse(keys) : {};
    } catch (error) {
      console.error('Failed to load API keys:', error);
      return {};
    }
  }

  saveApiKeys() {
    if (!this.isBrowserEnvironment()) return;
    
    try {
      localStorage.setItem(
        'aicodepedagogy_api_keys',
        JSON.stringify(this.apiKeys)
      );
    } catch (error) {
      console.error('Failed to save API keys:', error);
    }
  }

  updateProviderUI() {
    if (!this.isBrowserEnvironment()) return;
    
    const apiKeyContainer = document.getElementById('api-key-container');
    const providerSelect = document.getElementById('provider-select');

    if (this.provider === 'openai' || this.provider === 'anthropic') {
      apiKeyContainer.style.display = 'block';
      this.setupApiKeyInput();
    } else {
      apiKeyContainer.style.display = 'none';
    }

    // Update model select options based on provider
    this.loadModels();
  }

  setupApiKeyInput() {
    if (!this.isBrowserEnvironment()) return;
    
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-api-key');

    // Load existing key
    if (this.apiKeys[this.provider]) {
      apiKeyInput.value = this.apiKeys[this.provider];
    }

    saveKeyBtn.onclick = () => {
      this.apiKeys[this.provider] = apiKeyInput.value;
      this.saveApiKeys();
      this.updateStatus('info', 'API key saved');
    };
  }

  toggleLLM(enabled) {
    if (!this.isBrowserEnvironment()) return;

    const settings = document.getElementById('llm-settings');
    const footer = document.querySelector('.llm-footer');

    if (enabled) {
      settings.style.display = 'block';
      // if (footer) footer.classList.remove('hidden')
      this.updateProviderUI();
      this.loadModels();
      if (this.selectedModel) {
        this.updateHintSystem();
      }
    } else {
      settings.style.display = 'none';
      // if (footer) footer.classList.add('hidden')
    }

    this.isEnabled = enabled;
    this.updateQueryButtonStates();
  }

  showModelSelection() {
    if (!this.isBrowserEnvironment()) return;
    
    const selection = document.getElementById('model-selection');
    const info = document.getElementById('model-info');
    selection.style.display = 'block';
    info.style.display = 'none';
  }

  hideModelSelection() {
    if (!this.isBrowserEnvironment()) return;
    
    const selection = document.getElementById('model-selection');
    const info = document.getElementById('model-info');
    selection.style.display = 'none';
    info.style.display = 'block';
  }

  updateModelInfo() {
    if (!this.isBrowserEnvironment()) return;
    
    const modelInfo = document.getElementById('current-model');
    if (modelInfo && this.selectedModel) {
      modelInfo.textContent = this.selectedModel;
      this.isConnected = true;
    }
  }

  updateStatus(type, message) {
    if (!this.isBrowserEnvironment()) return;
    
    const status = document.getElementById('llm-status');
    status.className = `llm-status ${type}`;
    status.textContent = message;
  }

  async loadModels() {
    if (!this.isBrowserEnvironment()) return;
    
    this.updateStatus('loading', 'Loading models...');

    try {
      let models = [];

      if (this.provider === 'ollama') {
        const response = await fetch(`${this.ollamaBaseUrl}/api/tags`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        models = data.models.map(model => model.name);
      } else if (this.provider === 'openai') {
        // OpenAI models are predefined since we can't query them without API call
        models = ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'];
      } else if (this.provider === 'anthropic') {
        // Anthropic models are predefined
        models = ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];
      }

      this.models = models;
      this.updateModelSelect();

      if (models.length > 0) {
        this.updateStatus('success', `Found ${models.length} models`);
      } else {
        this.updateStatus('warning', 'No models found');
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      this.updateStatus('error', `Failed to connect: ${error.message}`);
      this.models = [];
      this.updateModelSelect();
    }
  }

  updateModelSelect() {
    if (!this.isBrowserEnvironment()) return;
    
    const select = document.getElementById('model-select');
    select.innerHTML = '<option value="">Select a model...</option>';

    this.models.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      select.appendChild(option);
    });

    // Restore previously selected model if available
    if (this.selectedModel && this.models.includes(this.selectedModel)) {
      select.value = this.selectedModel;
    }
  }

  updateQueryButtonStates() {
    if (!this.isBrowserEnvironment()) return;
    
    const queryButtons = document.querySelectorAll('.llm-query-button');
    queryButtons.forEach(button => {
      button.disabled = !this.selectedModel;
    });
  }

  updateHintSystem() {
    if (!this.isBrowserEnvironment()) return;
    
    const hintContainer = document.getElementById('hint-text-container');
    if (!hintContainer) return;

    // Clear existing query buttons
    const existingButtons = hintContainer.querySelectorAll('.llm-query-button');
    existingButtons.forEach(button => button.remove());

    if (!this.isEnabled || !this.selectedModel) {
      return;
    }

    // Add query buttons
    const queryButtons = [
      { text: '💡 Get a hint', type: 'hint' },
      { text: '🔧 Debug my code', type: 'debug' },
      { text: '📖 Explain concept', type: 'explain' }
    ];

    queryButtons.forEach(button => {
      const btn = document.createElement('button');
      btn.className = 'llm-query-button';
      btn.textContent = button.text;
      btn.onclick = () => this.queryLLM(button.type);
      btn.disabled = !this.selectedModel;
      hintContainer.appendChild(btn);
    });
  }

  async queryLLM(type) {
    if (!this.isBrowserEnvironment()) return;
    
    if (!this.selectedModel) {
      this.showLLMResponse('error', 'No model selected');
      return;
    }

    this.showLLMResponse('loading', 'Thinking...');

    try {
      const context = this.gatherContext();
      const prompt = this.buildPrompt(type, context);

      let response;
      if (this.provider === 'ollama') {
        response = await this.queryOllama(prompt);
      } else if (this.provider === 'openai') {
        response = await this.queryOpenAI(prompt);
      } else if (this.provider === 'anthropic') {
        response = await this.queryAnthropic(prompt);
      }

      this.showLLMResponse('success', response);
    } catch (error) {
      console.error('LLM query failed:', error);
      this.showLLMResponse('error', `Failed to get response: ${error.message}`);
    }
  }

  gatherContext() {
    if (!this.isBrowserEnvironment()) return {};
    
    const stage = gameContent?.stages?.[currentStage - 1];
    const context = {
      stage: stage?.title || 'Unknown stage',
      challenge: stage?.challenge || '',
      data: stage?.data || '',
      hints: stage?.hints || []
    };

    // Get current code
    if (stage?.type === 'multi-cell') {
      context.currentCode = cellEditors.map((editor, index) => ({
        cell: index + 1,
        code: editor.getValue()
      }));
    } else {
      context.currentCode = editor?.getValue() || '';
    }

    // Get recent output/errors
    const outputAreas = document.querySelectorAll('.output-area');
    if (outputAreas.length > 0) {
      const lastOutput = outputAreas[outputAreas.length - 1];
      context.lastOutput = lastOutput.textContent;
      context.hasError = lastOutput.classList.contains('error');
    }

    return context;
  }

  buildPrompt(type, context) {
    let basePrompt = `You are an AI coding tutor helping a student learn Python programming.

Current challenge: ${context.challenge}
Stage: ${context.stage}
Available data: ${context.data}

Student's current code:
${typeof context.currentCode === 'string' 
  ? context.currentCode 
  : context.currentCode?.map(c => `Cell ${c.cell}:\n${c.code}`).join('\n\n') || 'No code yet'
}

${context.lastOutput ? `Last output: ${context.lastOutput}` : ''}
${context.hasError ? '(There was an error in the last execution)' : ''}

`;

    switch (type) {
      case 'hint':
        return basePrompt + `Please provide a helpful hint to guide the student toward the solution. Don't give away the complete answer, but help them understand what they need to think about or try next. Keep it encouraging and educational.`;
      
      case 'debug':
        return basePrompt + `The student is having trouble with their code. Please help them debug by:
1. Identifying potential issues in their current code
2. Explaining what might be going wrong
3. Suggesting specific steps to fix the problem
Be specific and educational in your explanation.`;
      
      case 'explain':
        return basePrompt + `Please explain the key programming concepts involved in this challenge. Help the student understand:
1. What programming concepts are being practiced
2. How these concepts work in Python
3. Why these concepts are useful
Keep the explanation clear and beginner-friendly.`;
      
      default:
        return basePrompt + `Please provide helpful guidance for this programming challenge.`;
    }
  }

  async queryOllama(prompt) {
    if (!this.isBrowserEnvironment()) throw new Error('Browser environment required');

    const response = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.selectedModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          max_tokens: 500
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return this.formatResponse(data.response);
  }

  async queryOpenAI(prompt) {
    if (!this.isBrowserEnvironment()) throw new Error('Browser environment required');
    
    if (!this.apiKeys.openai) {
      throw new Error('OpenAI API key not set');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKeys.openai}`
      },
      body: JSON.stringify({
        model: this.selectedModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return this.formatResponse(data.choices[0].message.content);
  }

  async queryAnthropic(prompt) {
    if (!this.isBrowserEnvironment()) throw new Error('Browser environment required');
    
    if (!this.apiKeys.anthropic) {
      throw new Error('Anthropic API key not set');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKeys.anthropic,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.selectedModel,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return this.formatResponse(data.content[0].text);
  }

  formatResponse(response) {
    // Clean up the response
    let cleanedResponse = response.trim();
    
    // Remove any meta-commentary about being an AI
    cleanedResponse = cleanedResponse.replace(/^(As an AI.*?assistant,?\s*|I'm an AI.*?and\s*)/i, '');
    
    // Format as markdown and convert to HTML
    return this.markdownToHtml(cleanedResponse);
  }

  /**
   * Convert markdown to HTML - core functionality that works in both environments
   */
  markdownToHtml(markdown) {
    // Simple markdown to HTML converter for common formatting
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')

      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')

      // Code blocks
      .replace(
        /```python\n([\s\S]*?)\n```/g,
        '<pre><code class="language-python">$1</code></pre>'
      )
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code>$1</code>');

    // Handle lists more carefully
    const lines = html.split('\n');
    const processedLines = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isListItem = line.match(/^[*-]\s+(.*)/);

      if (isListItem) {
        if (!inList) {
          processedLines.push('<ul>');
          inList = true;
        }
        processedLines.push(`<li>${isListItem[1]}</li>`);
      } else {
        if (inList) {
          processedLines.push('</ul>');
          inList = false;
        }
        if (line) {
          processedLines.push(line);
        }
      }
    }

    // Close any remaining list
    if (inList) {
      processedLines.push('</ul>');
    }

    html = processedLines.join('\n');

    // Remove line breaks around list elements to avoid extraneous <br> tags
    html = html
      .replace(/<ul>\n/g, '<ul>')
      .replace(/\n<\/ul>/g, '</ul>')
      .replace(/<li>(.*?)<\/li>\n/g, '<li>$1</li>');

    // Convert remaining line breaks to paragraphs and <br> tags
    html = html
      .replace(/\n\n+/g, '</p><p>') // Double line breaks become paragraph breaks
      .replace(/\n/g, '<br>'); // Single line breaks become <br>
    if (
      !html.includes('<p>') &&
      !html.includes('<h') &&
      !html.includes('<ul>') &&
      !html.includes('<pre>')
    ) {
      html = '<p>' + html + '</p>';
    } else if (html.includes('</p><p>')) {
      // Properly wrap the content that has paragraph breaks
      html = '<p>' + html + '</p>';
    }

    return html;
  }

  showLLMResponse(type, content) {
    if (!this.isBrowserEnvironment()) return;
    
    const hintTextContainer = document.getElementById('hint-text-container');
    if (!hintTextContainer) {
      console.error('hint-text-container not found!');
      return;
    }

    // Clear existing LLM responses
    const existingLLMHints = hintTextContainer.querySelectorAll('.llm-hint');
    existingLLMHints.forEach(hint => hint.remove());

    // Create new LLM response
    const llmHint = document.createElement('div');
    llmHint.className = `llm-hint ${type === 'success' ? '' : type}`;

    const header = document.createElement('div');
    header.className = 'llm-header';

    if (type === 'loading') {
      header.innerHTML = '🤖 AI Assistant (thinking...)';
    } else if (type === 'error') {
      header.innerHTML = '🤖 AI Assistant (error)';
    } else {
      header.innerHTML = `🤖 AI Assistant (${this.selectedModel})`;
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'llm-content';

    // Use innerHTML for formatted content, textContent for plain text/errors
    if (type === 'success') {
      contentDiv.innerHTML = content;
    } else {
      contentDiv.textContent = content;
    }

    llmHint.appendChild(header);
    llmHint.appendChild(contentDiv);
    hintTextContainer.appendChild(llmHint);

    // Scroll to the response
    llmHint.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LLMIntegration };
} else if (typeof window !== 'undefined') {
  window.LLMIntegration = LLMIntegration;
}