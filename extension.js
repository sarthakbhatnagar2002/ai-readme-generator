const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ADD THIS DEBUG BLOCK HERE
console.log('=== EXTENSION STARTUP DEBUG ===');
console.log('Extension directory:', __dirname);
console.log('Files in extension directory:', fs.readdirSync(__dirname));
const codebaseExtractorPath = path.join(__dirname, 'codebaseExtractor.js');
console.log('codebaseExtractor.js exists:', fs.existsSync(codebaseExtractorPath));
if (fs.existsSync(codebaseExtractorPath)) {
  console.log('File size:', fs.statSync(codebaseExtractorPath).size, 'bytes');
}
console.log('=== END DEBUG ===');

let CodebaseExtractor = null;
try {
  console.log('Current directory:', __dirname);
  console.log('Looking for codebaseExtractor.js');
  
  const fs = require('fs');
  const extPath = path.join(__dirname, 'codebaseExtractor.js');
  console.log('File exists:', fs.existsSync(extPath));
  console.log('Files in directory:', fs.readdirSync(__dirname));
  
  const extractor = require('./codebaseExtractor');
  console.log('Required module:', extractor);
  console.log('CodebaseExtractor property:', extractor.CodebaseExtractor);
  
  CodebaseExtractor = extractor.CodebaseExtractor;
  console.log('CodebaseExtractor loaded successfully');
} catch (error) {
  console.error('Failed to load CodebaseExtractor:', error.message);
  console.error('Error stack:', error.stack);
}

async function generateReadmeFromJSON(jsonPath, extensionPath, apiKey) {
  const pythonScriptPath = path.join(extensionPath, 'python', 'app.py');

  if (!fs.existsSync(pythonScriptPath)) {
    return "# Auto-generated README\n\nThis README was generated from the codebase analysis. Python AI script was not available.";
  }

  // Check if API key is provided
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API key not found. Please set "codeSummaryGenerator.apiKey" in your VS Code settings.');
  }

  return new Promise((resolve, reject) => {
    const pythonCommands = [
      'C:\\Users\\sarth\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
      'python3',
      'python',
      'py'
    ];

    let currentCommandIndex = 0;

    function tryPythonCommand() {
      if (currentCommandIndex >= pythonCommands.length) {
        resolve("# Auto-generated README\n\nThis README was generated from the codebase analysis. Python was not available for AI generation.");
        return;
      }

      const pythonCmd = pythonCommands[currentCommandIndex];

      // ✅ UPDATED: Pass JSON path instead of PDF path, removed --json flag
      const pythonProcess = spawn(pythonCmd, [pythonScriptPath, jsonPath, apiKey, '--clean'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(pythonScriptPath),
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8'
        }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          // With --clean flag, we get direct README content, not JSON
          if (stdout.trim()) {
            resolve(stdout.trim());
          } else {
            resolve("# Auto-generated README\n\nCodebase analysis completed but no content was generated.");
          }
        } else {
          // Log stderr for debugging
          if (stderr.trim()) {
            console.error(`Python stderr: ${stderr}`);
          }
          currentCommandIndex++;
          tryPythonCommand();
        }
      });

      pythonProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          currentCommandIndex++;
          tryPythonCommand();
        } else {
          reject(new Error(`Python process error: ${error.message}`));
        }
      });
    }

    tryPythonCommand();
  });
}

async function generateCodeSummary(extensionPath) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error('No folder is open in VS Code.');
  }

  const folderPath = folders[0].uri.fsPath;

  if (!CodebaseExtractor) {
    console.log('CodebaseExtractor is still null after loading attempt');
    throw new Error('CodebaseExtractor is not available. Please check if the codebaseExtractor.js file exists.');
  }

  // ✅ Get API key from VS Code settings
  const apiKey = vscode.workspace.getConfiguration('codeSummaryGenerator').get('apiKey');
  
  // ✅ Check if API key is set before processing
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API key not set. Please add "codeSummaryGenerator.apiKey" to your VS Code settings.');
  }

  const extractor = new CodebaseExtractor(folderPath);
  extractor.extract();

  const jsonPath = path.join(folderPath, 'codesummary.json');
  extractor.saveToFile(jsonPath);

  // ✅ REMOVED: PDF generation - no longer needed
  // const pdfPath = path.join(folderPath, 'codesummary.pdf');
  // extractor.generatePDF(pdfPath);

  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON was not created at: ${jsonPath}`);
  }

  // ✅ UPDATED: Use JSON instead of PDF for README generation
  const readmeContent = await generateReadmeFromJSON(jsonPath, extensionPath, apiKey);

  const readmePath = path.join(folderPath, 'README.md');
  const header = `<!-- Auto-generated README using AI RAG -->\n<!-- Generated on: ${new Date().toISOString()} -->\n\n`;
  fs.writeFileSync(readmePath, header + readmeContent, 'utf8');

  // ✅ UPDATED: Return only readmePath and jsonPath (no pdfPath)
  return { readmePath, jsonPath };
}

function activate(context) {
  const outputChannel = vscode.window.createOutputChannel('README Generator');

  const disposable = vscode.commands.registerCommand('extension.generateCodeSummary', async () => {
    outputChannel.show();

    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating README with AI",
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: "Starting process..." });
        const result = await generateCodeSummary(context.extensionPath);
        progress.report({ increment: 100, message: "Complete!" });

        // ✅ UPDATED: Removed PDF option since we no longer generate PDFs
        const choice = await vscode.window.showInformationMessage(
          `README generated successfully!`,
          'Open README',
          'Open JSON Data',
          'Open Folder'
        );

        if (choice === 'Open README') {
          const document = await vscode.workspace.openTextDocument(result.readmePath);
          await vscode.window.showTextDocument(document);
        } else if (choice === 'Open JSON Data') {
          const document = await vscode.workspace.openTextDocument(result.jsonPath);
          await vscode.window.showTextDocument(document);
        } else if (choice === 'Open Folder') {
          vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(path.dirname(result.readmePath)));
        }
      });

    } catch (error) {
      outputChannel.appendLine(`Error: ${error.message}`);
      vscode.window.showErrorMessage(`Failed: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(file-code) Generate README";
  statusBarItem.command = 'extension.generateCodeSummary';
  statusBarItem.tooltip = 'Generate README from codebase using AI';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

function deactivate() {}

module.exports = { activate, deactivate };