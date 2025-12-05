// Game state variables
let gameContent = null
let currentStage = 0
let editor = null
let cellEditors = []
let completedStages = []
let skulptReady = false
let skulptLoadPromise = null
let skulptEnvironment = null // Persistent Skulpt environment for multi-cell stages
let successfulCellExecutions = {} // Track which cells have executed successfully by stage
let savedCellContent = {} // Track cell content across all stages


// Offline storage utility functions
function saveGameState () {
  try {
    const gameState = {
      currentStage: currentStage,
      completedStages: completedStages,
      successfulCellExecutions: Object.fromEntries(
        Object.entries(successfulCellExecutions).map(([key, value]) => [
          key,
          Array.from(value)
        ])
      ),
      cellContent: getCellContentForAllStages(),
      lastSaved: Date.now()
    }
    localStorage.setItem('aicodepedagogy_progress', JSON.stringify(gameState))
    console.log('Game state saved to localStorage')
  } catch (error) {
    console.warn('Failed to save game state:', error)
  }
}

function loadGameState () {
  try {
    const saved = localStorage.getItem('aicodepedagogy_progress')
    if (!saved) return false

    const gameState = JSON.parse(saved)

    // Restore basic state
    currentStage = gameState.currentStage || 1
    completedStages = gameState.completedStages || []

    // Restore successful cell executions (convert arrays back to Sets)
    successfulCellExecutions = {}
    if (gameState.successfulCellExecutions) {
      Object.entries(gameState.successfulCellExecutions).forEach(
        ([key, value]) => {
          successfulCellExecutions[key] = new Set(value)
        }
      )
    }

    // Restore saved cell content
    savedCellContent = gameState.cellContent || {}

    console.log('Game state loaded from localStorage')
    return gameState
  } catch (error) {
    console.warn('Failed to load game state:', error)
    return false
  }
}

function getCellContentForAllStages () {
  // Update the current stage's content before saving
  updateCurrentStageCellContent()
  return savedCellContent
}

function updateCurrentStageCellContent () {
  if (currentStage === undefined || currentStage === null) return

  // Save single-cell content if editor exists
  if (
    editor &&
    document.getElementById('single-cell-container').style.display !== 'none'
  ) {
    savedCellContent[currentStage] = {
      type: 'single',
      content: editor.getValue()
    }
  }

  // Save multi-cell content if editors exist
  if (
    cellEditors.length > 0 &&
    document.getElementById('cells-container').style.display !== 'none'
  ) {
    savedCellContent[currentStage] = {
      type: 'multi',
      content: cellEditors.map(cellEditor => cellEditor.getValue())
    }
  }
}

function restoreCellContent (gameState) {
  const stageContent = savedCellContent[currentStage]
  if (!stageContent) return

  // Use setTimeout to ensure editors are created first
  setTimeout(() => {
    try {
      if (stageContent.type === 'single' && editor) {
        editor.setValue(stageContent.content || '')
      } else if (stageContent.type === 'multi' && cellEditors.length > 0) {
        stageContent.content.forEach((content, index) => {
          if (cellEditors[index]) {
            cellEditors[index].setValue(content || '')
          }
        })
      }
    } catch (error) {
      console.warn('Failed to restore cell content:', error)
    }
  }, 100)
}

function clearGameProgress () {
  try {
    localStorage.removeItem('aicodepedagogy_progress')
    localStorage.removeItem('aicodepedagogy_tutorials_seen')
    // Reset to initial state
    currentStage = 0
    completedStages = []
    successfulCellExecutions = {}
    savedCellContent = {}
    console.log('Game progress cleared')
    return true
  } catch (error) {
    console.warn('Failed to clear game progress:', error)
    return false
  }
}

// Create a promise that resolves when Skulpt is ready
function createSkulptLoadPromise () {
  if (skulptLoadPromise) {
    return skulptLoadPromise
  }

  skulptLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded (using the correct Skulpt API)
    if (typeof Sk !== 'undefined' && typeof Sk.configure === 'function') {
      skulptReady = true
      resolve()
      return
    }
    // Set up a global callback for when Skulpt loads
    window.onSkulptLoaded = function () {
      // Give a moment for both scripts to load
      setTimeout(() => {
        if (typeof Sk !== 'undefined' && typeof Sk.configure === 'function') {
          skulptReady = true
          console.log('Skulpt loaded successfully via callback!')
          resolve()
        } else {
          console.warn('Skulpt callback fired but API not ready yet')
        }
      }, 100)
    }

    // Fallback: Check periodically if the global callback doesn't work
    let attempts = 0
    const maxAttempts = 100 // 10 seconds max wait
    const checkInterval = setInterval(() => {
      attempts++
      if (typeof Sk !== 'undefined' && typeof Sk.configure === 'function') {
        skulptReady = true
        clearInterval(checkInterval)
        console.log('Skulpt loaded (detected via polling)')
        resolve()
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        reject(new Error('Skulpt failed to load after 10 seconds'))
      }
    }, 100)

    // Additional timeout safety
    setTimeout(() => {
      if (!skulptReady) {
        reject(new Error('Skulpt loading timeout'))
      }
    }, 15000)
  })

  return skulptLoadPromise
}

// Initialize game by loading content from JSON
async function initializeGame () {
  try {
    console.log('Starting game initialization...')

    // Load game content from JSON file first (don't wait for Skulpt)
    console.log('Loading game content...')
    const response = await fetch('game-content.json')
    if (!response.ok) {
      throw new Error('Failed to load game content')
    }

    gameContent = await response.json()
    console.log('Game content loaded successfully')

    // Set game title and subtitle
    document.getElementById('game-title').textContent =
      gameContent.gameInfo.title
    document.getElementById('game-subtitle').textContent =
      gameContent.gameInfo.subtitle

    // Create developer navigation
    createDevNav()

    // Try to load saved progress
    const savedState = loadGameState()

    // Load the appropriate stage (saved or default to Stage 0 tutorial)
    loadStage(savedState ? currentStage : 0)

    // Restore cell content if available
    if (savedState) {
      restoreCellContent(savedState)
    }

    console.log('Game initialized successfully')

    // Mark game as initialized to enable auto-saving on stage changes
    window.gameInitialized = true

    // Initialize Skulpt in the background (don't block game loading)
    createSkulptLoadPromise()
      .then(() => {
        console.log('Skulpt ready for code execution')
      })
      .catch(error => {
        console.warn('Skulpt initialization failed:', error)
      })

    // Initialize LLM integration
    console.log('Initializing LLM integration...')
    ollamaLLM = new EnhancedLLMIntegration()
    window.llmIntegration = ollamaLLM  // Global reference for other modules
    ollamaLLM.init()
    console.log('LLM integration initialized')
  } catch (error) {
    console.error('Error initializing game:', error)
    const storyElement = document.getElementById('story-content')
    if (storyElement) {
      storyElement.innerHTML = `<p>Error loading game content. Please refresh the page or try again later.</p>
             <p>Technical details: ${error.message}</p>
             <p>If this persists, try clearing your browser cache and refreshing.</p>`
    }
  }
}

// Load a specific stage
function loadStage (stageId) {
  if (!gameContent) {
    console.error('Game content not loaded yet')
    return
  }

  // Find the stage in game content
  const stage = gameContent.stages.find(s => s.id === stageId)
  if (!stage) {
    console.error(`Stage ${stageId} not found`)
    return
  }

  // Save current stage cell content BEFORE switching (use old currentStage value)
  if (window.gameInitialized && currentStage !== stageId) {
    updateCurrentStageCellContent()
  }

  currentStage = stageId

  // Update narrative strip (top of new layout)
  updateNarrativeStrip(
    stage.narrativeIntro || stage.story.substring(0, 100) + "...",
    stage.challenge
  );
  
  // Update data card in reference panel
  updateDataCard(stage.data);
  
  // Update UI elements with stage content (convert \n to <br> for proper line breaks)
  // Keep backward compatibility with old story panel if it exists
  const storyContent = document.getElementById('story-content');
  if (storyContent) {
    storyContent.innerHTML = stage.story.replace(/\n/g, '<br>');
  }
  
  const challengeContent = document.getElementById('challenge-content');
  if (challengeContent) {
    challengeContent.innerHTML = `<strong>Challenge:</strong> ${stage.challenge.replace(/\n/g, '<br>')}`;
  }
  
  const dataContent = document.getElementById('data-content');
  if (dataContent) {
    dataContent.innerHTML = `<strong>Data:</strong><br>${stage.data.replace(/\n/g, '<br>')}`;
  }

  // Update progress bar
  const progressPercent = (stageId / gameContent.gameInfo.totalStages) * 100
  document.getElementById('progress-bar').style.width = `${progressPercent}%`

  // Update dev navigation
  updateDevNav()
  // Handle single vs multi-cell stages
  if (stage.cells) {
    setupMultiCellStage(stage)
    // Initialize successful execution tracking for this stage
    successfulCellExecutions[stageId] = new Set()
  } else {
    setupSingleCellStage(stage)
  }

  // Set up hints
  setupHints(stage)

  // Reset next button
  const nextButton = document.getElementById('next-button')
  nextButton.classList.remove('active')

  // Restore cell content for this stage if available
  if (window.gameInitialized) {
    restoreCellContent()
  }

  // Check if we should show a tutorial for this stage
  if (window.checkAndStartTutorial) {
    window.checkAndStartTutorial(stageId)
  }

  // Save state AFTER stage is fully set up (not before)
  if (gameContent && window.gameInitialized) {
    // Use setTimeout to ensure editor content is settled before saving
    setTimeout(() => saveGameState(), 200)
  }

  console.log(`Loaded stage ${stageId}: ${stage.title}`)
}

// Set up a single-cell stage (Google Colab style)
function setupSingleCellStage (stage) {
  document.getElementById('cells-container').style.display = 'none'
  document.getElementById('single-cell-container').style.display = 'block'

  // Clear and recreate the single cell container with Colab styling
  const container = document.getElementById('single-cell-container')
  container.innerHTML = ''

  // Create a single cell with Colab styling
  const cellContainer = document.createElement('div')
  cellContainer.className = 'cell-container'
  cellContainer.id = 'single-cell'

  // Create cell header
  const cellHeader = document.createElement('div')
  cellHeader.className = 'cell-header'
  // Execution counter (starts empty) with embedded play/stop icons
  const cellNumber = document.createElement('span')
  cellNumber.className = 'cell-number'
  cellNumber.id = 'single-cell-number'
  cellNumber.innerHTML = `
    [ ]
    <svg class="play-icon" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
    <svg class="stop-icon" viewBox="0 0 24 24" style="display: none;">
      <rect x="6" y="6" width="12" height="12"/>
    </svg>
  `

  const cellTitle = document.createElement('span')
  cellTitle.className = 'cell-title'
  cellTitle.textContent = 'Code Cell'

  const cellStatus = document.createElement('span')
  cellStatus.className = 'cell-status pending'
  cellStatus.textContent = 'Pending'
  cellStatus.id = 'single-cell-status'

  cellHeader.appendChild(cellNumber)
  cellHeader.appendChild(cellTitle)
  cellHeader.appendChild(cellStatus)
  cellContainer.appendChild(cellHeader)
  // Create code editor container
  const editorContainer = document.createElement('div')
  editorContainer.className = 'code-editor-container'

  // Create code editor
  const editorElement = document.createElement('div')
  editorElement.className = 'code-editor'
  editorElement.id = 'single-code-editor'
  editorContainer.appendChild(editorElement)

  cellContainer.appendChild(editorContainer)

  // Create collapsible output container
  const outputContainer = document.createElement('div')
  outputContainer.className = 'output-container'
  outputContainer.id = 'single-output-container'
  outputContainer.style.display = 'none' // Initially hidden

  // Output header
  const outputHeader = document.createElement('div')
  outputHeader.className = 'output-header'
  outputHeader.innerHTML = `
    <svg class="output-toggle" viewBox="0 0 24 24">
      <path d="M7 10l5 5 5-5z"/>
    </svg>
    <span class="output-label">Output</span>
    <span class="output-counter" id="single-output-counter"></span>
  `
  outputContainer.appendChild(outputHeader)

  // Output area
  const outputArea = document.createElement('div')
  outputArea.className = 'output-area empty'
  outputArea.id = 'single-output-area'
  outputContainer.appendChild(outputArea)

  cellContainer.appendChild(outputContainer)
  container.appendChild(cellContainer)
  // Initialize or reset code editor
  if (editor) {
    try {
      editor.toTextArea() // Clean up existing editor
    } catch (e) {
      console.log(
        'Editor cleanup error (expected when switching stage types):',
        e
      )
    }
    editor = null
  }
  editor = CodeMirror(document.getElementById('single-code-editor'), {
    value: stage.starterCode || '# Your code here\n',
    mode: 'python',
    theme: 'default', // Using default theme for Colab style
    lineNumbers: true,
    indentUnit: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
    viewportMargin: Infinity, // Auto-resize height
    lineWrapping: true, // Enable line wrapping for mobile
    hintOptions: {
      hint: CodeMirror.hint.python,
      completeSingle: false
    },
    extraKeys: {
      'Ctrl-Enter': function () {
        runPythonCode(editor.getValue(), stage.solution)
      },
      'Shift-Enter': function () {
        runPythonCode(editor.getValue(), stage.solution)
      },
      'Ctrl-Space': 'autocomplete', // Auto-completion trigger
      Tab: function (cm) {
        // Better tab handling for mobile - autocomplete if popup is open, otherwise indent
        if (cm.state.completionActive) return CodeMirror.Pass
        if (cm.somethingSelected()) {
          cm.indentSelection('add')
        } else {
          cm.replaceSelection(
            cm.getOption('indentWithTabs')
              ? '\t'
              : ' '.repeat(cm.getOption('indentUnit'))
          )
        }
      }
    }
  })

  // Add change listener to save state when content changes
  editor.on('change', function () {
    // Debounce the save to avoid too frequent saves
    clearTimeout(editor.saveTimeout)
    editor.saveTimeout = setTimeout(() => {
      saveGameState()
    }, 1000) // Save after 1 second of no changes
  })

  // Mobile-friendly auto-completion: trigger completion after typing certain characters
  editor.on('inputRead', function (cm, event) {
    // Auto-trigger completion on mobile after typing letters, dots, or underscores
    if (
      !cm.state.completionActive &&
      event.text &&
      event.text.length === 1 &&
      /[a-zA-Z._]/.test(event.text[0])
    ) {
      // Get current line content to check context
      const cursor = cm.getCursor()
      const line = cm.getLine(cursor.line)
      const beforeCursor = line.slice(0, cursor.ch)

      // Trigger completion if we have at least 2 characters of a word
      if (
        /[a-zA-Z_][a-zA-Z0-9_]*$/.test(beforeCursor) &&
        beforeCursor.match(/[a-zA-Z_][a-zA-Z0-9_]*$/)[0].length >= 2
      ) {
        setTimeout(() => cm.showHint({ completeSingle: false }), 100)
      }
    }
  })

  // Set up cell number click to run code (replacing separate run button)
  cellNumber.onclick = function () {
    runPythonCode(editor.getValue(), stage.solution)
  }

  // Set up output header click to toggle collapse
  outputHeader.onclick = function () {
    toggleSingleOutputCollapse()
  }

  // Refresh editor to ensure proper layout calculation
  setTimeout(() => {
    editor.refresh()

    // Auto-focus editor on desktop (not mobile - would trigger keyboard)
    if (!isMobileDevice()) {
      editor.focus()
      // Position cursor at end of first TODO line or start of editor
      const content = editor.getValue()
      const todoMatch = content.match(/# TODO:.*/)
      if (todoMatch) {
        const todoIndex = content.indexOf(todoMatch[0])
        const pos = editor.posFromIndex(todoIndex + todoMatch[0].length)
        editor.setCursor(pos)
      }
    }
  }, 50)
}

// Helper function to detect mobile devices
function isMobileDevice () {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768)
}

