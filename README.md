# Digging into AI: An Archaeological Python Adventure

[![Live Demo](https://img.shields.io/badge/demo-jtm.io-blue)](https://jtm.io/codepedagogy/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Paper](https://img.shields.io/badge/paper-Springer-orange)](https://link.springer.com/chapter/10.1007/978-3-032-12408-1_15)

An educational web game teaching Python programming through an archaeological narrative. Designed for the **DHSI 2025** course "Digital Humanities Programming Pedagogy in the Age of AI."

**[▶ Play the Demo](https://jtm.io/codepedagogy/)**

---

## What is This?

You're a digital archaeology assistant helping Dr. Elena Rodriguez decode ancient data fragments from the Library of Alexandria's lost digital archives. As you progress through 9 stages, you'll learn Python fundamentals while uncovering a mystery spanning millennia.

### Educational Goals

1. **Learn Python** through authentic problem-solving, not abstract exercises
2. **Experience AI-assisted coding** as a teaching tool, not a crutch
3. **Build independence** through progressive scaffolding that fades as skills develop
4. **Understand AI collaboration** patterns used in modern development

---

## Key Features

### 🏛️ Narrative-Driven Learning
- Archaeological storyline provides context and motivation
- Dr. Rodriguez reacts to your code output with in-character responses
- Progressive story reveals as you advance through stages

### 🤖 AI Coding Assistant
- **Get hints** without getting answers (pedagogically filtered)
- **Debug help** that teaches you to read error messages
- **Concept explanations** when you need background
- Multiple AI providers: In-browser (Qwen 2.5 Coder), Ollama, OpenAI, Anthropic

### 📓 Jupyter-Style Interface
- Multi-cell code editor for complex stages
- Variables persist across cells within a stage
- "Excavation layers" metaphor for progressive unlocking

### 🎯 Flexible Validation
- Accepts multiple correct solutions
- Pattern matching rather than exact output comparison
- Immediate feedback with helpful error messages

---

## Quick Start

### Option 1: Play Online
Visit **[jtm.io/codepedagogy](https://jtm.io/codepedagogy/)** — no installation required.

### Option 2: Run Locally
```bash
git clone https://github.com/lucidbard/AICodePedagogy.git
cd AICodePedagogy
python3 -m http.server 8000
# Open http://localhost:8000
```

### Option 3: With AI Features
```bash
# Install Ollama (https://ollama.ai)
ollama pull qwen2.5:1.5b

# Run with CORS enabled
OLLAMA_ORIGINS="http://localhost:*" ollama serve

# Start the app
python3 -m http.server 8000
```

---

## AI Assistant Options

| Provider | Setup | Best For |
|----------|-------|----------|
| **In-Browser (Qwen)** | None — click "Download" | Quick start, no installation |
| **Ollama** | Install locally | Privacy, speed, model variety |
| **OpenAI** | API key required | Highest quality responses |
| **Anthropic** | API key required | Claude models |

The in-browser option runs **Qwen 2.5 Coder 1.5B** entirely in your browser using WebGPU (~1.3GB download, cached for future use).

---

## Curriculum Overview

| Stage | Concept | Challenge |
|-------|---------|-----------|
| 1 | Print & Variables | Display artifact messages |
| 2 | Data Types | Categorize fragment data |
| 3 | Conditionals | Filter artifacts by criteria |
| 4 | Min/Max | Find date ranges |
| 5 | Loops | Process collections |
| 6 | String Methods | Search ancient texts |
| 7 | Functions | Calculate statistics |
| 8 | String Manipulation | Decode messages |
| 9 | Integration | Create final report |

---

## For Educators

### Customizing Content
Edit `game-content.json` to modify:
- Stage narratives and challenges
- Starter code and validation rules
- Hints (now phrased as exploratory questions)
- Data sets for analysis

### AI Pedagogy Features
The AI assistant is designed to **teach, not solve**:
- Hints filtered to remove complete code solutions
- Debug help explains errors without giving fixes
- Progressive agency levels (hints → suggestions → collaboration)

See [`docs/AI_TUTOR_DESIGN.md`](docs/AI_TUTOR_DESIGN.md) for the full pedagogical framework.

### Model Selection Methodology
We systematically evaluated models for pedagogical appropriateness. See [`docs/LLM_MODEL_EVALUATION.md`](docs/LLM_MODEL_EVALUATION.md) for our evaluation methodology and findings.

---

## Project Structure

```
├── index.html              # Main application
├── script.js               # Game logic (3000+ lines)
├── style.css               # All styling
├── game-content.json       # Curriculum content (editable)
├── llm-integration.js      # AI provider integration
├── docs/
│   ├── CHANGELOG.md        # Development history
│   ├── AI_TUTOR_DESIGN.md  # Pedagogical framework
│   └── LLM_MODEL_EVALUATION.md  # Model selection methodology
├── scripts/
│   ├── evaluate-models.js  # Model comparison tool
│   └── e2e-prompt-test.js  # Prompt validation
└── vendor/                 # Local copies of dependencies
```

---

## Technical Stack

- **Python Execution**: [Skulpt](https://skulpt.org/) (in-browser Python interpreter)
- **Code Editor**: [CodeMirror 5](https://codemirror.net/5/)
- **AI (In-Browser)**: [Transformers.js](https://huggingface.co/docs/transformers.js) + WebGPU
- **No build step** — vanilla JavaScript, works offline

---

## Development

```bash
# Run tests
npm test

# Start dev server
npm run test:serve

# Evaluate models (requires Ollama)
node scripts/evaluate-models.js

# Test prompts
node scripts/e2e-prompt-test.js
```

See [`CLAUDE.md`](CLAUDE.md) for development guidelines.

---

## Contributing

Contributions welcome! Areas of interest:
- Additional curriculum stages
- Accessibility improvements
- Localization/translation
- Alternative narratives

---

## Citation

If you use this project in your research or teaching, please cite:

```bibtex
@inproceedings{murray2025digging,
  title={Digging into AI: An Archaeological Python Adventure},
  author={Murray, John T.},
  booktitle={Digital Humanities and Programming Pedagogy},
  year={2025},
  publisher={Springer},
  doi={10.1007/978-3-032-12408-1_15}
}
```

**Paper**: [Springer Link](https://link.springer.com/chapter/10.1007/978-3-032-12408-1_15)

---

## Credits

Created for **DHSI 2025**: Digital Humanities Programming Pedagogy in the Age of AI

**Author**: John T. Murray

**Acknowledgments**:
- Archaeological narrative concept inspired by digital humanities pedagogy
- Skulpt project for in-browser Python
- Hugging Face for Transformers.js and model hosting

---

## License

MIT License — see [LICENSE](LICENSE) for details.
