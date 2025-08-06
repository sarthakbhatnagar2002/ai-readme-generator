const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { CodebaseExtractor } = require('./codebaseExtractor');
require('dotenv').config();

/**
 * Generate README from PDF using Python RAG script
 */
async function generateReadmeFromPDF(pdfPath, extensionPath) {
  // Python script is in the python/ subfolder
  const pythonScriptPath = path.join(extensionPath, '..', 'python', 'app.py');
  
  // Check if Python script exists
  if (!fs.existsSync(pythonScriptPath)) {
    throw new Error(`Python script not found at: ${pythonScriptPath}`);
  }
  
  console.log(`🐍 Using Python script: ${pythonScriptPath}`);
  console.log(`📄 Processing PDF: ${pdfPath}`);
  
  return new Promise((resolve, reject) => {
    // Try different Python executables
    const pythonCommands = [
      'C:\\Users\\sarth\\AppData\\Local\\Programs\\Python\\Python312\\python.exe', 
      'python3',
      'python',
      'py'
    ];
    
    let currentCommandIndex = 0;
    
    function tryPythonCommand() {
      if (currentCommandIndex >= pythonCommands.length) {
        reject(new Error('❌ Python not found. Please ensure Python is installed.'));
        return;
      }
      
      const pythonCmd = pythonCommands[currentCommandIndex];
      console.log(`🔄 Trying Python command: ${pythonCmd}`);
      
      const pythonProcess = spawn(pythonCmd, [pythonScriptPath, pdfPath, '--json'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.join(extensionPath, '..', 'python'), // Set working directory to python folder
        env: {
          ...process.env,
          GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
          PYTHONIOENCODING: 'utf-8'  // Force UTF-8 encoding for Python output
        }
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('🐍 Python stdout:', output);
      });

      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('🐍 Python stderr:', output);
      });

      pythonProcess.on('close', (code) => {
        console.log(`🐍 Python process exited with code: ${code}`);
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log('✅ Successfully parsed JSON response');
              resolve(result.content);
            } else {
              reject(new Error(result.message || 'Python script failed'));
            }
          } catch (parseError) {
            console.log('⚠️ Could not parse JSON, using raw output');
            if (stdout.trim()) {
              resolve(stdout.trim());
            } else {
              reject(new Error('No output from Python script'));
            }
          }
        } else {
          currentCommandIndex++;
          tryPythonCommand();
        }
      });

      pythonProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          currentCommandIndex++;
          tryPythonCommand();
        } else {
          reject(new Error(`Failed to start Python process: ${error.message}`));
        }
      });
    }
    
    tryPythonCommand();
  });
}

/**
 * Main function to generate code summary and README
 */
async function generateCodeSummary(extensionPath) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error('No folder is open in VS Code.');
  }
  
  const folderPath = folders[0].uri.fsPath;
  console.log(`📂 Processing workspace: ${folderPath}`);
  
  const extractor = new CodebaseExtractor(folderPath);

  // Step 1: Extract codebase
  console.log('🔍 Step 1: Extracting codebase...');
  extractor.extract();

  // Step 2: Save JSON
  console.log('💾 Step 2: Saving JSON...');
  const jsonPath = path.join(folderPath, 'codesummary.json');
  extractor.saveToFile(jsonPath);

  // Step 3: Generate PDF in workspace folder
  console.log('📄 Step 3: Generating PDF...');
  const pdfPath = path.join(folderPath, 'codesummary.pdf');
  extractor.generatePDF(pdfPath);
  
  // Verify PDF was created
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF was not created at: ${pdfPath}`);
  }
  console.log(`✅ PDF created successfully: ${pdfPath}`);

  // Step 4: Generate README using Python RAG
  console.log('🤖 Step 4: Generating README with AI...');
  const readmeContent = await generateReadmeFromPDF(pdfPath, extensionPath);
  
  // Step 5: Save README
  console.log('📝 Step 5: Saving README...');
  const readmePath = path.join(folderPath, 'README.md');
  const header = `<!-- Auto-generated README using AI RAG -->\n<!-- Generated on: ${new Date().toISOString()} -->\n\n`;
  fs.writeFileSync(readmePath, header + readmeContent, 'utf8');
  
  return { readmePath, pdfPath, jsonPath };
}

function activate(context) {
  console.log('🚀 README Generator Extension is now active!');
  
  const disposable = vscode.commands.registerCommand('extension.generateCodeSummary', async () => {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating README with AI",
        cancellable: false
      }, async (progress, token) => {
        
        progress.report({ increment: 0, message: "Starting process..." });
        
        try {
          const result = await generateCodeSummary(context.extensionPath);
          
          progress.report({ increment: 100, message: "Complete!" });
          
          const choice = await vscode.window.showInformationMessage(
            `✅ README generated successfully!`,
            'Open README',
            'Open PDF',
            'Open Folder'
          );
          
          if (choice === 'Open README') {
            const document = await vscode.workspace.openTextDocument(result.readmePath);
            await vscode.window.showTextDocument(document);
          } else if (choice === 'Open PDF') {
            vscode.env.openExternal(vscode.Uri.file(result.pdfPath));
          } else if (choice === 'Open Folder') {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(path.dirname(result.readmePath)));
          }
          
        } catch (error) {
          progress.report({ increment: 100, message: "Failed!" });
          throw error;
        }
      });

    } catch (error) {
      console.error('❌ Extension error:', error);
      vscode.window.showErrorMessage(`❌ Failed: ${error.message}`);
      
      const outputChannel = vscode.window.createOutputChannel('README Generator');
      outputChannel.appendLine(`Error: ${error.message}`);
      outputChannel.appendLine(`Stack: ${error.stack}`);
      outputChannel.show();
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

function deactivate() {
  console.log('📴 README Generator Extension deactivated');
}

module.exports = { activate, deactivate };
