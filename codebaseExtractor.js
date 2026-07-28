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
            '.tox',
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
            return `[Binary file or read error: ${error.message}]`;
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
            lines: typeof content === 'string' ? content.split('\n').length : 0,
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
        if (!fs.existsSync(this.rootPath)) {
            throw new Error(`Directory does not exist: ${this.rootPath}`);
        }
        this.processDirectory(this.rootPath);
        this.data.files.sort((a, b) => a.path.localeCompare(b.path));
        this.data.directories.sort((a, b) => a.path.localeCompare(b.path));
        return this.data;
    }

    saveToFile(outputPath = 'codebase-data.json') {
        const outputFile = path.resolve(outputPath);
        fs.writeFileSync(outputFile, JSON.stringify(this.data, null, 2));
        return outputFile;
    }
}

module.exports = { CodebaseExtractor };