// Toggle single cell output collapse
function toggleSingleOutputCollapse () {
  const outputArea = document.getElementById('single-output-area')
  const toggle = document.querySelector(
    '#single-output-container .output-toggle'
  )

  if (outputArea.classList.contains('collapsed')) {
    outputArea.classList.remove('collapsed')
    toggle.classList.remove('collapsed')
  } else {
    outputArea.classList.add('collapsed')
    toggle.classList.add('collapsed')
  }
}

// Set up a multi-cell stage
function setupMultiCellStage (stage) {
  document.getElementById('single-cell-container').style.display = 'none'
  document.getElementById('cells-container').style.display = 'block'

  // Clean up existing single-cell editor if it exists
  if (editor) {
    try {
      editor.toTextArea()
    } catch (e) {
      console.log(
        'Editor cleanup error (expected when switching stage types):',
        e
      )
    }
    editor = null
  }

  // Clean up existing cell editors
  if (cellEditors.length > 0) {
    cellEditors.forEach(cellEditor => {
      try {
        if (cellEditor && cellEditor.toTextArea) {
          cellEditor.toTextArea()
        }
      } catch (e) {
        console.log('Cell editor cleanup error:', e)
      }
    })
  }

  // Clear existing cells
  document.getElementById('cells-container').innerHTML = ''
  cellEditors = []

  // Create cells for this stage
  stage.cells.forEach((cell, index) => {
    createCodeCell(cell, index, stage.cells.length)
  })

  // Refresh all cell editors to ensure proper layout calculation
  setTimeout(() => {
    cellEditors.forEach(ce => ce.refresh())

    // Auto-focus first cell editor on desktop (not mobile - would trigger keyboard)
    if (!isMobileDevice() && cellEditors.length > 0) {
      cellEditors[0].focus()
      // Position cursor at end of first TODO line or start of editor
      const content = cellEditors[0].getValue()
      const todoMatch = content.match(/# TODO:.*/)
      if (todoMatch) {
        const todoIndex = content.indexOf(todoMatch[0])
        const pos = cellEditors[0].posFromIndex(todoIndex + todoMatch[0].length)
        cellEditors[0].setCursor(pos)
      }
    }
  }, 50)
}

// Global execution counter
let executionCounter = 0

// Create a code cell for multi-cell stages (Google Colab style)
function createCodeCell (cell, index, totalCells) {
  const cellContainer = document.createElement('div')
  cellContainer.className = 'cell-container'
  cellContainer.id = `cell-${index}`

  // Create cell header
  const cellHeader = document.createElement('div')
  cellHeader.className = 'cell-header'
  // Execution counter (starts empty) with embedded play/stop icons
  const cellNumber = document.createElement('span')
  cellNumber.className = 'cell-number'
  cellNumber.textContent = '[ ]'
  cellNumber.id = `cell-number-${index}`

  // Add play and stop icons
  cellNumber.innerHTML = `
    [ ]
    <svg class="play-icon" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
    <svg class="stop-icon" viewBox="0 0 24 24" style="display: none;">
      <rect x="6" y="6" width="12" height="12"/>
    </svg>
  `

  const cellTitle = document.createElement('span')
  cellTitle.className = 'cell-title'
  cellTitle.textContent = cell.title || `Code Cell ${index + 1}`

  const cellStatus = document.createElement('span')
  cellStatus.className = 'cell-status pending'
  cellStatus.textContent = 'Pending'
  cellStatus.id = `cell-status-${index}`

  cellHeader.appendChild(cellNumber)
  cellHeader.appendChild(cellTitle)
  cellHeader.appendChild(cellStatus)
  cellContainer.appendChild(cellHeader)

  // Create instruction element if provided
  if (cell.instruction) {
    const instruction = document.createElement('div')
    instruction.className = 'cell-instruction'
    instruction.innerHTML = cell.instruction
    cellContainer.appendChild(instruction)
  }
  // Create code editor container
  const editorContainer = document.createElement('div')
  editorContainer.className = 'code-editor-container'

  // Create execution indicator (top-right corner)
  const executionIndicator = document.createElement('div')
  executionIndicator.className = 'cell-execution-indicator'
  executionIndicator.id = `execution-indicator-${index}`
  executionIndicator.style.display = 'none' // Initially hidden
  editorContainer.appendChild(executionIndicator)

  // Create code editor
  const editorElement = document.createElement('div')
  editorElement.className = 'code-editor'
  editorElement.id = `code-editor-${index}`
  editorContainer.appendChild(editorElement)

  cellContainer.appendChild(editorContainer)

  // Create collapsible output container
  const outputContainer = document.createElement('div')
  outputContainer.className = 'output-container'
  outputContainer.id = `output-container-${index}`
  outputContainer.style.display = 'none' // Initially hidden

  // Output header (for collapsing)
  const outputHeader = document.createElement('div')
  outputHeader.className = 'output-header'
  outputHeader.innerHTML = `
    <svg class="output-toggle" viewBox="0 0 24 24">
      <path d="M7 10l5 5 5-5z"/>
    </svg>
    <span class="output-label">Output</span>
    <span class="output-counter" id="output-counter-${index}"></span>
  `
  outputContainer.appendChild(outputHeader)

  // Output area
  const outputArea = document.createElement('div')
  outputArea.className = 'output-area empty'
  outputArea.id = `output-area-${index}`
  outputContainer.appendChild(outputArea)

  cellContainer.appendChild(outputContainer)

  // Add cell to container
  document.getElementById('cells-container').appendChild(cellContainer)
  // Initialize CodeMirror editor for this cell
  const cellEditor = CodeMirror(
    document.getElementById(`code-editor-${index}`),
    {
      value: cell.starterCode || '# Your code here\n',
      mode: 'python',
      theme: 'default', // Using default theme for Colab style
      lineNumbers: true,
      indentUnit: 4,
      matchBrackets: true,
      autoCloseBrackets: true,
      viewportMargin: Infinity, // Auto-resize height
      lineWrapping: true, // Enable line wrapping for mobile
      hintOptions: {
        hint: CodeMirror.hint.python,
        completeSingle: false
      },
      extraKeys: {
        'Ctrl-Enter': function () {
          runCellCode(
            cellEditor.getValue(),
            cell.expectedOutput,
            index,
            totalCells
          )
        },
        'Shift-Enter': function () {
          runCellCode(
            cellEditor.getValue(),
            cell.expectedOutput,
            index,
            totalCells
          )
        },
        'Ctrl-Space': 'autocomplete', // Auto-completion trigger
        Tab: function (cm) {
          // Better tab handling for mobile - autocomplete if popup is open, otherwise indent
          if (cm.state.completionActive) return CodeMirror.Pass
          if (cm.somethingSelected()) {
            cm.indentSelection('add')
          } else {
            cm.replaceSelection(
              cm.getOption('indentWithTabs')
                ? '\t'
                : ' '.repeat(cm.getOption('indentUnit'))
            )
          }
        }
      }
    }
  )
  cellEditors.push(cellEditor)

  // Add change listener to save state when content changes
  cellEditor.on('change', function () {
    // Debounce the save to avoid too frequent saves
    clearTimeout(cellEditor.saveTimeout)
    cellEditor.saveTimeout = setTimeout(() => {
      saveGameState()
    }, 1000) // Save after 1 second of no changes
  })

  // Mobile-friendly auto-completion: trigger completion after typing certain characters
  cellEditor.on('inputRead', function (cm, event) {
    // Auto-trigger completion on mobile after typing letters, dots, or underscores
    if (
      !cm.state.completionActive &&
      event.text &&
      event.text.length === 1 &&
      /[a-zA-Z._]/.test(event.text[0])
    ) {
      // Get current line content to check context
      const cursor = cm.getCursor()
      const line = cm.getLine(cursor.line)
      const beforeCursor = line.slice(0, cursor.ch)

      // Trigger completion if we have at least 2 characters of a word
      if (
        /[a-zA-Z_][a-zA-Z0-9_]*$/.test(beforeCursor) &&
        beforeCursor.match(/[a-zA-Z_][a-zA-Z0-9_]*$/)[0].length >= 2
      ) {
        setTimeout(() => cm.showHint({ completeSingle: false }), 100)
      }
    }
  })

  // Set up cell number click to run code (replacing separate run button)
  cellNumber.onclick = function () {
    runCellCode(cellEditor.getValue(), cell.expectedOutput, index, totalCells)
  }

  // Set up output header click to toggle collapse
  outputHeader.onclick = function () {
    toggleOutputCollapse(index)
  }
}

// Toggle output section collapse
function toggleOutputCollapse (cellIndex) {
  const outputArea = document.getElementById(`output-area-${cellIndex}`)
  const toggle = document.querySelector(
    `#output-container-${cellIndex} .output-toggle`
  )

  if (outputArea.classList.contains('collapsed')) {
    outputArea.classList.remove('collapsed')
    toggle.classList.remove('collapsed')
  } else {
    outputArea.classList.add('collapsed')
    toggle.classList.add('collapsed')
  }
}

// Update visual indicators for successful cell execution tracking
function updateCellExecutionIndicators () {
  const successfulCells = successfulCellExecutions[currentStage] || new Set()

  // Update all cell containers to show execution status
  document
    .querySelectorAll('.cell-container')
    .forEach((cellContainer, index) => {
      const executionIndicator = cellContainer.querySelector(
        `#execution-indicator-${index}`
      )

      if (!executionIndicator) return

      if (successfulCells.has(index)) {
        // Cell executed successfully
        executionIndicator.style.display = 'block'
        executionIndicator.textContent = '✓ OK'
        executionIndicator.className =
          'cell-execution-indicator successfully-executed'
        cellContainer.classList.add('successfully-executed')
        cellContainer.classList.remove('execution-failed')
      } else {
        // Check if cell has been executed but failed
        const cellStatus = cellContainer.querySelector('.cell-status')
        if (cellStatus && cellStatus.classList.contains('error')) {
          executionIndicator.style.display = 'block'
          executionIndicator.textContent = '✗ ERR'
          executionIndicator.className =
            'cell-execution-indicator execution-failed'
          cellContainer.classList.add('execution-failed')
          cellContainer.classList.remove('successfully-executed')
        } else {
          // Cell not executed or no status yet
          executionIndicator.style.display = 'none'
          cellContainer.classList.remove(
            'successfully-executed',
            'execution-failed'
          )
        }
      }
    })

  console.log(
    'Updated execution indicators. Successful cells:',
    Array.from(successfulCells)
  )
}

// Set up hint buttons and text
function setupHints (stage) {
  const hintsContainer = document.getElementById('hints-container')
  const hintTextContainer = document.getElementById('hint-text-container')

  // Clear existing hints
  hintsContainer.innerHTML = ''
  hintTextContainer.innerHTML = ''

  // Check if LLM mode is enabled
  if (ollamaLLM && ollamaLLM.isEnabled) {
    // LLM mode - show query buttons instead of traditional hints
    ollamaLLM.updateHintSystem()
    document.querySelector('.hint-section').style.display = 'block'
    return
  }

  // Traditional hint mode
  // If no hints, hide the section
  if (!stage.hints || stage.hints.length === 0) {
    document.querySelector('.hint-section').style.display = 'none'
    return
  }

  // Show the hint section
  document.querySelector('.hint-section').style.display = 'block'

  // Create hint buttons and text elements
  stage.hints.forEach((hint, index) => {
    // Create button
    const hintButton = document.createElement('button')
    hintButton.className = 'hint-button'
    hintButton.textContent = `Hint ${index + 1}`
    hintButton.onclick = function () {
      showHint(index)
    }
    hintsContainer.appendChild(hintButton)

    // Create text element (hidden initially)
    const hintText = document.createElement('div')
    hintText.className = 'hint-text'
    hintText.id = `hint-${index}`
    hintText.textContent = hint
    hintTextContainer.appendChild(hintText)
  })
}

// Show a specific hint
function showHint (hintIndex) {
  // Hide all hints
  document.querySelectorAll('.hint-text').forEach(el => {
    el.classList.remove('active')
  })

  // Show the selected hint
  document.getElementById(`hint-${hintIndex}`).classList.add('active')
}

// Run Python code (for single-cell stages) with Colab-style output
async function runPythonCode (code, solution) {
  // Dismiss tutorial if showing (user has learned to run code!)
  if (typeof endTutorial === 'function' && document.getElementById('tutorial-overlay')?.style.display !== 'none') {
    endTutorial()
  }

  const outputContainer = document.getElementById('single-output-container')
  const outputArea = document.getElementById('single-output-area')
  const outputCounter = document.getElementById('single-output-counter')
  const cellStatus = document.getElementById('single-cell-status')
  const cellNumber = document.getElementById('single-cell-number')

  // Increment execution counter and update display
  executionCounter++
  cellNumber.innerHTML = `
    [${executionCounter}]
    <svg class="play-icon" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
    <svg class="stop-icon" viewBox="0 0 24 24" style="display: none;">
      <rect x="6" y="6" width="12" height="12"/>
    </svg>
  `
  cellNumber.classList.add('executed')

  // Show output container and set running state
  outputContainer.style.display = 'block'
  outputArea.classList.remove('empty', 'collapsed')
  outputArea.classList.add('success')
  outputArea.textContent = 'Running code...'

  // Switch to running state with rotating border
  cellNumber.classList.add('running')

  cellStatus.textContent = 'Running'
  cellStatus.className = 'cell-status current'

  // Update counter
  const now = new Date()
  outputCounter.textContent = `Executed at ${now.getHours()}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`

  // Ensure Skulpt is ready
  if (!skulptReady) {
    try {
      outputArea.textContent = 'Loading Python engine...'
      await createSkulptLoadPromise()
    } catch (error) {
      outputArea.textContent =
        'Error: Python engine failed to load. Please refresh the page.'
      outputArea.classList.remove('success')
      outputArea.classList.add('error')
      cellNumber.classList.remove('running')
      cellStatus.textContent = 'Error'
      cellStatus.className = 'cell-status error'
      console.error('Skulpt loading error:', error)
      return
    }
  }

  try {
    // Variable to capture output text for validation
    let capturedOutput = ''

    // Configure Skulpt using the correct API
    Sk.pre = 'output'
    Sk.configure({
      output: function (text) {
        outputArea.textContent += text
        capturedOutput += text
      },
      read: function (x) {
        if (
          Sk.builtinFiles === undefined ||
          Sk.builtinFiles['files'][x] === undefined
        ) {
          throw "File not found: '" + x + "'"
        }
        return Sk.builtinFiles['files'][x]
      },
      execLimit: 10000,
      __future__: Sk.python3
    })

    // Clear output area
    outputArea.textContent = '' // Run the code using the correct API
    const promise = Sk.misceval.asyncToPromise(function () {
      return Sk.importMainWithBody('<stdin>', false, code, true)
    })

    promise
      .then(() => {
        // Reset cell number to normal state
        cellNumber.classList.remove('running')

        // Pass the captured output to validation
        checkCompletion(code, solution, capturedOutput.trim())
      })
      .catch(e => {
        outputArea.textContent += '\nError: ' + e.toString()
        outputArea.classList.remove('success')
        outputArea.classList.add('error')

        // Reset cell number to normal state
        cellNumber.classList.remove('running')

        cellStatus.textContent = 'Error'
        cellStatus.className = 'cell-status error'
      })
  } catch (e) {
    outputArea.textContent += '\nError: ' + e.toString()
    outputArea.classList.remove('success')
    outputArea.classList.add('error')

    // Reset cell number to normal state
    cellNumber.classList.remove('running')

    cellStatus.textContent = 'Error'
    cellStatus.className = 'cell-status error'
  }
}

// Run code for a specific cell (multi-cell stages) with Colab-style output
async function runCellCode (code, expectedOutput, cellIndex, totalCells) {
  // Dismiss tutorial if showing (user has learned to run code!)
  if (typeof endTutorial === 'function' && document.getElementById('tutorial-overlay')?.style.display !== 'none') {
    endTutorial()
  }

  const outputContainer = document.getElementById(
    `output-container-${cellIndex}`
  )
  const outputArea = document.getElementById(`output-area-${cellIndex}`)
  const outputCounter = document.getElementById(`output-counter-${cellIndex}`)
  const cellStatus = document.getElementById(`cell-status-${cellIndex}`)
  const cellNumber = document.getElementById(`cell-number-${cellIndex}`)

  // Increment execution counter and update display
  executionCounter++
  cellNumber.innerHTML = `
    [${executionCounter}]
    <svg class="play-icon" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
    <svg class="stop-icon" viewBox="0 0 24 24" style="display: none;">
      <rect x="6" y="6" width="12" height="12"/>
    </svg>
  `
  cellNumber.classList.add('executed')

  // Show output container and set running state
  outputContainer.style.display = 'block'
  outputArea.classList.remove('empty', 'collapsed')
  outputArea.classList.add('success')
  outputArea.textContent = 'Running code...'

  // Switch to running state with rotating border
  cellNumber.classList.add('running')

  cellStatus.textContent = 'Running'
  cellStatus.className = 'cell-status current'

  // Update counter
  const now = new Date()
  outputCounter.textContent = `Executed at ${now.getHours()}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`

  // Ensure Skulpt is ready
  if (!skulptReady) {
    try {
      outputArea.textContent = 'Loading Python engine...'
      await createSkulptLoadPromise()
    } catch (error) {
      outputArea.textContent =
        'Error: Python engine failed to load. Please refresh the page.'
      outputArea.classList.remove('success')
      outputArea.classList.add('error')
      cellNumber.classList.remove('running')
      cellStatus.textContent = 'Error'
      cellStatus.className = 'cell-status error'
      console.error('Skulpt loading error:', error)
      return
    }
  } // Store output to compare with expected
  let outputText = ''
  try {
    // Configure Skulpt to capture output for this cell
    Sk.pre = 'output'
    Sk.configure({
      output: function (text) {
        outputText += text
        outputArea.textContent += text
      },
      read: function (x) {
        if (
          Sk.builtinFiles === undefined ||
          Sk.builtinFiles['files'][x] === undefined
        ) {
          throw "File not found: '" + x + "'"
        }
        return Sk.builtinFiles['files'][x]
      },
      execLimit: 10000,
      __future__: Sk.python3
    }) // Clear output area for this cell
    outputArea.textContent = ''
    outputText = '' // Execute code in the persistent environment to maintain variables between cells
    try {
      // For multi-cell stages, we need to maintain the Python namespace between executions
      // Build accumulated code from successfully executed cells plus the current cell
      let accumulatedCode = ''

      // Get current stage to access all cells
      const stage = gameContent.stages.find(s => s.id === currentStage)
      if (stage && stage.cells) {
        // Add code from all successfully executed cells first
        const successfulCells =
          successfulCellExecutions[currentStage] || new Set()
        for (let i = 0; i < cellIndex; i++) {
          if (successfulCells.has(i)) {
            const cellCode = cellEditors[i].getValue()
            if (cellCode.trim()) {
              accumulatedCode += cellCode + '\n'
            }
          }
        }

        // Add the current cell's code (always include it for execution)
        const currentCellCode = cellEditors[cellIndex].getValue()
        if (currentCellCode.trim()) {
          accumulatedCode += currentCellCode + '\n'
        }
      } // Execute the accumulated code to maintain variable persistence
      console.log(`Cell ${cellIndex}: Executing accumulated code`)
      console.log(
        'Successful cells included:',
        Array.from(successfulCellExecutions[currentStage] || [])
      )
      console.log('Current cell being executed:', cellIndex)
      console.log('Accumulated code:', accumulatedCode)
      const promise = Sk.misceval.asyncToPromise(function () {
        return Sk.importMainWithBody('<stdin>', false, accumulatedCode, true)
      })

      promise
        .then(() => {
          // Execution was successful - mark this cell as successfully executed
          if (!successfulCellExecutions[currentStage]) {
            successfulCellExecutions[currentStage] = new Set()
          }
          successfulCellExecutions[currentStage].add(cellIndex)
          saveGameState()

          // Reset cell number to normal state
          cellNumber.classList.remove('running')

          // Get cell data for enhanced validation
          const stage = gameContent.stages.find(s => s.id === currentStage)
          const cellData = stage && stage.cells ? stage.cells[cellIndex] : null

          // Check if output matches expected with enhanced validation
          if (checkCellOutput(outputText, expectedOutput, cellData)) {
            cellStatus.textContent = 'Completed'
            cellStatus.className = 'cell-status completed'
            outputArea.classList.remove('error')
            outputArea.classList.add('success')
            
            // Add inline narrative response
            const narrativeMessage = getNarrativeResponse(currentStage, cellIndex, outputText);
            showInlineNarrative(cellIndex, outputText, narrativeMessage);
            
            // Unlock next excavation layer if using that UI
            unlockNextLayer(cellIndex);
            
            // Check if all cells are completed
            checkAllCellsCompleted(totalCells)

            // Update visual indicators
            updateCellExecutionIndicators()
          } else {
            // Validation failed - remove this cell from successful executions
            if (successfulCellExecutions[currentStage]) {
              successfulCellExecutions[currentStage].delete(cellIndex)
            }

            // Provide specific, helpful error feedback
            const specificFeedback = generateSpecificCellFeedback(
              outputText,
              expectedOutput,
              cellData,
              cellIndex
            )
            cellStatus.textContent = specificFeedback.statusText
            cellStatus.className = 'cell-status error'
            outputArea.classList.remove('success')
            outputArea.classList.add('error')

            // Add helpful feedback to the output area
            const feedbackDiv = document.createElement('div')
            feedbackDiv.className = 'cell-feedback'
            feedbackDiv.innerHTML = specificFeedback.detailedMessage
            outputArea.appendChild(feedbackDiv)

            // Automatically show relevant hints if validation fails
            if (specificFeedback.suggestedHints.length > 0) {
              showSpecificHints(specificFeedback.suggestedHints)
            }

            // Enhanced feedback for debugging
            console.log('Cell validation failed:')
            console.log('Expected:', expectedOutput)
            console.log('Actual output:', outputText)
            console.log('Cell data:', cellData)
            console.log('Feedback:', specificFeedback)

            // Update visual indicators
            updateCellExecutionIndicators()
          }
        })
        .catch(e => {
          // Execution failed - remove this cell from successful executions if it was there
          if (successfulCellExecutions[currentStage]) {
            successfulCellExecutions[currentStage].delete(cellIndex)
          }
          console.error('Error executing code:', e)
          outputArea.textContent += '\nError: ' + e.toString()
          outputArea.classList.remove('success')
          outputArea.classList.add('error')

          // Reset cell number to normal state
          cellNumber.classList.remove('running')

          cellStatus.textContent = 'Error'
          cellStatus.className = 'cell-status error'

          // Update visual indicators
          updateCellExecutionIndicators()
        })
    } catch (e) {
      console.error('Error in code execution setup:', e)
      outputArea.textContent += '\nError: ' + e.toString()
      outputArea.classList.remove('success')
      outputArea.classList.add('error')

      // Reset cell number to normal state
      cellNumber.classList.remove('running')

      cellStatus.textContent = 'Error'
      cellStatus.className = 'cell-status error'
    }
  } catch (e) {
    console.error('Error in runCellCode:', e)
    outputArea.textContent += '\nError: ' + e.toString()
    outputArea.classList.remove('success')
    outputArea.classList.add('error')

    // Reset cell number to normal state
    cellNumber.classList.remove('running')

    cellStatus.textContent = 'Error'
    cellStatus.className = 'cell-status error'
  }
}

// Check if cell output matches expected output with flexible validation
function checkCellOutput (output, expectedOutput, cellData = null) {
  if (!expectedOutput) return true

  // Enhanced validation for multi-cell stages with cell-specific validation
  if (cellData && cellData.validation) {
    return validateCellWithPatterns(output, cellData.validation)
  }

  // If expectedOutput is an array of strings, check if all are present with flexible matching
  if (Array.isArray(expectedOutput)) {
    return expectedOutput.every(expected => {
      return flexibleOutputMatch(output, expected)
    })
  }

  // For single expected output, do flexible comparison
  return flexibleOutputMatch(output, expectedOutput)
}

// Flexible output matching with multiple strategies
function flexibleOutputMatch (output, expected) {
  const normalizedOutput = output.toLowerCase().replace(/\s+/g, ' ').trim()
  const normalizedExpected = expected.toLowerCase().replace(/\s+/g, ' ').trim()

  // Strategy 1: Direct substring match
  if (normalizedOutput.includes(normalizedExpected)) {
    return true
  }

  // Strategy 2: Extract numbers and key words for numeric comparisons
  const outputNumbers = extractNumbers(output)
  const expectedNumbers = extractNumbers(expected)

  if (expectedNumbers.length > 0 && outputNumbers.length > 0) {
    // Check if expected numbers appear in output
    const hasAllNumbers = expectedNumbers.every(num =>
      outputNumbers.some(outNum => Math.abs(outNum - num) < 0.001)
    )

    if (hasAllNumbers) {
      // Also check for key contextual words
      const expectedWords = normalizedExpected
        .split(/\s+/)
        .filter(word => word.length > 3 && !isNumber(word))
      const hasContextWords =
        expectedWords.length === 0 ||
        expectedWords.some(word => normalizedOutput.includes(word))

      return hasContextWords
    }
  }

  // Strategy 3: Pattern-based matching for common output formats
  return patternBasedMatch(normalizedOutput, normalizedExpected)
}

// Extract numbers from text
function extractNumbers (text) {
  const matches = text.match(/\d+\.?\d*/g)
  return matches ? matches.map(Number) : []
}

// Check if string represents a number
function isNumber (str) {
  return !isNaN(parseFloat(str)) && isFinite(str)
}

// Pattern-based matching for common output patterns
function patternBasedMatch (output, expected) {
  // Handle common patterns like "X: Y" or "X = Y"
  const expectedPattern = expected
    .replace(/\d+/g, '\\d+')
    .replace(/:/g, '\\s*:\\s*')
  try {
    const regex = new RegExp(expectedPattern, 'i')
    return regex.test(output)
  } catch (e) {
    return false
  }
}

// Validate cell output using pattern-based validation rules
function validateCellWithPatterns (output, validation) {
  if (!validation) return true

  const normalizedOutput = output.toLowerCase().replace(/\s+/g, ' ').trim()

  // Check required output patterns
  if (validation.outputPatterns) {
    const patterns = validation.outputPatterns.map(p => new RegExp(p, 'i'))
    const passed = patterns.every(pattern => pattern.test(normalizedOutput))
    if (!passed) return false
  }

  // Check required numbers in output
  if (validation.requiredNumbers) {
    const outputNumbers = extractNumbers(output)
    const hasAllNumbers = validation.requiredNumbers.every(num =>
      outputNumbers.some(outNum => Math.abs(outNum - num) < 0.001)
    )
    if (!hasAllNumbers) return false
  }

  // Check required text phrases
  if (validation.requiredText) {
    const hasAllText = validation.requiredText.every(text =>
      normalizedOutput.includes(text.toLowerCase())
    )
    if (!hasAllText) return false
  }

  return true
}

// Generate specific feedback for cell validation failures
function generateSpecificCellFeedback (
  actualOutput,
  expectedOutput,
  cellData,
  cellIndex
) {
  const feedback = {
    statusText: 'Validation Failed',
    detailedMessage: '',
    suggestedHints: []
  }

  // Get current stage for context
  const stage = gameContent.stages.find(s => s.id === currentStage)
  const availableHints = stage ? stage.hints || [] : []

  // Analyze the type of validation failure
  if (!actualOutput || actualOutput.trim() === '') {
    feedback.statusText = 'No Output'
    feedback.detailedMessage = `
      <strong>🚫 No output detected</strong><br>
      Your code ran but didn't produce any output. Make sure to:
      <ul>
        <li>Use <code>print()</code> statements to display results</li>
        <li>Check that your code is properly indented</li>
        <li>Verify your code actually executes the calculation</li>
      </ul>
    `
    // Suggest hints related to printing or basic syntax
    feedback.suggestedHints = availableHints.slice(0, 1) // First hint usually covers basics
  } else if (cellData && cellData.validation) {
    // Cell has specific validation rules - analyze what failed
    const validation = cellData.validation

    if (validation.requiredNumbers) {
      const actualNumbers = extractNumbers(actualOutput)
      const missingNumbers = validation.requiredNumbers.filter(
        num =>
          !actualNumbers.some(actualNum => Math.abs(actualNum - num) < 0.001)
      )

      if (missingNumbers.length > 0) {
        feedback.statusText = 'Wrong Numbers'
        feedback.detailedMessage = `
          <strong>🔢 Calculation error detected</strong><br>
          Expected numbers: <code>${validation.requiredNumbers.join(
            ', '
          )}</code><br>
          Your output contains: <code>${actualNumbers.join(', ')}</code><br>
          Missing: <code>${missingNumbers.join(', ')}</code><br>
          <em>Double-check your mathematical calculations and variable assignments.</em>
        `
        // Suggest calculation-related hints
        feedback.suggestedHints = availableHints
          .filter(
            hint =>
              hint.toLowerCase().includes('calculat') ||
              hint.toLowerCase().includes('math') ||
              hint.toLowerCase().includes('number')
          )
          .slice(0, 2)
      }
    }

    if (validation.requiredText) {
      const normalizedOutput = actualOutput.toLowerCase()
      const missingText = validation.requiredText.filter(
        text => !normalizedOutput.includes(text.toLowerCase())
      )

      if (missingText.length > 0) {
        feedback.statusText = 'Missing Text'
        feedback.detailedMessage = `
          <strong>📝 Output format issue</strong><br>
          Missing required text: <code>${missingText.join(', ')}</code><br>
          <em>Check that your print statements include all the required labels and formatting.</em>
        `
        // Suggest formatting-related hints
        feedback.suggestedHints = availableHints
          .filter(
            hint =>
              hint.toLowerCase().includes('format') ||
              hint.toLowerCase().includes('print') ||
              hint.toLowerCase().includes('output')
          )
          .slice(0, 2)
      }
    }

    if (validation.outputPatterns) {
      const failedPatterns = validation.outputPatterns.filter(
        pattern => !new RegExp(pattern, 'i').test(actualOutput)
      )

      if (failedPatterns.length > 0) {
        feedback.statusText = 'Pattern Mismatch'
        feedback.detailedMessage = `
          <strong>📋 Output pattern doesn't match</strong><br>
          Your output format doesn't match the expected pattern.<br>
          <em>Review the instruction carefully and check your output format.</em>
        `
        // Suggest format-related hints
        feedback.suggestedHints = availableHints
          .filter(
            hint =>
              hint.toLowerCase().includes('format') ||
              hint.toLowerCase().includes('structure')
          )
          .slice(0, 2)
      }
    }
  } else if (Array.isArray(expectedOutput)) {
    // Multiple expected outputs - check which are missing
    const missingOutputs = expectedOutput.filter(
      expected => !flexibleOutputMatch(actualOutput, expected)
    )

    if (missingOutputs.length > 0) {
      feedback.statusText = 'Incomplete Output'
      feedback.detailedMessage = `
        <strong>📋 Incomplete results</strong><br>
        Missing expected outputs:
        <ul>
          ${missingOutputs
            .map(output => `<li><code>${output}</code></li>`)
            .join('')}
        </ul>
        <em>Make sure your code produces all the required output lines.</em>
      `
      // Suggest comprehensive hints
      feedback.suggestedHints = availableHints.slice(0, 2)
    }
  } else {
    // Single expected output doesn't match
    feedback.statusText = 'Output Mismatch'
    feedback.detailedMessage = `
      <strong>🎯 Output doesn't match expected result</strong><br>
      Expected: <code>${expectedOutput}</code><br>
      Your output: <code>${actualOutput.slice(0, 200)}${
      actualOutput.length > 200 ? '...' : ''
    }</code><br>
      <em>Compare your output carefully with what's expected.</em>
    `
    // Suggest general hints
    feedback.suggestedHints = availableHints.slice(0, 2)
  }

  // If we still have a generic message, provide more specific guidance
  if (feedback.detailedMessage === '') {
    feedback.detailedMessage = `
      <strong>❌ Cell ${cellIndex + 1} validation failed</strong><br>
      <em>Review your code logic and expected output format. Use the hints below for guidance.</em>
    `
    feedback.suggestedHints = availableHints.slice(0, 1)
  }

  return feedback
}

// Generate specific feedback for single-cell validation failures
function generateSpecificSingleCellFeedback (
  actualOutput,
  solution,
  stage,
  validationResult
) {
  const feedback = {
    statusText: 'Validation Failed',
    detailedMessage: '',
    suggestedHints: []
  }

  const availableHints = stage ? stage.hints || [] : []

  // Analyze validation failure type
  if (!actualOutput || actualOutput.trim() === '') {
    feedback.statusText = 'No Output'
    feedback.detailedMessage = `
      <strong>🚫 No output detected</strong><br>
      Your code ran but didn't produce any output. Make sure to:
      <ul>
        <li>Use <code>print()</code> statements to display results</li>
        <li>Check that your code is properly indented</li>
        <li>Verify your code actually executes the calculation</li>
      </ul>
    `
    feedback.suggestedHints = availableHints.slice(0, 1)
  } else if (validationResult && validationResult.reason) {
    // Use specific validation failure reason
    const reason = validationResult.reason.toLowerCase()

    if (reason.includes('pattern') || reason.includes('format')) {
      feedback.statusText = 'Format Issue'
      feedback.detailedMessage = `
        <strong>📋 Output format doesn't match expected pattern</strong><br>
        <br>
        <strong>What you printed:</strong><br>
        <code>${actualOutput || '(no output)'}</code><br>
        <br>
        <strong>Issue:</strong> ${validationResult.reason}<br>
        <br>
        <em>Tip: Pay close attention to the exact wording in your print statements. Use "Fragments" (plural) in your output text.</em>
      `
      feedback.suggestedHints = availableHints
        .filter(
          hint =>
            hint.toLowerCase().includes('format') ||
            hint.toLowerCase().includes('output') ||
            hint.toLowerCase().includes('print')
        )
        .slice(0, 2)
    } else if (reason.includes('number') || reason.includes('calculation')) {
      feedback.statusText = 'Calculation Error'
      feedback.detailedMessage = `
        <strong>🔢 Mathematical calculation issue</strong><br>
        ${validationResult.reason}<br>
        <em>Double-check your calculations and variable assignments.</em>
      `
      feedback.suggestedHints = availableHints
        .filter(
          hint =>
            hint.toLowerCase().includes('calculat') ||
            hint.toLowerCase().includes('math') ||
            hint.toLowerCase().includes('number')
        )
        .slice(0, 2)
    } else if (reason.includes('Next step') || reason.includes('code') || reason.includes('syntax')) {
      feedback.statusText = 'In Progress'
      feedback.detailedMessage = `
        <strong>📝 ${validationResult.reason}</strong><br>
        <em>Check the TODO comments in the code for guidance.</em>
      `
      feedback.suggestedHints = availableHints
        .filter(
          hint =>
            hint.toLowerCase().includes('code') ||
            hint.toLowerCase().includes('syntax') ||
            hint.toLowerCase().includes('structure')
        )
        .slice(0, 2)
    } else {
      feedback.statusText = 'Validation Failed'
      feedback.detailedMessage = `
        <strong>❌ Solution doesn't meet requirements</strong><br>
        ${validationResult.reason}<br>
        <em>Review the challenge requirements and try again.</em>
      `
      feedback.suggestedHints = availableHints.slice(0, 2)
    }
  } else {
    // Generic validation failure
    feedback.statusText = 'Solution Incorrect'
    feedback.detailedMessage = `
      <strong>❌ Solution doesn't meet the challenge requirements</strong><br>
      <em>Review your code logic and the expected output. Use the hints below for guidance.</em>
    `
    feedback.suggestedHints = availableHints.slice(0, 1)
  }

  // Ensure we have some hints to suggest
  if (feedback.suggestedHints.length === 0 && availableHints.length > 0) {
    feedback.suggestedHints = availableHints.slice(0, 1)
  }

  return feedback
}

// Automatically show specific hints when validation fails
function showSpecificHints (suggestedHints) {
  if (!suggestedHints || suggestedHints.length === 0) return

  const hintTextContainer = document.getElementById('hint-text-container')
  if (!hintTextContainer) return

  // Clear existing auto-shown hints
  const existingAutoHints = hintTextContainer.querySelectorAll('.auto-hint')
  existingAutoHints.forEach(hint => hint.remove())

  // Show suggested hints automatically
  suggestedHints.forEach((hintText, index) => {
    const autoHintDiv = document.createElement('div')
    autoHintDiv.className = 'hint-text active auto-hint'
    autoHintDiv.innerHTML = `
      <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid #ffc107; border-radius: 4px; padding: 8px; margin: 4px 0;">
        <strong>💡 Suggested Hint:</strong> ${hintText}
      </div>
    `
    hintTextContainer.appendChild(autoHintDiv)
  })

  // Scroll to hints if they were added
  if (suggestedHints.length > 0) {
    hintTextContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

// Check if all cells in a multi-cell stage are completed
function checkAllCellsCompleted (totalCells) {
  // Count only completed cells in the current stage's cells container
  const cellsContainer = document.getElementById('cells-container')
  if (!cellsContainer) return

  const completedCells = cellsContainer.querySelectorAll(
    '.cell-status.completed'
  ).length

  console.log(
    `Stage ${currentStage}: ${completedCells} of ${totalCells} cells completed`
  )

  if (completedCells === totalCells) {
    // All cells completed, show next button
    document.getElementById('next-button').classList.add('active')
    if (!completedStages.includes(currentStage)) {
      completedStages.push(currentStage)
      updateDevNav()
      saveGameState()
    }
    console.log(
      `Stage ${currentStage} completed! All ${totalCells} cells done.`
    )

    // Trigger Dr. Rodriguez's discovery reaction for the complete stage
    if (window.llmIntegration && window.llmIntegration.isEnabled) {
      // Gather all cell outputs for context
      const allOutputs = []
      for (let i = 0; i < totalCells; i++) {
        const outputArea = document.getElementById(`output-area-${i}`)
        if (outputArea) {
          allOutputs.push(`Task ${i + 1}: ${outputArea.textContent}`)
        }
      }
      window.llmIntegration.triggerDiscoveryReaction(allOutputs.join('\n'))
    }
  }
}

// Comprehensive solution validation with pattern matching
async function validateSolution (code, solution, actualOutput, stage) {
  // Get validation rules from the stage data (from JSON)
  const rules = stage.validation
  console.log('Validating stage:', stage.id, 'with rules:', rules)

  // If no specific rules, fall back to simple output comparison
  if (!rules) {
    try {
      const expectedOutput = await executeCodeAndCaptureOutput(solution)
      const isCorrect =
        normalizeOutput(actualOutput) === normalizeOutput(expectedOutput)
      return {
        isCorrect,
        reason: isCorrect
          ? 'Output matches expected'
          : 'Output does not match expected',
        expectedPatterns: [expectedOutput]
      }
    } catch (error) {
      return {
        isCorrect: false,
        reason: 'Could not execute solution code',
        expectedPatterns: []
      }
    }
  }

  // Convert string patterns to regex objects
  const codePatterns = rules.codePatterns.map(
    pattern => new RegExp(pattern, 'i')
  )
  const outputPatterns = rules.outputPatterns.map(
    pattern => new RegExp(pattern, 'i')
  )

  // Check code patterns (structure validation)
  const codeValidation = validateCodePatterns(code, codePatterns, rules.codePatterns)
  if (!codeValidation.isValid) {
    // Provide human-readable explanation of what's expected
    const codeExplanation = explainCodePattern(codeValidation.missingPattern, codeValidation.patternIndex, stage)
    return {
      isCorrect: false,
      reason: `Next step: ${codeExplanation}`,
      feedback: 'Keep going!',
      expectedPatterns: rules.codePatterns
    }
  }

  // Check output patterns (result validation)
  const outputValidation = validateOutputPatterns(actualOutput, outputPatterns, rules.outputPatterns)
  if (!outputValidation.isValid) {
    // Provide human-readable explanation of what's expected
    const patternExplanation = explainOutputPattern(outputValidation.missingPattern, outputValidation.patternIndex, stage)
    return {
      isCorrect: false,
      reason: `Output format issue: ${patternExplanation}`,
      feedback: 'Output incorrect',
      expectedPatterns: rules.outputPatterns,
      actualOutput: actualOutput
    }
  }

  // All validations passed
  return {
    isCorrect: true,
    reason: 'All validations passed',
    expectedPatterns: rules.outputPatterns
  }
}

// Validate code against required patterns
function validateCodePatterns (code, patterns, originalPatterns) {
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    if (!pattern.test(code)) {
      return {
        isValid: false,
        missingPattern: pattern.source || pattern.toString(),
        patternIndex: i,
        originalPattern: originalPatterns ? originalPatterns[i] : null
      }
    }
  }
  return { isValid: true }
}

// Validate output against expected patterns
function validateOutputPatterns (output, patterns, originalPatterns) {
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    if (!pattern.test(output)) {
      return {
        isValid: false,
        missingPattern: pattern.source || pattern.toString(),
        patternIndex: i,
        originalPattern: originalPatterns ? originalPatterns[i] : null
      }
    }
  }
  return { isValid: true }
}

// Explain output pattern in human-readable terms
function explainOutputPattern (patternStr, patternIndex, stage) {
  // Stage-specific explanations for common patterns
  if (stage.id === 1) {
    // Stage 1: Manuscript variables
    if (patternIndex === 0) {
      return 'Your output must include "Manuscript Catalog" followed by "MS-ALEX-2847"'
    } else if (patternIndex === 1) {
      return 'Your output must include the word "Fragments" (or "Fragment") near the number 23. Try: "Fragments Found: 23"'
    }
  }

  // Generic pattern explanation
  // Try to make regex more readable
  const readable = patternStr
    .replace(/\.\*/g, ' (any text) ')
    .replace(/\\s\*/g, ' ')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/\|/g, ' OR ')
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .replace(/\\/g, '')

  return `Expected pattern: ${readable}. Check that your print statement includes the right text format.`
}

