const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const config = vscode.workspace.getConfiguration('codeSummaryGenerator');
const apiKey = config.get('apiKey');
const { CodebaseExtractor } = require('./codebaseExtractor');

async function generateReadmeFromJSON(jsonPath, extensionPath) {
  const pythonScriptPath = path.join(extensionPath, 'python', 'app.py');

  if (!fs.existsSync(pythonScriptPath)) {
    console.warn(`Python script not found at: ${pythonScriptPath}, will skip AI generation`);
    return "# Auto-generated README\n\nThis README was generated from the codebase analysis. Python AI script was not available./Your computers python is not responding, please check your python installation and ensure it's in your PATH.";
  }
  if (!apiKey) {
    throw new Error('API key not found in VS Code settings. Please set codeSummaryGenerator.apiKey in your Open User Settings.');
  }
  const pythonCommands = [
    'py'
  ];
  for (const pythonCmd of pythonCommands) {
    try {
      const result = await tryPythonCommand(pythonCmd, pythonScriptPath, jsonPath);
      if (result) return result;
    } catch (error) {
      continue;
    }
  }
  console.warn('Python not found, using fallback content');
  return "# Auto-generated README\n\nThis README was generated from the codebase analysis. Python was not available for AI generation.";
}

function tryPythonCommand(pythonCmd, pythonScriptPath, jsonPath) {
  return new Promise((resolve, reject) => {
    console.log('=== ATTEMPTING PYTHON CMD ===', pythonCmd);

    const pythonProcess = spawn(pythonCmd, [pythonScriptPath, jsonPath, '--json'], {
      env: {
        ...process.env,
        'codeSummaryGenerator.apiKey': apiKey
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('PYTHON STDERR CHUNK:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      console.log('=== PYTHON PROCESS CLOSED ===', pythonCmd, 'exit code:', code);
      if (stderr) console.log('FULL STDERR:', stderr);
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Python process failed with code ${code}: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.log('=== SPAWN ERROR ===', pythonCmd, '-', error.message, '- code:', error.code);
      reject(error);
    });
  });
}

async function generateCodeSummary(extensionPath) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error('No folder is open in VS Code.');
  }
  const folderPath = folders[0].uri.fsPath;
  const extractor = new CodebaseExtractor(folderPath);
  extractor.extract();
  const jsonPath = path.join(folderPath, 'codesummary.json');
  extractor.saveToFile(jsonPath);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON was not created at: ${jsonPath}`);
  }
  const readmeContent = await generateReadmeFromJSON(jsonPath, extensionPath);
  const readmePath = path.join(folderPath, 'README.md');
  const header = `<!-- Auto-generated README using AI RAG -->\n<!-- Generated on: ${new Date().toISOString()} -->\n\n`;
  // fs.writeFileSync(filePath, content, encoding); this is the basic writefilesync structure
  fs.writeFileSync(readmePath, header + readmeContent, 'utf8');
  return { readmePath, jsonPath };
}

function activate(context) {
  const disposable = vscode.commands.registerCommand('extension.generateCodeSummary', async () => {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating README with AI",
        cancellable: false
      }, async (progress, token) => {
        progress.report({ increment: 0, message: "Starting process..." });
        const result = await generateCodeSummary(context.extensionPath);
        progress.report({ increment: 100, message: "Complete!" });
        const choice = await vscode.window.showInformationMessage(
          `README generated successfully!`,
          'Open README',
          'Open JSON'
        );
        if (choice === 'Open README') {
          const document = await vscode.workspace.openTextDocument(result.readmePath);
          await vscode.window.showTextDocument(document);
        } else if (choice === 'Open JSON') {
          const document = await vscode.workspace.openTextDocument(result.jsonPath);
          await vscode.window.showTextDocument(document);
        }
      });
    } catch (error) {
      console.error('Extension error:', error);
      vscode.window.showErrorMessage(`Failed: ${error.message}`);
    }
  });
  context.subscriptions.push(disposable);
}

function deactivate() {
  console.log('README Generator Extension deactivated');
}

module.exports = { activate, deactivate };