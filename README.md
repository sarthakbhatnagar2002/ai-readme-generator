# Code Summary Generator: README

This project generates a comprehensive README.md file and a PDF summarizing a codebase using a Retrieval Augmented Generation (RAG) approach.  It leverages Google Gemini for large language model (LLM) capabilities and analyzes the codebase to provide a detailed overview for developers.

## Description

The Code Summary Generator is a VS Code extension that analyzes a project's codebase, extracts key information, and generates a professional README.md file. This README includes details about the project's purpose, technology stack, installation, usage, structure, and any relevant configuration settings. The process involves extracting codebase information, creating a vector store for efficient similarity search, and using a RAG chain to generate the README content.  A PDF report is also generated containing a detailed analysis of the codebase.

## Features

* **Codebase Analysis:** Extracts information about files, directories, and their contents.
* **Vector Store Creation:** Uses FAISS to create a vector store for efficient similarity search.
* **README Generation:** Generates a professional README.md file using Google Gemini's LLM capabilities and RAG.
* **PDF Report Generation:** Creates a PDF report with detailed codebase analysis.
* **VS Code Integration:** Seamlessly integrates into the VS Code environment as an extension.
* **Error Handling:** Includes robust error handling and logging for debugging.
* **Configuration:** Uses environment variables for API key management.

## Technology Stack

* **Languages:** JavaScript (Node.js), Python
* **Frameworks/Libraries:**
    * VS Code Extension API (JavaScript)
    * Google Generative AI (Gemini)
    * LangChain (Python)
    * PyPDF2 (Python)
    * FAISS (Python)
    * `jspdf` (JavaScript - for PDF generation within the extension)
* **Tools:**  VS Code, Node.js, npm, Python, pip

## Workflow

1. **Codebase Extraction (JavaScript):** The VS Code extension (`extension.js`, `codebaseExtractor.js`) scans the project directory, identifying files and directories. It ignores files and directories specified in the `.gitignore` and `.vscodeignore` files.  It extracts file content (for text files) and metadata (size, modification time, etc.). This data is saved as a JSON file (`codebase-data.json`).
2. **PDF Generation (JavaScript):** A preliminary PDF report (`codesummary.pdf`) is created containing a summary of the codebase analysis. This PDF includes file lists, directory structures, and basic statistics.
3. **Python Script Execution (Python):** The extension invokes a Python script (`app.py`) which processes the `codesummary.pdf`.
4. **PDF Processing (Python):** The Python script extracts text from the PDF.
5. **Vector Store Creation (Python):** The extracted text is split into chunks and embedded using Google Generative AI embeddings. These embeddings are used to create a FAISS vector store.
6. **RAG-based README Generation (Python):**  A LangChain RAG chain is used to query the vector store with a prompt that specifies the desired README content. The LLM generates the README based on the most relevant code snippets.
7. **Post-processing (Python):** The generated README content is post-processed to ensure proper markdown formatting.
8. **Result Handling (JavaScript):** The generated README content is received by the extension and saved as `README.md` in the project root.

**Simplified Diagram:**

```
[VS Code] --(Extension)--> [Codebase Extraction (JS)] --> [PDF Generation (JS)] --> [Python Script (app.py)]
                                                                                    |
                                                                                    V
                                                                            [PDF Processing, Vector Store, RAG (Python)] --> [README Generation (Python)] --> [README.md (VS Code)]
```

## Installation

1. **Install the VS Code Extension:**  This extension is not yet published on the VS Code Marketplace.  To run it, clone the repository and follow the development instructions below.

2. **Python Dependencies:**  Ensure you have Python 3 installed. Install the required Python packages using pip:

```bash
pip install -r python/requirements.txt
```

3. **Google Cloud API Key:** Obtain a Google Cloud API key with access to Gemini and embeddings. Set the environment variable `GOOGLE_API_KEY` or `codeSummaryGenerator.apiKey` (for the extension) with your API key.  The extension will prioritize `codeSummaryGenerator.apiKey` if set in VS Code settings.

## Usage

1. **Open your project in VS Code.**
2. **Run the command "Generate Code Summary".** This will trigger the extension.
3. **The extension will generate `README.md` and `codesummary.pdf` in your project's root directory.**

## Project Structure

```
code-summary-generator/
├── extension.js          // Main VS Code extension file
├── codebaseExtractor.js  // Codebase analysis logic
├── jsconfig.json         // JS compiler configuration
├── package.json          // Extension metadata and dependencies
├── python/               // Python scripts
│   ├── app.py            // Main Python script for README generation
│   ├── requirements.txt  // Python dependencies
│   └── test_gemini_embeddings.py // Script to test Gemini embeddings setup
└── test/                  // Test files (for extension development)
    └── ...
```

## API Documentation

There are no REST endpoints or public APIs exposed by this project.  The interaction is solely through the VS Code extension.

## Configuration

The primary configuration is the Google Cloud API key, which should be set as an environment variable: `GOOGLE_API_KEY` or in VS Code settings as `codeSummaryGenerator.apiKey`.

## Development Setup

1. Clone the repository.
2. Install Node.js and npm.
3. Run `npm install` to install the extension dependencies.
4. Run `pip install -r python/requirements.txt` to install Python dependencies.
5. Set your Google Cloud API key as described above.
6. Open the project in VS Code.
7. Press F5 to start debugging the extension.

This README was automatically generated using the codebase analysis functionality of this project.