// Explain code pattern in human-readable terms
function explainCodePattern (patternStr, patternIndex, stage) {
  // Stage-specific explanations
  if (stage.id === 1) {
    // Stage 1: Manuscript variables
    if (patternIndex === 0) {
      return 'Create a variable named "fragment_count" and set it to 23 (e.g., fragment_count = 23)'
    } else if (patternIndex === 1) {
      return 'Add a print statement that includes the fragment_count variable'
    }
  }

  // Generic explanations based on pattern type
  // For loop patterns
  if (/for\\s\+\\w\+\\s\+in/.test(patternStr)) {
    return 'Your code needs a for loop to iterate through the data (e.g., for item in list:)'
  }

  // Function definition patterns
  const funcMatch = patternStr.match(/def\\s\+(\w+)\\s\*\\\(/)
  if (funcMatch) {
    const funcName = funcMatch[1].replace(/\\/g, '')
    return `Define a function named "${funcName}" (e.g., def ${funcName}(...):)`
  }

  // Variable assignment patterns
  const varMatch = patternStr.match(/(\w+)\\s\*=/)
  if (varMatch) {
    const varName = varMatch[1].replace(/\\/g, '')
    return `Create or use a variable named "${varName}"`
  }

  // Method call patterns
  if (/\\.replace\\s*\(/.test(patternStr)) {
    return 'Use the .replace() method to substitute text'
  }

  if (/total_characters\\s*\[\+=\]/.test(patternStr)) {
    return 'Update the total_characters variable (use += to add to it)'
  }

  // Generic fallback - try to make regex more readable
  const readable = patternStr
    .replace(/\\s\+/g, ' ')
    .replace(/\\s\*/g, '')
    .replace(/\\w\+/g, 'word')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\/g, '')
    .replace(/\[\^/g, 'not ')
    .replace(/\]/g, '')
    .replace(/\[/g, '')
    .replace(/\|/g, ' or ')
    .replace(/\.\*/g, '...')
    .replace(/\.\+/g, '...')

  return `Your code structure needs: ${readable}. Review the challenge instructions.`
}

// Normalize output for comparison (remove extra whitespace, etc.)
function normalizeOutput (output) {
  return output
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .toLowerCase() // Case insensitive comparison
}

// Helper function to execute Python code and capture output
async function executeCodeAndCaptureOutput (code) {
  return new Promise((resolve, reject) => {
    let output = ''

    // Configure Skulpt to capture output
    Sk.configure({
      output: function (text) {
        output += text
      },
      read: function (x) {
        if (
          Sk.builtinFiles === undefined ||
          Sk.builtinFiles['files'][x] === undefined
        ) {
          throw "File not found: '" + x + "'"
        }
        return Sk.builtinFiles['files'][x]
      },
      execLimit: 10000,
      __future__: Sk.python3
    })

    // Execute the code
    const promise = Sk.misceval.asyncToPromise(function () {
      return Sk.importMainWithBody('<stdin>', false, code, true)
    })

    promise
      .then(() => {
        resolve(output.trim())
      })
      .catch(e => {
        reject(e)
      })
  })
}

// Check if single-cell stage is completed with flexible validation
async function checkCompletion (code, solution, actualOutput) {
  const cellStatus = document.getElementById('single-cell-status')

  try {
    // Get current stage info for validation rules
    const stage = gameContent.stages.find(s => s.id === currentStage)

    // Perform multi-layered validation
    const validationResult = await validateSolution(
      code,
      solution,
      actualOutput,
      stage
    )

    if (validationResult.isCorrect) {
      // Solution is correct
      cellStatus.textContent = 'Completed'
      cellStatus.className = 'cell-status completed'

      // Show next button
      document.getElementById('next-button').classList.add('active')
      if (!completedStages.includes(currentStage)) {
        completedStages.push(currentStage)
        updateDevNav()
        saveGameState()
      }

      // Trigger Dr. Rodriguez's discovery reaction if LLM is enabled
      if (window.llmIntegration && window.llmIntegration.isEnabled) {
        window.llmIntegration.triggerDiscoveryReaction(actualOutput)
      }
    } else {
      // Solution is incorrect - provide specific feedback
      const outputArea = document.getElementById('single-output-area')

      // Generate specific feedback for single-cell validation failure
      const specificFeedback = generateSpecificSingleCellFeedback(
        actualOutput,
        solution,
        stage,
        validationResult
      )
      cellStatus.textContent = specificFeedback.statusText
      cellStatus.className = 'cell-status error'

      // Clear previous feedback and add new specific feedback
      if (outputArea) {
        const existingFeedback = outputArea.querySelector('.cell-feedback')
        if (existingFeedback) {
          existingFeedback.remove()
        }

        // Add helpful feedback to the output area
        const feedbackDiv = document.createElement('div')
        feedbackDiv.className = 'cell-feedback'
        feedbackDiv.innerHTML = specificFeedback.detailedMessage
        outputArea.appendChild(feedbackDiv)

        // Automatically show relevant hints if validation fails
        if (specificFeedback.suggestedHints.length > 0) {
          showSpecificHints(specificFeedback.suggestedHints)
        }
      }

      // Show debug info in console
      console.log('Validation failed:', validationResult.reason)
      console.log('Expected patterns:', validationResult.expectedPatterns)
      console.log('User code:', code)
      console.log('Actual output:', actualOutput)
      console.log('Single-cell feedback:', specificFeedback)

      // Don't show next button for incorrect solutions
      document.getElementById('next-button').classList.remove('active')
    }
  } catch (error) {
    console.error('Error checking solution:', error)
    // If we can't validate, mark as completed (fallback behavior)
    cellStatus.textContent = 'Completed'
    cellStatus.className = 'cell-status completed'

    // Show next button
    document.getElementById('next-button').classList.add('active')
    if (!completedStages.includes(currentStage)) {
      completedStages.push(currentStage)
      updateDevNav()
      saveGameState()
    }
  }
}

// Create developer navigation for testing
function createDevNav () {
  const devNav = document.getElementById('dev-nav')
  devNav.innerHTML = ''

  // Create a button for each stage
  for (let i = 1; i <= gameContent.gameInfo.totalStages; i++) {
    const button = document.createElement('button')
    button.textContent = i
    button.onclick = function () {
      loadStage(i)
    }
    devNav.appendChild(button)
  }

  // Set up toggle button
  document.getElementById('dev-nav-toggle').onclick = function () {
    devNav.classList.toggle('active')
  }
}

// Update developer navigation to highlight current stage
function updateDevNav () {
  const buttons = document.querySelectorAll('#dev-nav button')

  buttons.forEach((button, index) => {
    // Clear existing classes
    button.className = ''

    // Set current stage class
    if (index + 1 === currentStage) {
      button.classList.add('current-stage')
    }

    // Mark completed stages
    if (completedStages.includes(index + 1)) {
      button.classList.add('completed-stage')
    }
  })
}

// Show celebration animation when a stage is completed
function showCelebration () {
  const container = document.getElementById('celebration')
  container.innerHTML = ''
  container.classList.add('active')

  // Create confetti
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div')
    confetti.className = 'confetti'

    // Random position, color, size, and animation duration
    const left = Math.random() * 100
    const color = `hsl(${Math.random() * 360}, 80%, 60%)`
    const size = Math.random() * 10 + 5
    const duration = Math.random() * 3 + 2

    confetti.style.left = `${left}%`
    confetti.style.background = color
    confetti.style.width = `${size}px`
    confetti.style.height = `${size}px`
    confetti.style.animationDuration = `${duration}s`

    container.appendChild(confetti)
  }

  // Remove celebration after animation completes
  setTimeout(() => {
    container.classList.remove('active')
  }, 5000)
}

// Stage transition dialogues - narrative-driven messages for story progression
const stageTransitionDialogues = {
  0: {
    character: 'Dr. Rodriguez',
    avatar: '👩‍🔬',
    dialogue: "Wonderful! Your terminal is configured and ready. Now let's dive into our first real discovery—the mysterious manuscript fragments I've been analyzing for years.",
    narrative: "The research terminal hums to life. Somewhere in the Alexandria archives, ancient secrets await..."
  },
  1: {
    character: 'Dr. Rodriguez',
    avatar: '👩‍🔬',
    dialogue: "Excellent work cataloging those manuscript details! The fragment reference numbers are now in our system. I've been waiting five years to properly analyze these...",
    narrative: "The manuscript data is secured. But these 23 fragments are just the beginning of something much larger."
  },
  2: {
    character: 'Jamie Chen',
    avatar: '🧑‍💻',
    dialogue: "Nice one! Dr. R was just telling me about your progress. I've been cross-referencing these artifact dates with some anomalies I found in the server logs...",
    narrative: "The artifact timeline reveals an unexpected pattern. These items span millennia, yet share mysterious connections."
  },
  3: {
    character: 'Dr. Rodriguez',
    avatar: '👩‍🔬',
    dialogue: "Your analysis of the patterns is remarkable! We can now process hundreds of fragments automatically. My grandmother's journals mentioned something about 'repeating cycles'...",
    narrative: "The loop patterns match symbols found in the original Alexandria manuscripts. The Keepers were onto something."
  },
  4: {
    character: 'ARIA',
    avatar: '🤖',
    dialogue: "I'm now fully operational. Dr. Rodriguez has granted me access to assist with the investigation. I've detected unusual data signatures in the archives that require further analysis.",
    narrative: "A new ally joins the investigation. ARIA's computational abilities may prove essential in decoding what lies ahead."
  },
  5: {
    character: 'Jamie Chen',
    avatar: '🧑‍💻',
    dialogue: "These analysis functions you've built? They just flagged something weird in sector 7 of the archives. Dr. R is already on her way to check it out.",
    narrative: "The modular tools reveal hidden connections. Each function brings you closer to understanding the Bridge Builders' methods."
  },
  6: {
    character: 'Dr. Rodriguez',
    avatar: '👩‍🔬',
    dialogue: "The structured data you've organized... it matches a cipher my grandmother documented decades ago. The Bridge Builders used similar organizational systems.",
    narrative: "Ancient and modern merge. The data structures mirror techniques used by scholars thousands of years ago."
  },
  7: {
    character: 'ARIA',
    avatar: '🤖',
    dialogue: "I've completed my scan of the extracted files. There are encrypted segments that appear to contain coordinates. Dr. Rodriguez believes they point to a physical location.",
    narrative: "Digital breadcrumbs lead to physical places. The archives contain more than just text—they contain a map."
  },
  8: {
    character: 'Dr. Rodriguez',
    avatar: '👩‍🔬',
    dialogue: "We're so close now. The patterns, the coordinates, the fragments—they're all converging. I can feel my grandmother's presence in this work, guiding us forward.",
    narrative: "Years of research crystallize into clarity. The final piece of the puzzle awaits."
  },
  9: {
    character: 'Dr. Rodriguez',
    avatar: '👩‍🔬',
    dialogue: "You've done it. Together, we've uncovered what the Bridge Builders protected for millennia. This knowledge... it changes everything we thought we knew.",
    narrative: "The investigation concludes, but the story continues. Some secrets, once revealed, open doors to even greater mysteries.",
    isFinal: true
  }
}

// Show stage transition modal instead of confetti
function showStageTransition (completedStageId) {
  const modal = document.getElementById('stage-transition-modal')
  if (!modal) return

  const nextStageId = completedStageId + 1
  const nextStage = gameContent.stages.find(s => s.id === nextStageId)
  const transitionData = stageTransitionDialogues[completedStageId] || {
    character: 'Dr. Rodriguez',
    avatar: '👩‍🔬',
    dialogue: 'Excellent work! You\'ve completed this stage successfully.',
    summary: ['Stage completed']
  }

  // Update modal content
  document.getElementById('stage-badge').textContent = transitionData.isFinal
    ? '🏆 Investigation Complete!'
    : `Stage ${completedStageId} Complete!`
  document.getElementById('transition-avatar').textContent = transitionData.avatar
  document.getElementById('transition-character-name').textContent = transitionData.character
  document.getElementById('transition-dialogue').textContent = transitionData.dialogue

  // Build narrative text
  const summaryEl = document.getElementById('stage-summary')
  if (transitionData.narrative) {
    summaryEl.innerHTML = `<p class="narrative-text">${transitionData.narrative}</p>`
  } else {
    summaryEl.innerHTML = ''
  }

  // Update next stage preview
  const nextPreview = document.getElementById('next-stage-preview')
  const continueBtn = document.getElementById('continue-to-next-stage')

  if (nextStage && !transitionData.isFinal) {
    document.getElementById('next-stage-title').textContent = nextStage.title
    nextPreview.style.display = 'flex'
    continueBtn.textContent = 'Continue →'
    continueBtn.onclick = () => {
      hideStageTransition()
      loadStage(nextStageId)
    }
  } else {
    // Final stage or no next stage
    nextPreview.style.display = 'none'
    continueBtn.textContent = 'Finish'
    continueBtn.onclick = () => {
      hideStageTransition()
      // Show final completion state
      document.getElementById('story-content').innerHTML = `
        <h2>🏆 Congratulations!</h2>
        <p>You've completed all stages of the Digital Archaeology Mystery!</p>
        <p>You've successfully pieced together the ancient fragments and uncovered the lost knowledge of the Bridge Builders.</p>
        <p><strong>You are now a certified Digital Archaeologist!</strong></p>
      `
    }
  }

  // Show the modal
  modal.style.display = 'flex'
}

// Hide stage transition modal
function hideStageTransition () {
  const modal = document.getElementById('stage-transition-modal')
  if (modal) {
    modal.style.display = 'none'
  }
}

// Set up next button to advance to next stage (moved to DOMContentLoaded)
function setupNextButton () {
  document.getElementById('next-button').addEventListener('click', function () {
    const nextStage = currentStage + 1

    // Check if there's a next stage
    if (nextStage <= gameContent.gameInfo.totalStages) {
      showStageTransition(currentStage)
    } else {
      // Handle game completion
      showStageTransition(currentStage)
    }
  })
}

// Restart runtime functionality - clears all cell outputs and resets execution state
function restartRuntime () {
  console.log(
    'Restarting runtime - clearing all cell outputs and execution state'
  )

  // Reset execution counter
  executionCounter = 0

  // Clear successful cell executions for current stage
  if (successfulCellExecutions[currentStage]) {
    successfulCellExecutions[currentStage].clear()
  }

  // Reset Skulpt environment by reinitializing it
  skulptEnvironment = null

  // Get current stage to determine whether it's single-cell or multi-cell
  const stage = gameContent.stages.find(s => s.id === currentStage)

  if (stage && stage.cells) {
    // Multi-cell stage: clear all cell outputs and reset states
    stage.cells.forEach((cell, index) => {
      // Reset cell number display
      const cellNumber = document.getElementById(`cell-number-${index}`)
      if (cellNumber) {
        cellNumber.innerHTML = `
          [ ]
          <svg class="play-icon" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg class="stop-icon" viewBox="0 0 24 24" style="display: none;">
            <rect x="6" y="6" width="12" height="12"/>
          </svg>
        `
        cellNumber.classList.remove('executed', 'running')
      }

      // Reset cell status
      const cellStatus = document.getElementById(`cell-status-${index}`)
      if (cellStatus) {
        cellStatus.textContent = 'Pending'
        cellStatus.className = 'cell-status pending'
      }

      // Clear output area
      const outputArea = document.getElementById(`output-area-${index}`)
      if (outputArea) {
        outputArea.textContent = ''
        outputArea.classList.remove('success', 'error')
        outputArea.classList.add('empty')
      }

      // Hide output container
      const outputContainer = document.getElementById(
        `output-container-${index}`
      )
      if (outputContainer) {
        outputContainer.style.display = 'none'
      }

      // Clear execution counter
      const outputCounter = document.getElementById(`output-counter-${index}`)
      if (outputCounter) {
        outputCounter.textContent = ''
      }
    })
  } else {
    // Single-cell stage: clear output and reset state
    const cellNumber = document.getElementById('single-cell-number')
    if (cellNumber) {
      cellNumber.innerHTML = `
        [ ]
        <svg class="play-icon" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <svg class="stop-icon" viewBox="0 0 24 24" style="display: none;">
          <rect x="6" y="6" width="12" height="12"/>
        </svg>
      `
      cellNumber.classList.remove('executed', 'running')
    }

    const cellStatus = document.getElementById('single-cell-status')
    if (cellStatus) {
      cellStatus.textContent = 'Pending'
      cellStatus.className = 'cell-status pending'
    }

    const outputArea = document.getElementById('single-output-area')
    if (outputArea) {
      outputArea.textContent = ''
      outputArea.classList.remove('success', 'error')
      outputArea.classList.add('empty')
    }

    const outputContainer = document.getElementById('single-output-container')
    if (outputContainer) {
      outputContainer.style.display = 'none'
    }
  }

  // Update execution indicators
  updateCellExecutionIndicators()

  // Show confirmation message
  console.log('Runtime restart complete - all cells cleared')

  // Brief visual feedback
  const restartButton = document.getElementById('restart-runtime-button')
  if (restartButton) {
    const originalText = restartButton.innerHTML
    restartButton.innerHTML = '✓ Runtime Restarted'
    restartButton.style.background = '#34a853'
    setTimeout(() => {
      restartButton.innerHTML = originalText
      restartButton.style.background = '#ea4335'
    }, 1500)
  }
}

// Set up chat toggle button for Dr. Rodriguez chat
function setupChatToggle () {
  const toggleBtn = document.getElementById('chat-toggle-btn')
  const chatPanel = document.getElementById('chat-panel')
  const closeBtn = document.getElementById('chat-panel-close')
  const chatInput = document.getElementById('chat-input')
  const chatSend = document.getElementById('chat-send')
  const chatBody = document.getElementById('chat-panel-body')

  if (!toggleBtn || !chatPanel) return

  // Toggle chat panel visibility
  toggleBtn.addEventListener('click', () => {
    const isOpen = chatPanel.style.display === 'flex'
    chatPanel.style.display = isOpen ? 'none' : 'flex'
    toggleBtn.classList.toggle('active', !isOpen)

    // Focus input when opening
    if (!isOpen && chatInput) {
      setTimeout(() => chatInput.focus(), 100)
    }
  })

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      chatPanel.style.display = 'none'
      toggleBtn.classList.remove('active')
    })
  }

  // Send message functionality
  const sendMessage = async () => {
    if (!chatInput || !chatBody) return

    const message = chatInput.value.trim()
    if (!message) return

    // Add user message to chat
    const userMsg = document.createElement('div')
    userMsg.className = 'chat-message user-message'
    userMsg.innerHTML = `<p>${escapeHtml(message)}</p>`
    userMsg.style.cssText = 'text-align: right; margin: 8px 0; padding: 8px 12px; background: rgba(212, 175, 55, 0.2); border-radius: 12px 12px 0 12px; color: #f5f0e4;'
    chatBody.appendChild(userMsg)

    // Clear input
    chatInput.value = ''

    // Scroll to bottom
    chatBody.scrollTop = chatBody.scrollHeight

    // Check if LLM is available
    if (window.llmIntegration && window.llmIntegration.isEnabled) {
      // Add typing indicator
      const typingIndicator = document.createElement('div')
      typingIndicator.className = 'chat-typing'
      typingIndicator.innerHTML = '<p style="color: #8b7355; font-style: italic;">Dr. Rodriguez is typing...</p>'
      chatBody.appendChild(typingIndicator)
      chatBody.scrollTop = chatBody.scrollHeight

      try {
        // Get response from LLM
        const response = await window.llmIntegration.chat(message)

        // Remove typing indicator
        typingIndicator.remove()

        // Add Dr. Rodriguez's response
        const drMsg = document.createElement('div')
        drMsg.className = 'chat-message dr-message'
        drMsg.innerHTML = `
          <div style="display: flex; gap: 8px; align-items: flex-start;">
            <span style="font-size: 1.5rem;">👩‍🔬</span>
            <p style="margin: 0; color: #f5f0e4; line-height: 1.5;">${response}</p>
          </div>
        `
        drMsg.style.cssText = 'margin: 8px 0; padding: 12px; background: rgba(50, 40, 30, 0.8); border-radius: 12px 12px 12px 0; border-left: 3px solid #d4af37;'
        chatBody.appendChild(drMsg)
      } catch (error) {
        typingIndicator.remove()
        const errorMsg = document.createElement('div')
        errorMsg.innerHTML = '<p style="color: #e74c3c; font-style: italic;">Unable to get response. Please try again.</p>'
        chatBody.appendChild(errorMsg)
      }
    } else {
      // LLM not available - show helpful message
      const offlineMsg = document.createElement('div')
      offlineMsg.className = 'chat-message dr-message'
      offlineMsg.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <span style="font-size: 1.5rem;">👩‍🔬</span>
          <p style="margin: 0; color: #b8b0a0; font-style: italic;">
            I'm currently offline. Configure an AI provider in the settings (⚙️ at the bottom) to chat with me!
          </p>
        </div>
      `
      offlineMsg.style.cssText = 'margin: 8px 0; padding: 12px; background: rgba(50, 40, 30, 0.8); border-radius: 12px 12px 12px 0; border-left: 3px solid #8b7355;'
      chatBody.appendChild(offlineMsg)
    }

    chatBody.scrollTop = chatBody.scrollHeight
  }

  // Send on button click
  if (chatSend) {
    chatSend.addEventListener('click', sendMessage)
  }

  // Send on Enter key
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage()
      }
    })
  }
}

// Helper function to escape HTML
function escapeHtml (text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Set up restart runtime button event listener
document.addEventListener('DOMContentLoaded', () => {
  initializeGame()

  // Set up next button
  setupNextButton()

  // Set up restart runtime button
  const restartButton = document.getElementById('restart-runtime-button')
  if (restartButton) {
    restartButton.addEventListener('click', restartRuntime)
  }

  // Set up clear progress button
  const clearProgressButton = document.getElementById('clear-progress-button')
  if (clearProgressButton) {
    clearProgressButton.addEventListener('click', () => {
      if (
        confirm(
          'Are you sure you want to clear all saved progress? This action cannot be undone.'
        )
      ) {
        clearGameProgress()
        // Reload the page to start fresh
        window.location.reload()
      }
    })
  }

  // Set up Ollama help modal
  setupOllamaHelpModal()

  // Set up chat toggle button
  setupChatToggle()
})

// Additional verification that Skulpt is working
window.addEventListener('load', () => {
  // Check if Skulpt is already ready when page loads
  if (
    typeof Sk !== 'undefined' &&
    typeof Sk.configure === 'function' &&
    !skulptReady
  ) {
    skulptReady = true
    console.log('Skulpt was ready at page load')
  }

  // Give a bit more time for everything to load
  setTimeout(() => {
    if (!skulptReady && typeof Sk === 'undefined') {
      console.warn(
        'Skulpt loading verification: Not ready yet, this is normal during initial load'
      )
      const storyContent = document.getElementById('story-content')
      if (
        storyContent &&
        !storyContent.innerHTML.includes('Loading Python engine')
      ) {
        storyContent.innerHTML +=
          '<br><br><div style="color: #ffa500; font-weight: bold;">🔄 Python engine is still loading... Please wait a moment before running code.</div>'
      }
    } else {
      console.log('Skulpt verification: Ready and working!')
    }
  }, 3000)
})

// LLM Integration with multiple providers
// LLMIntegration class is now imported from llm-integration.js to avoid
// browser/Node.js environment conflicts and side effects during testing

// Update Ollama help URLs dynamically based on current origin
function updateOllamaHelpUrls() {
  const currentOrigin = window.location.origin;
  const currentDomain = window.location.hostname;
  const modal = document.getElementById('ollama-help-modal');

  if (!modal) return;

  // Determine if CORS configuration is needed
  const isLocalhost = currentDomain === 'localhost' || currentDomain === '127.0.0.1';
  const corsSection = document.getElementById('cors-section');
  const corsDescription = document.getElementById('cors-description');

  // Determine the OLLAMA_ORIGINS value based on the domain
  let ollamaOrigins;
  if (isLocalhost) {
    // For localhost, CORS is not needed - hide the section
    if (corsSection) {
      corsSection.style.display = 'none';
    }
    // Update step numbers for subsequent steps
    const installModelHeading = document.getElementById('install-model-heading');
    const testConnectionHeading = document.getElementById('test-connection-heading');
    const testConnectionDescription = document.getElementById('test-connection-description');
    
    if (installModelHeading) {
      installModelHeading.innerHTML = '🚀 Step 2: Install a Model';
    }
    if (testConnectionHeading) {
      testConnectionHeading.innerHTML = '✅ Step 3: Test Connection';
    }
    if (testConnectionDescription) {
      testConnectionDescription.innerHTML = 'Once Ollama is running:';
    }
  } else {
    // For remote domains (like GitHub Pages), show CORS config and include both the domain and localhost
    if (corsSection) {
      corsSection.style.display = 'block';
    }
    ollamaOrigins = `${currentOrigin},http://localhost:*`;

    // Update the description to show current domain
    if (corsDescription) {
      corsDescription.innerHTML = `To allow this website (<strong>${currentOrigin}</strong>) to connect to your local Ollama server, you need to set environment variables:`;
    }

    // Update all CORS origin placeholders in the modal
    const originElements = modal.querySelectorAll('.current-origin');
    originElements.forEach(el => {
      el.textContent = currentOrigin;
    });

    const corsOriginsElements = modal.querySelectorAll('.cors-origins');
    corsOriginsElements.forEach(el => {
      el.textContent = ollamaOrigins;
    });

    // Reset step numbers to normal
    const installModelHeading = document.getElementById('install-model-heading');
    const testConnectionHeading = document.getElementById('test-connection-heading');
    const testConnectionDescription = document.getElementById('test-connection-description');

    if (installModelHeading) {
      installModelHeading.innerHTML = '🚀 Step 3: Install a Model';
    }
    if (testConnectionHeading) {
      testConnectionHeading.innerHTML = '✅ Step 4: Test Connection';
    }
    if (testConnectionDescription) {
      testConnectionDescription.innerHTML = 'Once Ollama is running with CORS configured:';
    }
  }

  // Replace all instances of the hardcoded URL and OLLAMA_ORIGINS value
  const elementsToUpdate = modal.querySelectorAll('.help-section p, .code-block code, .code-block');

  elementsToUpdate.forEach(element => {
    // Update domain references
    if (element.innerHTML.includes('https://jtm.io/codepedagogy/')) {
      element.innerHTML = element.innerHTML.replace(
        /https:\/\/jtm\.io\/codepedagogy\//g,
        currentOrigin + (currentOrigin.endsWith('/') ? '' : '/')
      );
    }
    
    // Update OLLAMA_ORIGINS values - handle both with and without quotes
    if (element.innerHTML.includes('OLLAMA_ORIGINS') && ollamaOrigins) {
      // Match patterns like: OLLAMA_ORIGINS=https://... or OLLAMA_ORIGINS="https://...
      element.innerHTML = element.innerHTML.replace(
        /OLLAMA_ORIGINS=["']?https:\/\/jtm\.io\/codepedagogy\/,http:\/\/localhost:\*["']?/g,
        `OLLAMA_ORIGINS="${ollamaOrigins}"`
      );
      
      // Also update the environment variable value in the permanent setup instructions
      element.innerHTML = element.innerHTML.replace(
        /Value: <code>https:\/\/jtm\.io\/codepedagogy\/,http:\/\/localhost:\*<\/code>/g,
        `Value: <code>${ollamaOrigins}</code>`
      );
    }
  });
}

// Detect user's operating system
function detectOS() {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  
  console.log('OS Detection - userAgent:', userAgent);
  console.log('OS Detection - platform:', platform);
  
  // Check platform first (more reliable) - case insensitive
  const platformLower = platform.toLowerCase();
  if (platformLower.includes('win')) {
    console.log('Detected OS: Windows (from platform)');
    return 'windows';
  }
  if (platformLower.includes('mac')) {
    console.log('Detected OS: macOS (from platform)');
    return 'mac';
  }
  if (platformLower.includes('linux')) {
    console.log('Detected OS: Linux (from platform, using mac/linux tab)');
    return 'mac'; // Use mac/linux tab for Linux
  }
  
  // Fallback detection using userAgent
  const userAgentLower = userAgent.toLowerCase();
  if (userAgentLower.includes('win')) {
    console.log('Detected OS via userAgent: Windows');
    return 'windows';
  }
  if (userAgentLower.includes('mac')) {
    console.log('Detected OS via userAgent: macOS');
    return 'mac';
  }
  if (userAgentLower.includes('linux')) {
    console.log('Detected OS via userAgent: Linux');
    return 'mac';
  }
  
  // Check for newer browser API
  if (navigator.userAgentData && navigator.userAgentData.platform) {
    const platformData = navigator.userAgentData.platform.toLowerCase();
    console.log('OS Detection - userAgentData.platform:', platformData);
    if (platformData.includes('win')) {
      console.log('Detected OS via userAgentData: Windows');
      return 'windows';
    }
    if (platformData.includes('mac')) {
      console.log('Detected OS via userAgentData: macOS');
      return 'mac';
    }
    if (platformData.includes('linux')) {
      console.log('Detected OS via userAgentData: Linux');
      return 'mac';
    }
  }
  
  // Default to mac/linux for unknown systems
  console.log('Could not detect OS, defaulting to mac/linux');
  return 'mac';
}

// Ollama Help Modal Setup
function setupOllamaHelpModal () {
  const helpBtn = document.getElementById('ollama-help-btn')
  const modal = document.getElementById('ollama-help-modal')
  const closeBtn = document.getElementById('close-ollama-help')
  const tabBtns = document.querySelectorAll('.tab-btn')
  const platformContents = document.querySelectorAll('.platform-content')
  const tabBtnsInstall = document.querySelectorAll('.tab-btn-install')
  const platformContentsInstall = document.querySelectorAll('.platform-content-install')

  // Open modal
  if (helpBtn) {
    helpBtn.addEventListener('click', e => {
      e.preventDefault()
      e.stopPropagation()

      // Show modal first
      modal.style.display = 'flex'
      document.body.style.overflow = 'hidden'

      // Update URLs dynamically based on current origin
      updateOllamaHelpUrls()
      
      // Auto-detect and select the correct platform tab
      // Use a small delay to ensure modal is fully rendered
      setTimeout(() => {
        const detectedOS = detectOS();
        console.log('Modal opened - detected OS:', detectedOS);
        
        // Update Step 1 (Install) tabs
        const targetTabInstall = document.querySelector(`.tab-btn-install[data-platform="${detectedOS}"]`);
        console.log('Step 1 target tab found:', targetTabInstall);
        
        if (targetTabInstall) {
          tabBtnsInstall.forEach(tab => tab.classList.remove('active'));
          targetTabInstall.classList.add('active');
          
          platformContentsInstall.forEach(content => {
            if (content.getAttribute('data-platform') === detectedOS) {
              content.style.display = 'block';
              console.log('Step 1: Showing content for:', detectedOS);
            } else {
              content.style.display = 'none';
            }
          });
        }
        
        // Update Step 2 (CORS) tabs
        const targetTab = document.querySelector(`.tab-btn[data-platform="${detectedOS}"]`);
        console.log('Step 2 target tab found:', targetTab);
        console.log('All tab buttons:', document.querySelectorAll('.tab-btn'));
        
        if (targetTab) {
          // Update active tab
          tabBtns.forEach(tab => tab.classList.remove('active'));
          targetTab.classList.add('active');
          console.log('Step 2: Active tab set to:', detectedOS);
          
          // Show corresponding content
          platformContents.forEach(content => {
            const contentPlatform = content.getAttribute('data-platform');
            console.log('Step 2: Checking content platform:', contentPlatform);
            if (contentPlatform === detectedOS) {
              content.style.display = 'block';
              console.log('Step 2: Showing content for:', detectedOS);
            } else {
              content.style.display = 'none';
            }
          });
        } else {
          console.warn('No tab found for platform:', detectedOS);
          console.warn('Available tabs:', tabBtns);
        }
      }, 50);
    })
  }

  // Close modal
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none'
      document.body.style.overflow = 'auto'
    })
  }

  // Close modal when clicking overlay
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.style.display = 'none'
        document.body.style.overflow = 'auto'
      }
    })
  }

  // Close modal with Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none'
      document.body.style.overflow = 'auto'
    }
  })

  // Platform tab switching for Step 2 (CORS)
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const platform = btn.getAttribute('data-platform')

      // Update active tab
      tabBtns.forEach(tab => tab.classList.remove('active'))
      btn.classList.add('active')

      // Show corresponding content
      platformContents.forEach(content => {
        if (content.getAttribute('data-platform') === platform) {
          content.style.display = 'block'
        } else {
          content.style.display = 'none'
        }
      })
    })
  })

  // Platform tab switching for Step 1 (Install)
  tabBtnsInstall.forEach(btn => {
    btn.addEventListener('click', () => {
      const platform = btn.getAttribute('data-platform')

      // Update active tab
      tabBtnsInstall.forEach(tab => tab.classList.remove('active'))
      btn.classList.add('active')

      // Show corresponding content
      platformContentsInstall.forEach(content => {
        if (content.getAttribute('data-platform') === platform) {
          content.style.display = 'block'
        } else {
          content.style.display = 'none'
        }
      })
    })
  })
}

