const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class CodebaseExtractor {
    constructor(rootPath) {
        this.rootPath = path.resolve(rootPath);
        this.data = {
            rootDirectory: this.rootPath,
            timestamp: new Date().toISOString(),
            files: [],
            directories: [],
            summary: {
                totalFiles: 0,
                totalDirectories: 0,
                totalSize: 0,
                fileTypes: {}
            }
        };
        this.ignorePatterns = [
            'node_modules',
            '.git',
            '.vscode',
            'dist',
            'build',
            '.env',
            '*.log',
            '.DS_Store',
            'Thumbs.db',
            'codesummary.pdf',
            'codesummary.json',
            'README.md',
            'package-lock.json',
            'venv',
            '.venv',
            '__pycache__',
            '*.pyc',
            '*.pyo',
            '.pytest_cache',
            '.mypy_cache',
            '.tox'
        ];

    }

    shouldIgnore(filePath) {
        const fileName = path.basename(filePath);
        return this.ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace('*', '.*'));
                return regex.test(fileName);
            }
            return fileName === pattern;
        });
    }

    getFileExtension(filePath) {
        return path.extname(filePath).toLowerCase();
    }

    readFileContent(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return content;
        } catch (error) {
            return `Binary file or read error: ${error.message}`;
        }
    }

    getFileStats(filePath) {
        try {
            return fs.statSync(filePath);
        } catch (error) {
            return null;
        }
    }

    processFile(filePath, relativePath) {
        const stats = this.getFileStats(filePath);
        if (!stats) return;

        const extension = this.getFileExtension(filePath);
        const content = this.readFileContent(filePath);

        const fileData = {
            path: relativePath,
            absolutePath: filePath,
            name: path.basename(filePath),
            extension,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            content,
            lines: content.split('\n').length,
            isText: this.isTextFile(extension)
        };

        this.data.files.push(fileData);
        this.data.summary.totalFiles++;
        this.data.summary.totalSize += stats.size;

        const ext = extension || 'no-extension';
        this.data.summary.fileTypes[ext] = (this.data.summary.fileTypes[ext] || 0) + 1;
    }

    isTextFile(extension) {
        const textExtensions = [
            '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.scss',
            '.md', '.txt', '.xml', '.yml', '.yaml', '.py', '.java', '.c',
            '.cpp', '.h', '.php', '.rb', '.go', '.rs', '.swift', '.kt',
            '.sql', '.sh', '.bat', '.ps1', '.vue', '.svelte', '.conf',
            '.ini', '.cfg', '.env', '.gitignore', '.gitattributes'
        ];
        return textExtensions.includes(extension);
    }

    processDirectory(dirPath, relativePath = '') {
        try {
            const items = fs.readdirSync(dirPath);

            if (relativePath) {
                this.data.directories.push({
                    path: relativePath,
                    absolutePath: dirPath,
                    name: path.basename(dirPath)
                });
                this.data.summary.totalDirectories++;
            }

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const relativeItemPath = relativePath ? path.join(relativePath, item) : item;

                if (this.shouldIgnore(itemPath)) continue;

                const stats = this.getFileStats(itemPath);
                if (!stats) continue;

                if (stats.isDirectory()) {
                    this.processDirectory(itemPath, relativeItemPath);
                } else if (stats.isFile()) {
                    this.processFile(itemPath, relativeItemPath);
                }
            }
        } catch (error) {
            console.error(`Error processing directory ${dirPath}:`, error.message);
        }
    }

    extract() {
        console.log(`Starting extraction from: ${this.rootPath}`);

        if (!fs.existsSync(this.rootPath)) {
            throw new Error(`Directory does not exist: ${this.rootPath}`);
        }

        this.processDirectory(this.rootPath);

        this.data.files.sort((a, b) => a.path.localeCompare(b.path));
        this.data.directories.sort((a, b) => a.path.localeCompare(b.path));

        console.log("✅ Extraction complete:");
        console.log(`- Files: ${this.data.summary.totalFiles}`);
        console.log(`- Directories: ${this.data.summary.totalDirectories}`);
        console.log(`- Total Size: ${(this.data.summary.totalSize / 1024 / 1024).toFixed(2)} MB`);

        return this.data;
    }

    saveToFile(outputPath = 'codebase-data.json') {
        const outputFile = path.resolve(outputPath);
        fs.writeFileSync(outputFile, JSON.stringify(this.data, null, 2));
        console.log(`✅ Data saved to: ${outputFile}`);
        return outputFile;
    }

    generateSummary() {
        const summary = {
            project: path.basename(this.rootPath),
            totalFiles: this.data.summary.totalFiles,
            totalDirectories: this.data.summary.totalDirectories,
            totalSize: `${(this.data.summary.totalSize / 1024 / 1024).toFixed(2)} MB`,
            fileTypes: this.data.summary.fileTypes,
            largestFiles: this.data.files
                .sort((a, b) => b.size - a.size)
                .slice(0, 10)
                .map(f => ({ path: f.path, size: f.size })),
            recentFiles: this.data.files
                .sort((a, b) => new Date(b.modified) - new Date(a.modified))
                .slice(0, 10)
                .map(f => ({ path: f.path, modified: f.modified }))
        };

        return summary;
    }
}

async function runPythonWithJSON(jsonPath) {
    const pythonExe = 'C:\\Users\\sarth\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'; // Update if needed
    const pythonScript = path.resolve(__dirname, 'app.py');

    return new Promise((resolve, reject) => {
        const pyProcess = spawn(pythonExe, [pythonScript, jsonPath]);

        pyProcess.stdout.on('data', (data) => {
            console.log(`Python stdout: ${data.toString()}`);
        });

        pyProcess.stderr.on('data', (data) => {
            console.error(`Python stderr: ${data.toString()}`);
        });

        pyProcess.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Python script exited with code ${code}`));
        });
    });
}

function extractCodebase(folderPath, outputPath = 'codebase-data.json') {
    try {
        const extractor = new CodebaseExtractor(folderPath);
        const data = extractor.extract();

        // Always save JSON file and return the path
        const jsonPath = extractor.saveToFile(outputPath);

        const summary = extractor.generateSummary();
        console.log('\n=== CODEBASE SUMMARY ===');
        console.log(`Project: ${summary.project}`);
        console.log(`Total Files: ${summary.totalFiles}`);
        console.log(`Total Directories: ${summary.totalDirectories}`);
        console.log(`Total Size: ${summary.totalSize}`);
        console.log('\nFile Types:');
        Object.entries(summary.fileTypes).forEach(([ext, count]) => {
            console.log(`  ${ext}: ${count} files`);
        });

        return { data, jsonPath };
    } catch (error) {
        console.error('Error extracting codebase:', error.message);
        return { data: null, jsonPath: null };
    }
}

// Command line usage
if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.log('Usage: node codebase-extractor.js <folder-path> [output-file]');
            console.log('Example: node codebase-extractor.js ./my-project ./output.json');
            process.exit(1);
        }

        const folderPath = args[0];
        const outputPath = args[1] || 'codebase-data.json';

        const result = extractCodebase(folderPath, outputPath);

        if (result.jsonPath) {
            try {
                await runPythonWithJSON(result.jsonPath);
                console.log('✅ Python script ran successfully with generated JSON');
            } catch (err) {
                console.error('❌ Failed to run Python script:', err.message);
            }
        }
    })();
}

module.exports = { CodebaseExtractor, extractCodebase };