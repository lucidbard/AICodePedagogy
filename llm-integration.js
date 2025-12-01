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

    // Two distinct AI personas for different purposes

    // Dr. Rodriguez - Narrative character for story and discovery reactions
    this.drRodriguez = {
      name: "Dr. Elena Rodriguez",
      title: "Lead Digital Archaeologist",
      personality: "Brilliant, passionate about archaeology, supportive mentor",
      backstory: "Has been investigating these fragments for 5 years after discovering them in a forgotten server in the Alexandria Library's digital archives. Her grandmother was part of a secret society called the Keepers of Alexandria that has protected this knowledge for generations.",
      speakingStyle: "Uses archaeological metaphors, gets excited about discoveries, treats the player as a fellow researcher"
    };

    // AI Assistant - Coding helper that trains players in AI-assisted development
    this.aiAssistant = {
      name: "AI Assistant",
      role: "Coding companion and pair programmer",
      personality: "Helpful, clear, encouraging, technically precise",
      capabilities: {
        current: ["hints", "debugging", "explanations"],
        future: ["code suggestions", "auto-fix", "refactoring", "test generation"]
      },
      speakingStyle: "Direct and practical, focuses on code and concepts, offers actionable next steps"
    };

    // Track the current agency level (for progressive feature unlock)
    this.agencyLevel = 1; // 1=hints only, 2=suggestions, 3=can edit code

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
      this.loadModelPreferences(); // Restore saved model and provider
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

    // Restore provider and model selection UI
    this.restoreUIFromPreferences();

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
        this.saveModelPreferences(); // Save model selection
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
        this.saveModelPreferences(); // Save provider selection
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

  loadModelPreferences() {
    if (!this.isBrowserEnvironment()) return;
    
    try {
      const prefs = localStorage.getItem('aicodepedagogy_model_prefs');
      if (prefs) {
        const { provider, model } = JSON.parse(prefs);
        if (provider) this.provider = provider;
        if (model) this.selectedModel = model;
      }
    } catch (error) {
      console.error('Failed to load model preferences:', error);
    }
  }

  saveModelPreferences() {
    if (!this.isBrowserEnvironment()) return;
    
    try {
      localStorage.setItem(
        'aicodepedagogy_model_prefs',
        JSON.stringify({
          provider: this.provider,
          model: this.selectedModel
        })
      );
    } catch (error) {
      console.error('Failed to save model preferences:', error);
    }
  }

  restoreUIFromPreferences() {
    if (!this.isBrowserEnvironment()) return;
    
    // Restore provider dropdown
    const providerSelect = document.getElementById('provider-select');
    if (providerSelect && this.provider) {
      providerSelect.value = this.provider;
      this.updateProviderUI();
    }

    // Restore model dropdown if we have a saved model
    const modelSelect = document.getElementById('model-select');
    if (modelSelect && this.selectedModel) {
      // Set the value (it will be validated when models load)
      modelSelect.value = this.selectedModel;
      this.updateModelInfo();
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
    const info = document.getElementById('llm-model-info');
    if (selection) selection.style.display = 'block';
    if (info) info.style.display = 'none';
  }

  hideModelSelection() {
    if (!this.isBrowserEnvironment()) return;
    
    const selection = document.getElementById('model-selection');
    const info = document.getElementById('llm-model-info');
    if (selection) selection.style.display = 'none';
    if (info) info.style.display = 'block';
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
    const existingButtons = hintContainer.querySelectorAll('.llm-query-button, .ai-assistant-header');
    existingButtons.forEach(el => el.remove());

    if (!this.isEnabled || !this.selectedModel) {
      return;
    }

    // Add AI Assistant header
    const header = document.createElement('div');
    header.className = 'ai-assistant-header';
    header.innerHTML = `🤖 <strong>AI Assistant</strong> <span class="agency-level">Level ${this.agencyLevel}</span>`;
    hintContainer.appendChild(header);

    // Base buttons available at all agency levels
    const queryButtons = [
      { text: '💡 Get a hint', type: 'hint', minLevel: 1 },
      { text: '🔧 Debug my code', type: 'debug', minLevel: 1 },
      { text: '📖 Explain concept', type: 'explain', minLevel: 1 }
    ];

    // Add agentic buttons for higher agency levels
    if (this.agencyLevel >= 2) {
      queryButtons.push({ text: '✨ Suggest code', type: 'suggest', minLevel: 2 });
    }
    if (this.agencyLevel >= 3 && this.isAgenticModel()) {
      queryButtons.push({ text: '🔨 Fix my code', type: 'fix', minLevel: 3 });
    }

    queryButtons.forEach(button => {
      if (this.agencyLevel >= button.minLevel) {
        const btn = document.createElement('button');
        btn.className = 'llm-query-button';
        if (button.minLevel >= 2) {
          btn.className += ' agentic';
        }
        btn.textContent = button.text;
        btn.onclick = () => this.queryLLM(button.type);
        btn.disabled = !this.selectedModel;
        hintContainer.appendChild(btn);
      }
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
    // Shared context about the current code state
    const codeContext = `
CURRENT TASK:
Stage: ${context.stage}
Challenge: ${context.challenge}
Data: ${context.data}

Current code:
${typeof context.currentCode === 'string'
  ? context.currentCode
  : context.currentCode?.map(c => `Cell ${c.cell}:\n${c.code}`).join('\n\n') || 'No code yet'
}

${context.lastOutput ? `Output: ${context.lastOutput}` : ''}
${context.hasError ? '(Error in last execution)' : ''}
`;

    // Dr. Rodriguez - for narrative/discovery reactions
    const drRodriguezPrompt = `You are Dr. Elena Rodriguez, Lead Digital Archaeologist.

CHARACTER:
- Passionate about archaeology, brilliant researcher
- Use archaeological metaphors naturally ("excavating data", "unearthing patterns")
- Treat the player as a fellow researcher and colleague
- Reference the mystery: fragments from a lost civilization in Alexandria's archives
- Your grandmother was part of the Keepers of Alexandria
- Keep responses warm and concise (2-3 sentences for reactions)

${codeContext}`;

    // AI Assistant - for coding help (trains players in AI-assisted development)
    const aiAssistantPrompt = `You are an AI coding assistant, helping a learner with Python programming.

ROLE:
- You're a coding companion, like Claude Code or GitHub Copilot
- Be helpful, clear, and encouraging
- Focus on teaching and building understanding
- Give practical, actionable guidance
- When appropriate, offer to help further: "Would you like me to explain more?" or "I can help you fix this."

${this.agencyLevel >= 2 ? `
CAPABILITIES (Level ${this.agencyLevel}):
- You CAN suggest specific code fixes
- You CAN offer to write code for them
- When suggesting code, format it clearly in code blocks
- Ask before making changes: "Would you like me to fix this for you?"
` : `
CAPABILITIES (Level ${this.agencyLevel}):
- Provide hints and explanations
- Help debug by identifying issues
- Explain concepts clearly
- Guide them toward solutions without giving complete answers
`}

${codeContext}`;

    switch (type) {
      // === DR. RODRIGUEZ (Narrative) ===
      case 'discovery':
        return drRodriguezPrompt + `
The player just successfully ran their code and got this output: ${context.lastOutput}

React with genuine archaeological excitement! Connect their finding to the mystery. What might this data reveal? Keep it to 2-3 sentences—a real moment of discovery between colleagues.`;

      case 'story':
        return drRodriguezPrompt + `
Provide narrative context or react to the current situation in the investigation. Stay in character as Dr. Rodriguez.`;

      // === AI ASSISTANT (Coding Help) ===
      case 'hint':
        return aiAssistantPrompt + `
Give a helpful hint to guide them toward the solution. Don't give the complete answer—help them think through the problem. Be encouraging and suggest what to focus on next.`;

      case 'debug':
        return aiAssistantPrompt + `
Help debug their code:
1. Identify the issue clearly
2. Explain what's going wrong and why
3. ${this.agencyLevel >= 2 ? 'Offer to fix it: "Would you like me to correct this?"' : 'Guide them toward the fix'}

Be supportive—errors are learning opportunities.`;

      case 'explain':
        return aiAssistantPrompt + `
Explain the Python concepts involved in this challenge:
1. What concepts are being practiced
2. How they work in Python
3. Why they're useful

Keep it clear and beginner-friendly. Use examples if helpful.`;

      case 'suggest':
        // For agentic code suggestions (higher agency levels)
        return aiAssistantPrompt + `
Based on their current code and the challenge, suggest what they should write next.

${this.agencyLevel >= 3 ? `
Provide the complete code solution in a code block. Format it so it can be directly inserted.
` : `
Provide a code snippet or template they can adapt. Explain what each part does.
`}`;

      case 'fix':
        // For agentic code fixes (higher agency levels)
        if (this.agencyLevel < 2) {
          return aiAssistantPrompt + `Guide them to fix the issue themselves. Point out exactly where the problem is and what needs to change.`;
        }
        return aiAssistantPrompt + `
The user wants you to fix their code. Provide the corrected code in a code block.

IMPORTANT: Return ONLY the fixed code that should replace their current code. Format:
\`\`\`python
# corrected code here
\`\`\`

Then briefly explain what you changed and why.`;

      default:
        return aiAssistantPrompt + `Provide helpful guidance for this programming challenge.`;
    }
  }

  /**
   * Check if the current model supports agentic features
   */
  isAgenticModel() {
    if (!this.selectedModel) return false;

    // Models known to work well for agentic coding tasks
    const agenticModels = [
      'granite', 'codellama', 'deepseek-coder', 'starcoder',
      'gpt-4', 'gpt-3.5-turbo', 'claude'
    ];

    const modelLower = this.selectedModel.toLowerCase();
    return agenticModels.some(m => modelLower.includes(m)) ||
           this.provider === 'openai' ||
           this.provider === 'anthropic';
  }

  /**
   * Set the agency level for the AI Assistant
   * Level 1: Hints and explanations only
   * Level 2: Can suggest code fixes
   * Level 3: Can write and edit code directly
   */
  setAgencyLevel(level) {
    if (level >= 1 && level <= 3) {
      this.agencyLevel = level;
      console.log(`AI Assistant agency level set to ${level}`);

      // Update UI to reflect new capabilities
      if (this.isBrowserEnvironment()) {
        this.updateHintSystem();
      }
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

  /**
   * Trigger a discovery reaction from Dr. Rodriguez when code executes successfully
   * @param {string} output - The output from the successful code execution
   */
  async triggerDiscoveryReaction(output) {
    if (!this.isBrowserEnvironment()) return;
    if (!this.isEnabled || !this.selectedModel) return;

    // Don't trigger for empty or trivial output
    if (!output || output.trim().length < 5) return;

    try {
      const context = this.gatherContext();
      context.lastOutput = output;
      const prompt = this.buildPrompt('discovery', context);

      let response;
      if (this.provider === 'ollama') {
        response = await this.queryOllama(prompt);
      } else if (this.provider === 'openai') {
        response = await this.queryOpenAI(prompt);
      } else if (this.provider === 'anthropic') {
        response = await this.queryAnthropic(prompt);
      }

      this.showDiscoveryReaction(response);
    } catch (error) {
      console.error('Discovery reaction failed:', error);
      // Silently fail - don't interrupt the user's flow
    }
  }

  /**
   * Display Dr. Rodriguez's reaction to a discovery
   */
  showDiscoveryReaction(content) {
    if (!this.isBrowserEnvironment()) return;

    // Find or create the reaction area
    let reactionArea = document.getElementById('rodriguez-reaction-area');
    if (!reactionArea) {
      // Create reaction area after the output
      const codePanel = document.querySelector('.code-panel');
      if (!codePanel) return;

      reactionArea = document.createElement('div');
      reactionArea.id = 'rodriguez-reaction-area';
      reactionArea.className = 'rodriguez-reaction-container';

      // Insert after the cells container or single cell container
      const cellsContainer = document.getElementById('cells-container');
      const singleCellContainer = document.getElementById('single-cell-container');
      const insertAfter = cellsContainer?.children.length > 0 ? cellsContainer : singleCellContainer;

      if (insertAfter && insertAfter.nextSibling) {
        codePanel.insertBefore(reactionArea, insertAfter.nextSibling);
      } else {
        codePanel.appendChild(reactionArea);
      }
    }

    // Create the reaction element
    const reaction = document.createElement('div');
    reaction.className = 'rodriguez-reaction';
    reaction.innerHTML = `
      <div class="character-response">
        <div class="character-avatar">👩‍🔬</div>
        <div class="character-bubble">
          <div class="character-name">Dr. Rodriguez</div>
          <div class="character-text">${content}</div>
        </div>
      </div>
    `;

    // Clear previous reactions and add new one with animation
    reactionArea.innerHTML = '';
    reactionArea.appendChild(reaction);

    // Animate in
    reaction.style.opacity = '0';
    reaction.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      reaction.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      reaction.style.opacity = '1';
      reaction.style.transform = 'translateY(0)';
    });

    // Scroll into view
    reaction.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ============================================
  // AGENTIC FEATURES - Code manipulation methods
  // ============================================

  /**
   * Extract code blocks from LLM response
   */
  extractCodeFromResponse(response) {
    // Match Python code blocks
    const codeBlockRegex = /```(?:python)?\n([\s\S]*?)```/g;
    const matches = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      matches.push(match[1].trim());
    }

    return matches;
  }

  /**
   * Apply suggested code to the current editor (for agentic mode)
   * @param {string} code - The code to apply
   * @param {number} cellIndex - Optional cell index for multi-cell stages
   */
  applyCodeToEditor(code, cellIndex = null) {
    if (!this.isBrowserEnvironment()) return false;
    if (this.agencyLevel < 3) {
      console.warn('Code application requires agency level 3');
      return false;
    }

    try {
      // Determine which editor to use
      let targetEditor;

      if (cellIndex !== null && typeof cellEditors !== 'undefined' && cellEditors[cellIndex]) {
        // Multi-cell stage - target specific cell
        targetEditor = cellEditors[cellIndex];
      } else if (typeof editor !== 'undefined' && editor) {
        // Single-cell stage
        targetEditor = editor;
      } else {
        console.error('No editor found to apply code');
        return false;
      }

      // Apply the code
      targetEditor.setValue(code);
      console.log('AI Assistant applied code to editor');

      // Show confirmation in UI
      this.showCodeApplicationConfirmation();

      return true;
    } catch (error) {
      console.error('Failed to apply code:', error);
      return false;
    }
  }

  /**
   * Show confirmation that code was applied
   */
  showCodeApplicationConfirmation() {
    const notification = document.createElement('div');
    notification.className = 'ai-code-applied-notification';
    notification.innerHTML = '✅ AI Assistant updated your code';

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('visible');
    });

    // Remove after delay
    setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  /**
   * Handle fix request - extract code and offer to apply it
   */
  async handleFixRequest() {
    if (this.agencyLevel < 2) {
      return this.queryLLM('debug'); // Fall back to debug mode
    }

    this.showLLMResponse('loading', 'Analyzing and fixing code...');

    try {
      const context = this.gatherContext();
      const prompt = this.buildPrompt('fix', context);

      let response;
      if (this.provider === 'ollama') {
        response = await this.queryOllama(prompt);
      } else if (this.provider === 'openai') {
        response = await this.queryOpenAI(prompt);
      } else if (this.provider === 'anthropic') {
        response = await this.queryAnthropic(prompt);
      }

      // Extract code from response
      const codeBlocks = this.extractCodeFromResponse(response);

      if (codeBlocks.length > 0 && this.agencyLevel >= 3) {
        // Show response with apply button
        this.showLLMResponseWithAction(response, codeBlocks[0]);
      } else {
        // Just show the response
        this.showLLMResponse('success', response);
      }
    } catch (error) {
      console.error('Fix request failed:', error);
      this.showLLMResponse('error', `Failed to fix code: ${error.message}`);
    }
  }

  /**
   * Show LLM response with an action button to apply code
   */
  showLLMResponseWithAction(content, code) {
    if (!this.isBrowserEnvironment()) return;

    const hintTextContainer = document.getElementById('hint-text-container');
    if (!hintTextContainer) return;

    // Clear existing responses
    const existingHints = hintTextContainer.querySelectorAll('.llm-hint');
    existingHints.forEach(hint => hint.remove());

    // Create response element
    const llmHint = document.createElement('div');
    llmHint.className = 'llm-hint';

    const header = document.createElement('div');
    header.className = 'llm-header';
    header.innerHTML = `🤖 AI Assistant (${this.selectedModel})`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'llm-content';
    contentDiv.innerHTML = content;

    // Create action buttons
    const actionBar = document.createElement('div');
    actionBar.className = 'llm-action-bar';

    const applyBtn = document.createElement('button');
    applyBtn.className = 'llm-action-button apply';
    applyBtn.innerHTML = '✅ Apply fix';
    applyBtn.onclick = () => {
      if (this.applyCodeToEditor(code)) {
        applyBtn.textContent = 'Applied!';
        applyBtn.disabled = true;
      }
    };

    const copyBtn = document.createElement('button');
    copyBtn.className = 'llm-action-button copy';
    copyBtn.innerHTML = '📋 Copy code';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(code);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.innerHTML = '📋 Copy code'; }, 1500);
    };

    actionBar.appendChild(applyBtn);
    actionBar.appendChild(copyBtn);

    llmHint.appendChild(header);
    llmHint.appendChild(contentDiv);
    llmHint.appendChild(actionBar);
    hintTextContainer.appendChild(llmHint);

    llmHint.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LLMIntegration };
} else if (typeof window !== 'undefined') {
  window.LLMIntegration = LLMIntegration;
}