// Initialize LLM integration when DOM is loaded
let ollamaLLM = null

// LLMIntegration is now exported from llm-integration.js

// Add to script.js
class PlayerStoryTracker {
  constructor() {
    this.actions = [];
    this.choices = [];
    this.performance = {};
    this.characterRelationship = 0; // Dr. Rodriguez trust level
    this.narrativePath = 'neutral';
  }
  
  trackCodeExecution(stageId, attempts, timeSpent, hintsUsed, errors) {
    this.performance[stageId] = {
      attempts,
      timeSpent,
      hintsUsed,
      errors,
      firstTrySuccess: attempts === 1,
      struggledConcepts: this.identifyStruggles(errors)
    };
    
    // Record specific actions for narrative callbacks
    if (attempts === 1 && hintsUsed === 0) {
      this.actions.push(`solved_stage_${stageId}_perfectly`);
    } else if (hintsUsed > 3) {
      this.actions.push(`needed_extensive_help_stage_${stageId}`);
    }
  }
  
  identifyStruggles(errors) {
    // Analyze error patterns
    const struggles = [];
    if (errors.some(e => e.includes('IndentationError'))) {
      struggles.push('indentation');
    }
    if (errors.some(e => e.includes('str'))) {
      struggles.push('string conversion');
    }
    return struggles;
  }
  
