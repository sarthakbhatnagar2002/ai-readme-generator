# Code Summary Generator README

This project is a VS Code extension that generates a comprehensive README.md file for a codebase using a Retrieval Augmented Generation (RAG) approach.  The extension analyzes the codebase, extracts key information, and leverages a large language model (LLM) to create a professional README.  It also generates a JSON summary and a PDF report of the codebase.

## Features

* **Codebase Analysis:** Extracts codebase statistics (file counts, sizes, types, etc.).
* **JSON Summary Generation:** Creates a JSON file containing detailed codebase information.
* **PDF Report Generation:** Generates a PDF report with codebase statistics and source code snippets.
* **AI-Powered README Generation:** Uses a RAG system with Google Gemini to generate a detailed README.md file.
* **VS Code Integration:** Seamlessly integrates into the VS Code environment via a command.
* **Error Handling and Logging:** Includes robust error handling and detailed logging for debugging.
* **Configuration:** Supports configuration via environment variables (GOOGLE_API_KEY).

## Technology Stack

* **Frontend (VS Code Extension):** JavaScript, Node.js, VS Code API, `jspdf`
* **Backend (Python):** Python 3, `PyPDF2`, `langchain`, `langchain-google-genai`, `google-generativeai`, `faiss-cpu`, `python-dotenv`, `tiktoken`
* **Vector Database:** FAISS
* **LLM:** Google Gemini

## Workflow

1. **Codebase Extraction:** The VS Code extension uses `codebaseExtractor.js` to recursively traverse the open workspace folder, gathering information about files and directories.  It ignores common folders like `node_modules` and `.git`.
2. **JSON and PDF Generation:** The extracted data is saved as a JSON file (`codesummary.json`) and a PDF report (`codesummary.pdf`) is generated using `jspdf`. The PDF includes codebase statistics and source code snippets from text files.
3. **README Generation (Python):** The `codesummary.pdf` is passed to the Python backend (`app.py`).  `app.py` extracts text from the PDF, splits it into chunks, and creates embeddings using Google Gemini's embedding model.
4. **Vector Store Creation:** The embeddings are stored in a FAISS vector store for efficient similarity search.
5. **RAG Query:** The user's question (a prompt requesting a comprehensive README) is embedded, and a similarity search retrieves the most relevant code chunks.
6. **README Generation (LLM):** The relevant code chunks and the user's question are passed to the Google Gemini chat model to generate the README content.
7. **README Post-processing:** The generated README is post-processed to ensure proper formatting (headers, code blocks, etc.).
8. **Output:** The generated README.md is saved to the workspace folder.

## Installation

1. **Prerequisites:** Ensure you have Node.js and npm installed.  The Python backend requires Python 3 and the packages listed in `python/requirements.txt`.  You'll also need a Google Cloud project with the Gemini API enabled and a GOOGLE_API_KEY.
2. **Install Python Dependencies:**
   ```bash
   cd python
   pip install -r requirements.txt
   ```
3. **Install VS Code Extension:**  Install the "Code Summary Generator" extension from the VS Code Marketplace (or clone this repository and build it).

## Usage

1. Open your VS Code project.
2. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P).
3. Type "Generate Code Summary" and select the command.
4. The extension will generate `codesummary.json`, `codesummary.pdf`, and `README.md` in your workspace folder.

## Project Structure

```
code-summary-generator/
├── extension/             # VS Code extension code
│   ├── codebaseExtractor.js
│   ├── extension.js
│   ├── package.json
│   └── ...
└── python/                # Python backend code
    ├── app.py             # Main Python script
    ├── requirements.txt   # Python dependencies
    └── ...
```

## API Documentation (Python Backend)

The Python backend (`app.py`) exposes a single function, `process_pdf`, which takes the path to a PDF file as input and returns a JSON object containing the generated README content and other statistics.  It uses command-line arguments for flexibility.

## Configuration

The extension requires a `GOOGLE_API_KEY` environment variable.  You can set this in your system's environment variables or in a `.env` file in the `python` directory.  The example in `extension.js` shows how to set it directly in the code for testing purposes.  **Do not commit your actual API key to version control.**

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.  Ensure your code follows the style guidelines and includes comprehensive tests.