  getPersonalizedNarrative(template, stageId) {
    const perf = this.performance[stageId];
    return template
      .replace('{{playerAction}}', this.describePlayerApproach(perf))
      .replace('{{struggledConcept}}', perf.struggledConcepts.join(' and ') || 'the challenge')
      .replace('{{timeReference}}', this.getTimeReference(perf.timeSpent));
  }
  
  describePlayerApproach(performance) {
    if (performance.firstTrySuccess) {
      return "immediately identified the key pattern";
    } else if (performance.hintsUsed > 2) {
      return "carefully worked through the hints";
    } else {
      return "methodically tested different approaches";
    }
  }
}

let playerTracker = new PlayerStoryTracker();

// Modify LLMIntegration class
class EnhancedLLMIntegration extends LLMIntegration {
  async queryCharacterHint(code, error, stage) {
    const characterPersonality = `You are Dr. Elena Rodriguez, a digital archaeologist. You're brilliant but approachable, 
    excited about discoveries, and genuinely care about your assistant's learning. You've been studying these fragments 
    for years. Speak in first person, be encouraging but not condescending. Reference the current mystery naturally.`;
    
    const storyContext = `Current investigation: ${stage.story}
    Player's relationship level: ${playerTracker.characterRelationship}
    Recent choices: ${JSON.stringify(playerTracker.choices.slice(-2))}
    Current narrative path: ${playerTracker.narrativePath}`;
    
    const prompt = `${characterPersonality}
    
    ${storyContext}
    
    The player is stuck on: ${stage.challenge}
    Their code: ${code}
    ${error ? `Error message: ${error}` : ''}
    
    As Dr. Rodriguez, provide a hint that:
    1. Stays in character
    2. References the archaeological mystery
    3. Provides genuine help without giving away the solution
    4. Shows personality (excitement, concern, humor as appropriate)
    5. If relevant, mention how this connects to the larger mystery
    
    Keep response under 100 words. Be conversational.`;
    
    // Use the appropriate provider's query method
    let response;
    if (this.provider === 'ollama') {
      response = await this.queryOllama(prompt);
    } else if (this.provider === 'openai') {
      response = await this.queryOpenAI(prompt);
    } else if (this.provider === 'anthropic') {
      response = await this.queryAnthropic(prompt);
    } else {
      throw new Error('No LLM provider configured');
    }
    
    // Track interaction for relationship building
    playerTracker.characterRelationship += 0.1;
    
    return response;
  }
  
  updateHintSystem() {
    // Use dedicated chat panel instead of hints container
    const chatPanel = document.getElementById('chat-panel');
    const gameArea = document.querySelector('.game-area');
    if (!chatPanel) return;

    chatPanel.innerHTML = '';

    // Activate chat panel and update grid layout
    chatPanel.classList.add('active');
    if (gameArea) {
      gameArea.classList.add('has-chat');
    }

    // Create character chat interface
    const chatInterface = document.createElement('div');
    chatInterface.className = 'character-chat';
    chatInterface.innerHTML = `
      <div class="chat-header">
        <img src="rodriguez-avatar.png" alt="Dr. Rodriguez" class="chat-avatar">
        <span>Dr. Rodriguez</span>
        <span class="status-indicator online"></span>
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="message character">
          <p>Need help with the ${gameContent.stages[currentStage - 1].title.toLowerCase()}?
          I'm here to guide you through this mystery!</p>
        </div>
      </div>
      <div class="chat-input-container">
        <button id="quick-hint-btn" class="quick-action">🔍 Hint</button>
        <button id="explain-error-btn" class="quick-action">❌ Error</button>
        <button id="story-context-btn" class="quick-action">📖 Story</button>
      </div>
    `;

    chatPanel.appendChild(chatInterface);
    
    // Wire up buttons
    document.getElementById('quick-hint-btn').addEventListener('click', async () => {
      await this.requestCharacterHint('hint');
    });
    
    document.getElementById('explain-error-btn').addEventListener('click', async () => {
      await this.requestCharacterHint('error');
    });
    
    document.getElementById('story-context-btn').addEventListener('click', async () => {
      await this.requestCharacterHint('story');
    });
  }
  
  getRequestMessage(type) {
    const messages = {
      'hint': 'Can you give me a hint?',
      'error': 'Can you help me understand this error?',
      'story': 'Can you explain the story context?'
    };
    return messages[type] || 'Can you help me?';
  }
  
  getCurrentCode() {
    // Get code from the active editor
    if (editor) {
      return editor.getValue();
    } else if (cellEditors && cellEditors.length > 0) {
      // For multi-cell stages, return the last edited cell
      return cellEditors[cellEditors.length - 1]?.getValue() || '';
    }
    return '';
  }
  
  getLastError() {
    // Look for error in the most recent output
    const outputs = document.querySelectorAll('.cell-output, .output');
    for (let i = outputs.length - 1; i >= 0; i--) {
      const text = outputs[i].textContent;
      if (text.includes('Error:') || text.includes('Traceback')) {
        return text;
      }
    }
    return '';
  }
  
  async requestCharacterHint(type) {
    const messagesContainer = document.getElementById('chat-messages');
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.innerHTML = `<p>${this.getRequestMessage(type)}</p>`;
    messagesContainer.appendChild(userMsg);
    
    // Add typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message character typing';
    typingIndicator.innerHTML = '<div class="typing-dots">...</div>';
    messagesContainer.appendChild(typingIndicator);
    
    // Get response
    const response = await this.queryCharacterHint(
      this.getCurrentCode(),
      this.getLastError(),
      gameContent.stages[currentStage - 1]
    );
    
    // Remove typing indicator and add response
    typingIndicator.remove();
    const charMsg = document.createElement('div');
    charMsg.className = 'message character';
    charMsg.innerHTML = `<p>${response}</p>`;
    messagesContainer.appendChild(charMsg);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Add to script.js
function showStorySegment(stage) {
  const segment = stage.completionSegment;
  if (!segment) return;
  
  // Create modal-style story overlay
  const storyModal = document.createElement('div');
  storyModal.className = 'story-modal';
  storyModal.innerHTML = `
    <div class="story-content">
      <div class="story-narrative">
        ${playerTracker.getPersonalizedNarrative(segment.narrative, stage.id)}
      </div>
      
      ${segment.characterResponse ? `
        <div class="character-message">
          <img src="rodriguez-avatar.png" alt="Dr. Rodriguez" class="character-avatar">
          <div class="message-bubble">
            ${getCharacterResponse(segment.characterResponse, stage.id)}
          </div>
        </div>
      ` : ''}
      
      ${segment.choice ? `
        <div class="story-choice">
          <p class="choice-prompt">${segment.choice.prompt}</p>
          <div class="choice-options">
            ${segment.choice.options.map(opt => `
              <button class="choice-button" data-choice="${opt.id}" data-consequence="${opt.consequence}">
                <strong>${opt.text}</strong>
                <small>${opt.preview}</small>
              </button>
            `).join('')}
          </div>
        </div>
      ` : `
        <button class="continue-button">Continue →</button>
      `}
    </div>
  `;
  
  document.body.appendChild(storyModal);
  
  // Handle choices
  storyModal.querySelectorAll('.choice-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const choice = e.currentTarget.dataset.choice;
      const consequence = e.currentTarget.dataset.consequence;
      
      playerTracker.choices.push({
        stageId: stage.id,
        choice: choice,
        consequence: consequence
      });
      
      playerTracker.narrativePath = consequence;
      
      // Modify next stage based on choice
      applyNarrativeModifiers(consequence);
      
      // Close modal and proceed
      storyModal.remove();
      proceedToNextStage();
    });
  });
}

function getCharacterResponse(responses, stageId) {
  const perf = playerTracker.performance[stageId];
  if (perf.firstTrySuccess && perf.hintsUsed === 0) {
    return playerTracker.getPersonalizedNarrative(responses.success, stageId);
  } else {
    return playerTracker.getPersonalizedNarrative(responses.struggle, stageId);
  }
}

function determineEnding() {
  const endings = gameContent.endings;
  const playerActions = playerTracker.actions;
  const playerChoices = playerTracker.choices;
  
  // Score each ending based on requirements met
  const endingScores = {};
  
  for (const [endingId, ending] of Object.entries(endings)) {
    let score = 0;
    let requirementsMet = 0;
    
    for (const requirement of ending.requirements) {
      if (checkRequirement(requirement, playerActions, playerChoices)) {
        requirementsMet++;
        score += 10;
      }
    }
    
    // Bonus points for narrative consistency
    if (ending.narrativePath === playerTracker.narrativePath) {
      score += 5;
    }
    
    endingScores[endingId] = {
      score,
      percentComplete: (requirementsMet / ending.requirements.length) * 100
    };
  }
  
  // Select best ending
  const bestEnding = Object.entries(endingScores)
    .sort((a, b) => b[1].score - a[1].score)[0];
  
  return endings[bestEnding[0]];
}

function showFinalRevelation() {
  const ending = determineEnding();
  const revelation = generateFinalRevelation(ending);
  
  // Create elaborate ending sequence
  const endingModal = document.createElement('div');
  endingModal.className = 'ending-modal';
  endingModal.innerHTML = `
    <div class="ending-content">
      <h2>🏛️ The Truth Revealed</h2>
      
      <div class="revelation-text">
        ${revelation.narrative}
      </div>
      
      <div class="character-final">
        <img src="rodriguez-avatar.svg" alt="Dr. Rodriguez" onerror="this.style.display='none'; this.nextElementSibling.innerHTML='<span style=&quot;font-size:48px&quot;>👨‍🔬</span>' + this.nextElementSibling.innerHTML">
        <div class="final-message">
          <p>"${revelation.characterMessage}"</p>
        </div>
      </div>
      
      <div class="ending-stats">
        <h3>Your Archaeological Journey:</h3>
        <ul>
          <li>Fragments Decoded: ${playerTracker.getDecodedCount()}</li>
          <li>Mysteries Solved: ${playerTracker.choices.length}</li>
          <li>Relationship with Dr. Rodriguez: ${getRelationshipLevel()}</li>
          <li>Path Taken: ${formatPath(playerTracker.narrativePath)}</li>
        </ul>
      </div>
      
      <div class="ending-badge">
        <img src="badges/${ending.badge}.png" alt="${ending.title}">
        <h3>${ending.title}</h3>
        <p>${ending.description}</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(endingModal);
}

// ========================================
// Integrated Narrative-Code Design Functions
// ========================================

// Show inline narrative reaction from Dr. Rodriguez after code execution
function showInlineNarrative(cellIndex, output, narrativeMessage) {
  const outputArea = document.getElementById(`output-${cellIndex}`);
  if (!outputArea) return;
  
  // Create Rodriguez reaction element
  const narrative = document.createElement('div');
  narrative.className = 'rodriguez-reaction';
  narrative.innerHTML = `
    <div class="character-inline">
      <span style="font-size: 32px; margin-right: 0.75rem;">👨‍🔬</span>
      <p>"${narrativeMessage}"</p>
    </div>
  `;
  
  // Insert right below the output
  outputArea.appendChild(narrative);
  
  // Add to discoveries log
  updateDiscoveriesLog(narrativeMessage);
}

// Update the discoveries log in the reference panel
function updateDiscoveriesLog(discovery) {
  const discoveriesContainer = document.getElementById('live-discoveries');
  if (!discoveriesContainer) return;
  
  const discoveryItem = document.createElement('div');
  discoveryItem.className = 'discovery-item';
  discoveryItem.innerHTML = `
    <div style="padding: 0.5rem; border-left: 2px solid #d4a574; margin-bottom: 0.5rem; background: rgba(212, 165, 116, 0.1);">
      ✓ ${discovery}
    </div>
  `;
  
  discoveriesContainer.appendChild(discoveryItem);
}

// Update the data card in the reference panel with stage-specific data
function updateDataCard(stageData) {
  const dataCard = document.querySelector('.data-card');
  if (!dataCard) return;
  
  // Extract data snippet from stage data (first code block or first 100 chars)
  const codeMatch = stageData.match(/```[\s\S]*?```/) || stageData.match(/\[.*?\]/);
  const dataSnippet = codeMatch ? codeMatch[0].replace(/```/g, '') : stageData.substring(0, 100);
  
  dataCard.innerHTML = `
    <h3>📊 Fragment Data</h3>
    <code>${dataSnippet}</code>
    <p style="margin-top: 0.5rem; font-size: 0.8rem;">Explore this data in your code</p>
  `;
}


// Update the narrative strip with current story progress
function updateNarrativeStrip(storyText, objectiveText, isDialogue = false) {
  const storyProgress = document.getElementById('story-progress');
  const currentObjective = document.getElementById('current-objective');

  if (storyProgress && storyText) {
    if (isDialogue) {
      // Character dialogue - show as quote
      storyProgress.innerHTML = `💬 <strong>Dr. Rodriguez:</strong> "${storyText}"`;
    } else {
      // Narrative prose - show as story text
      storyProgress.innerHTML = `📜 ${storyText}`;
    }
  }

  if (currentObjective && objectiveText) {
    currentObjective.innerHTML = `🎯 ${objectiveText}`;
  }
}

// Transform cells into excavation layers for multi-cell stages
function createExcavationLayers(cells) {
  const container = document.getElementById('cells-container');
  if (!container) return;
  
  container.innerHTML = '';
  const layersDiv = document.createElement('div');
  layersDiv.className = 'excavation-layers';
  
  cells.forEach((cell, index) => {
    const layer = document.createElement('div');
    layer.className = index === 0 ? 'layer active' : 'layer locked';
    layer.id = `layer-${index}`;
    
    const layerHeader = document.createElement('div');
    layerHeader.className = 'layer-header';
    
    const headerTitle = cell.layerTitle || `Layer ${index + 1}: ${cell.title}`;
    const headerIcon = index === 0 ? '⚒️' : '🔒';
    
    layerHeader.innerHTML = `
      ${headerIcon} ${headerTitle}
      <span class="instruction">${cell.layerHint || 'Complete the previous layer to unlock'}</span>
    `;
    
    layer.appendChild(layerHeader);
    
    // Add cell content area (will be populated by existing cell creation logic)
    const cellContent = document.createElement('div');
    cellContent.className = 'layer-content';
    cellContent.id = `layer-content-${index}`;
    layer.appendChild(cellContent);
    
    layersDiv.appendChild(layer);
  });
  
  container.appendChild(layersDiv);
}

// Unlock next excavation layer when current is completed
function unlockNextLayer(currentIndex) {
  const currentLayer = document.getElementById(`layer-${currentIndex}`);
  const nextLayer = document.getElementById(`layer-${currentIndex + 1}`);
  
  if (currentLayer) {
    currentLayer.classList.remove('active');
    currentLayer.classList.add('completed');
    
    const header = currentLayer.querySelector('.layer-header');
    if (header) {
      const discovery = header.querySelector('.instruction');
      if (discovery) {
        discovery.className = 'discovery';
        discovery.textContent = '✓ Layer completed!';
      }
    }
  }
  
  if (nextLayer) {
    nextLayer.classList.remove('locked');
    nextLayer.classList.add('active');
    
    const header = nextLayer.querySelector('.layer-header');
    if (header) {
      header.innerHTML = header.innerHTML.replace('🔒', '⚒️');
    }
  }
}

// Add narrative responses based on code output
function getNarrativeResponse(stageId, cellIndex, output) {
  const narratives = {
    1: {
      0: "Yes! {output} fragments... that matches the constellation count!",
      1: "Excellent! The total is {output} characters. This could be a coordinate!"
    },
    2: {
      0: "Interesting... {output} short fragments. The pattern is emerging!",
      1: "{output} medium ones... we're getting closer to the truth."
    }
    // Add more narratives for other stages
  };
  
  if (narratives[stageId] && narratives[stageId][cellIndex]) {
    return narratives[stageId][cellIndex].replace('{output}', output);
  }

  return "Good work! Keep digging into the data...";
}

// ============================================
// GAME API - Programmatic control for testing
// ============================================

/**
 * Game API for automated testing and LLM agents
 * Access via window.gameAPI in browser console or Playwright
 */
window.gameAPI = {
  /**
   * Get current game state as JSON
   */
  getState: function() {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    const isMultiCell = !!(stage?.cells && stage.cells.length > 0);
    return {
      currentStage: currentStage,
      totalStages: gameContent?.gameInfo?.totalStages || 0,
      stageTitle: stage?.title || '',
      stageType: isMultiCell ? 'multi-cell' : 'single-cell',
      challenge: stage?.challenge || '',
      data: stage?.data || '',
      hints: stage?.hints || [],
      cells: isMultiCell ? stage.cells : null,
      completedStages: completedStages,
      isStageComplete: completedStages.includes(currentStage),
      llmEnabled: window.llmIntegration?.isEnabled || false,
      agencyLevel: window.llmIntegration?.agencyLevel || 1
    };
  },

  /**
   * Get current code from editor(s)
   */
  getCode: function() {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    const isMultiCell = !!(stage?.cells && stage.cells.length > 0);
    if (isMultiCell && cellEditors.length > 0) {
      return cellEditors.map((ed, i) => ({
        cell: i,
        code: ed.getValue()
      }));
    } else if (editor) {
      return editor.getValue();
    }
    return null;
  },

  /**
   * Set code in editor
   * @param {string} code - Code to set
   * @param {number} cellIndex - Optional cell index for multi-cell stages
   */
  setCode: function(code, cellIndex = null) {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    const isMultiCell = !!(stage?.cells && stage.cells.length > 0);
    if (isMultiCell && cellIndex !== null && cellEditors[cellIndex]) {
      cellEditors[cellIndex].setValue(code);
      return true;
    } else if (editor) {
      editor.setValue(code);
      return true;
    }
    return false;
  },

  /**
   * Run the current code
   * @param {number} cellIndex - Optional cell index for multi-cell stages
   * @returns {Promise<object>} Result with output and success status
   */
  runCode: async function(cellIndex = null) {
    return new Promise((resolve) => {
      const stage = gameContent?.stages?.find(s => s.id === currentStage);
      const isMultiCell = !!(stage?.cells && stage.cells.length > 0);

      // Set up observer to detect when execution completes
      const checkComplete = () => {
        setTimeout(() => {
          const output = this.getOutput(cellIndex);
          const state = this.getState();
          const cellStatus = this.getCellStatus(cellIndex || 0);
          const allCellsInfo = this.checkAllCellsCompleted();

          resolve({
            output: output,
            isComplete: state.isStageComplete,
            hasError: output.includes('Error:') || output.includes('error'),
            cellStatus: cellStatus,
            cellCompleted: cellStatus === 'completed',
            allCellsCompleted: allCellsInfo.allCompleted,
            cellStatuses: allCellsInfo.statuses
          });
        }, 2000); // Give time for execution and validation to complete
      };

      if (isMultiCell && cellIndex !== null) {
        // Click the cell number to run (it has the onclick handler)
        const cellNumber = document.getElementById(`cell-number-${cellIndex}`);
        if (cellNumber) {
          cellNumber.click();
          checkComplete();
        } else {
          resolve({ output: '', isComplete: false, error: 'Cell number element not found' });
        }
      } else {
        // Single cell - click the cell number to run
        const cellNumber = document.getElementById('single-cell-number');
        if (cellNumber) {
          cellNumber.click();
          checkComplete();
        } else {
          resolve({ output: '', isComplete: false, error: 'Cell number element not found' });
        }
      }
    });
  },

  /**
   * Get output from the output area
   * @param {number} cellIndex - Optional cell index for multi-cell stages
   */
  getOutput: function(cellIndex = null) {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    const isMultiCell = !!(stage?.cells && stage.cells.length > 0);
    if (isMultiCell && cellIndex !== null) {
      const outputArea = document.getElementById(`output-area-${cellIndex}`);
      return outputArea?.textContent || '';
    } else {
      const outputArea = document.getElementById('single-output-area');
      return outputArea?.textContent || '';
    }
  },

  /**
   * Get all outputs for multi-cell stages
   */
  getAllOutputs: function() {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    const isMultiCell = !!(stage?.cells && stage.cells.length > 0);
    if (isMultiCell) {
      return cellEditors.map((_, i) => ({
        cell: i,
        output: this.getOutput(i)
      }));
    }
    return [{ cell: 0, output: this.getOutput() }];
  },

  /**
   * Get the status of a specific cell
   * @param {number} cellIndex - Cell index (0-based)
   * @returns {string} Status: 'pending', 'completed', 'error', or 'unknown'
   */
  getCellStatus: function(cellIndex) {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    const isMultiCell = !!(stage?.cells && stage.cells.length > 0);

    if (isMultiCell) {
      const statusEl = document.getElementById(`cell-status-${cellIndex}`);
      if (statusEl) {
        if (statusEl.classList.contains('completed')) return 'completed';
        if (statusEl.classList.contains('error')) return 'error';
        if (statusEl.classList.contains('pending')) return 'pending';
        return statusEl.textContent.toLowerCase();
      }
    } else {
      const statusEl = document.getElementById('single-cell-status');
      if (statusEl) {
        if (statusEl.classList.contains('completed')) return 'completed';
        if (statusEl.classList.contains('error')) return 'error';
        if (statusEl.classList.contains('pending')) return 'pending';
        return statusEl.textContent.toLowerCase();
      }
    }
    return 'unknown';
  },

  /**
   * Get status of all cells in current stage
   * @returns {Array<object>} Array of {cell, status} objects
   */
  getAllCellStatuses: function() {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    const isMultiCell = !!(stage?.cells && stage.cells.length > 0);

    if (isMultiCell) {
      return stage.cells.map((_, i) => ({
        cell: i,
        status: this.getCellStatus(i)
      }));
    }
    return [{ cell: 0, status: this.getCellStatus(0) }];
  },

  /**
   * Check if all cells in current stage are completed
   * @returns {object} {allCompleted, completedCount, totalCells, statuses}
   */
  checkAllCellsCompleted: function() {
    const statuses = this.getAllCellStatuses();
    const completedCount = statuses.filter(s => s.status === 'completed').length;
    return {
      allCompleted: completedCount === statuses.length,
      completedCount,
      totalCells: statuses.length,
      statuses
    };
  },

  /**
   * Navigate to next stage
   */
  nextStage: function() {
    const nextBtn = document.getElementById('next-button');
    if (nextBtn && nextBtn.classList.contains('active')) {
      nextBtn.click();
      return true;
    }
    return false;
  },

  /**
   * Load a specific stage
   * @param {number} stageId - Stage number to load
   */
  loadStage: function(stageId) {
    if (stageId >= 1 && stageId <= (gameContent?.gameInfo?.totalStages || 0)) {
      loadStage(stageId);
      return true;
    }
    return false;
  },

  /**
   * Get hint from static hints
   * @param {number} index - Hint index
   */
  getHint: function(index = 0) {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    if (stage?.hints && stage.hints[index]) {
      return stage.hints[index];
    }
    return null;
  },

  /**
   * Query the LLM (if enabled)
   * @param {string} type - Query type: 'hint', 'debug', 'explain', 'suggest', 'fix'
   * @returns {Promise<string>} LLM response
   */
  queryLLM: async function(type = 'hint') {
    if (!window.llmIntegration?.isEnabled) {
      return { error: 'LLM not enabled' };
    }

    return new Promise((resolve) => {
      // Store original showLLMResponse to capture the result
      const originalShow = window.llmIntegration.showLLMResponse.bind(window.llmIntegration);

      window.llmIntegration.showLLMResponse = function(status, content) {
        originalShow(status, content);
        if (status === 'success') {
          resolve({ response: content });
        } else if (status === 'error') {
          resolve({ error: content });
        }
      };

      window.llmIntegration.queryLLM(type);

      // Timeout after 30 seconds
      setTimeout(() => {
        resolve({ error: 'Timeout waiting for LLM response' });
      }, 30000);
    });
  },

  /**
   * Set LLM agency level
   * @param {number} level - 1, 2, or 3
   */
  setAgencyLevel: function(level) {
    if (window.llmIntegration) {
      window.llmIntegration.setAgencyLevel(level);
      return true;
    }
    return false;
  },

  /**
   * Get the solution for the current stage (for testing)
   */
  getSolution: function() {
    const stage = gameContent?.stages?.find(s => s.id === currentStage);
    return stage?.solution || stage?.cells?.map(c => c.solution) || null;
  },

  /**
   * Get Dr. Rodriguez's last reaction (if any)
   */
  getLastReaction: function() {
    const reactionArea = document.getElementById('rodriguez-reaction-area');
    if (reactionArea) {
      const text = reactionArea.querySelector('.character-text');
      return text?.innerHTML || null;
    }
    return null;
  },

  /**
   * Wait for a condition
   * @param {function} condition - Function that returns true when condition is met
   * @param {number} timeout - Max wait time in ms
   */
  waitFor: function(condition, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  /**
   * Full game state for LLM context
   */
  getFullContext: function() {
    const state = this.getState();
    const code = this.getCode();
    const outputs = this.getAllOutputs();
    const reaction = this.getLastReaction();

    return {
      ...state,
      currentCode: code,
      outputs: outputs,
      lastReaction: reaction,
      solution: this.getSolution() // Include for testing
    };
  }
};

console.log('🎮 Game API loaded. Access via window.gameAPI');

// ============================================
// TUTORIAL SYSTEM
// ============================================

// Stage-specific tutorial steps
// Stage 0 uses a simple callout, later stages can have feature introductions
const stageTutorials = {
  0: [
    {
      target: '#single-cell-number, .cell-number, .cell-header',
      title: '👆 Click Here to Run!',
      text: 'Click this play button (or press Shift+Enter) to run the code and see what happens!',
      arrow: 'left',
      offset: { x: 10, y: 0 }
    }
  ],
  2: [
    {
      target: '#cells-container, .cells-container',
      title: '📝 Multiple Code Cells',
      text: 'This stage has multiple code cells! Complete each cell in order. Variables from earlier cells are available in later ones.',
      arrow: 'top',
      offset: { x: 0, y: 10 }
    }
  ]
};

let currentTutorialStep = 0;
let currentTutorialSteps = [];
let tutorialHighlightedElement = null;

function shouldShowTutorial (stageId) {
  // Check if this stage's tutorial has been seen
  const seenTutorials = JSON.parse(localStorage.getItem('aicodepedagogy_tutorials_seen') || '[]');
  return stageTutorials[stageId] && !seenTutorials.includes(stageId);
}

let currentTutorialStageId = null;

function startTutorial (stageId) {
  currentTutorialStageId = stageId;
  currentTutorialSteps = stageTutorials[stageId] || [];
  currentTutorialStep = 0;

  if (currentTutorialSteps.length === 0) return;

  showTutorialStep(0);
  document.getElementById('tutorial-overlay').style.display = 'block';
}

function endTutorial () {
  document.getElementById('tutorial-overlay').style.display = 'none';

  // Mark this stage's tutorial as seen
  if (currentTutorialStageId) {
    const seenTutorials = JSON.parse(localStorage.getItem('aicodepedagogy_tutorials_seen') || '[]');
    if (!seenTutorials.includes(currentTutorialStageId)) {
      seenTutorials.push(currentTutorialStageId);
      localStorage.setItem('aicodepedagogy_tutorials_seen', JSON.stringify(seenTutorials));
    }
  }

  // Remove any highlights
  if (tutorialHighlightedElement) {
    tutorialHighlightedElement.classList.remove('tutorial-highlight');
    tutorialHighlightedElement = null;
  }
}

function showTutorialStep (stepIndex) {
  const step = currentTutorialSteps[stepIndex];
  if (!step) {
    endTutorial();
    return;
  }

  // Find target element
  const targetSelectors = step.target.split(', ');
  let targetElement = null;
  for (const selector of targetSelectors) {
    targetElement = document.querySelector(selector);
    if (targetElement) break;
  }

  if (!targetElement) {
    // Skip this step if target not found
    currentTutorialStep++;
    showTutorialStep(currentTutorialStep);
    return;
  }

  // Remove previous highlight
  if (tutorialHighlightedElement) {
    tutorialHighlightedElement.classList.remove('tutorial-highlight');
  }

  // Add highlight to new target
  targetElement.classList.add('tutorial-highlight');
  tutorialHighlightedElement = targetElement;

  // Update tooltip content
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-text').textContent = step.text;
  document.getElementById('tutorial-progress').textContent = `${stepIndex + 1} / ${currentTutorialSteps.length}`;

  // Update button text on last step
  const nextBtn = document.getElementById('tutorial-next');
  if (stepIndex === currentTutorialSteps.length - 1) {
    nextBtn.textContent = 'Got it!';
  } else {
    nextBtn.textContent = 'Next →';
  }

  // Position tooltip relative to target
  positionTooltip(targetElement, step.arrow, step.offset);

  // Update arrow direction
  const arrow = document.getElementById('tutorial-arrow');
  arrow.className = 'tutorial-arrow arrow-' + step.arrow;
}

function positionTooltip (targetElement, arrowDirection, offset) {
  const tooltip = document.getElementById('tutorial-tooltip');
  const targetRect = targetElement.getBoundingClientRect();

  // Force tooltip to be visible and get its dimensions
  tooltip.style.visibility = 'hidden';
  tooltip.style.display = 'block';
  const tooltipRect = tooltip.getBoundingClientRect();
  tooltip.style.visibility = 'visible';

  // Use sensible defaults if tooltip hasn't rendered properly
  const tooltipWidth = tooltipRect.width || 320;
  const tooltipHeight = tooltipRect.height || 150;

  let top, left;

  switch (arrowDirection) {
    case 'left':
      // Tooltip to the right of target
      left = targetRect.right + 20 + (offset?.x || 0);
      top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2) + (offset?.y || 0);
      break;
    case 'right':
      // Tooltip to the left of target
      left = targetRect.left - tooltipWidth - 20 + (offset?.x || 0);
      top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2) + (offset?.y || 0);
      break;
    case 'top':
      // Tooltip below target
      left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2) + (offset?.x || 0);
      top = targetRect.bottom + 20 + (offset?.y || 0);
      break;
    case 'bottom':
      // Tooltip above target
      left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2) + (offset?.x || 0);
      top = targetRect.top - tooltipHeight - 20 + (offset?.y || 0);
      break;
    default:
      // Default: center in viewport
      left = (window.innerWidth - tooltipWidth) / 2;
      top = (window.innerHeight - tooltipHeight) / 2;
  }

  // Keep tooltip within viewport
  const padding = 10;
  left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
  top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function setupTutorialEventListeners () {
  const nextBtn = document.getElementById('tutorial-next');
  const skipBtn = document.getElementById('tutorial-skip');
  const backdrop = document.querySelector('.tutorial-backdrop');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentTutorialStep++;
      if (currentTutorialStep >= currentTutorialSteps.length) {
        endTutorial();
      } else {
        showTutorialStep(currentTutorialStep);
      }
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      endTutorial();
    });
  }

  // Click anywhere on backdrop to dismiss tutorial (fallback if tooltip not visible)
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      endTutorial();
    });
  }
}

// Initialize tutorial when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setupTutorialEventListeners();
});

// Export for use in loadStage
window.checkAndStartTutorial = function (stageId) {
  if (shouldShowTutorial(stageId)) {
    // Delay to ensure editor is rendered
    setTimeout(() => startTutorial(stageId), 500);
  }
};
