const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
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
            'package-lock.json'
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

    generatePDF(outputPath) {
        const doc = new jsPDF({ unit: 'pt', format: 'letter' });
        const summary = this.generateSummary();

        let y = 40;
        doc.setFontSize(18);
        doc.text(`Codebase Summary Report: ${summary.project}`, 40, y);
        y += 30;

        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 40, y);
        y += 20;
        doc.text(`Total Files: ${summary.totalFiles}`, 40, y);
        y += 15;
        doc.text(`Total Directories: ${summary.totalDirectories}`, 40, y);
        y += 15;
        doc.text(`Total Size: ${summary.totalSize}`, 40, y);
        y += 20;

        doc.text('File Types:', 40, y);
        y += 15;
        Object.entries(summary.fileTypes).forEach(([ext, count]) => {
            if (y > 700) {
                doc.addPage();
                y = 40;
            }
            doc.text(`  ${ext || 'no-extension'}: ${count} files`, 60, y);
            y += 12;
        });

        y += 20;
        doc.setFontSize(14);
        doc.text('── Source Code Listing ──', 40, y);
        y += 20;

        for (const file of this.data.files) {
            if (!file.isText || file.size > 500_000) continue;

            if (y > 700) {
                doc.addPage();
                y = 40;
            }

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`File: ${file.path}`, 40, y);
            y += 14;

            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.text(`Size: ${file.size} bytes | Lines: ${file.lines} | Modified: ${new Date(file.modified).toLocaleDateString()}`, 40, y);
            y += 16;

            doc.setFontSize(7);
            const lines = file.content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (y > 750) {
                    doc.addPage();
                    y = 40;
                }

                let line = lines[i];
                if (line.length > 120) line = line.slice(0, 120) + '...';

                const lineNum = String(i + 1).padStart(4, ' ');
                doc.text(`${lineNum}: ${line}`, 40, y);
                y += 10;
            }
            y += 15;

            if (y < 750) {
                doc.setDrawColor(200, 200, 200);
                doc.line(40, y, 550, y);
                y += 10;
            }
        }

        doc.save(outputPath);
        console.log(`✅ PDF report saved with source code to: ${outputPath}`);
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

async function runPythonWithPDF(pdfPath) {
    const pythonExe = 'C:\\Users\\sarth\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'; // Update if needed
    const pythonScript = path.resolve(__dirname, 'app.py');

    return new Promise((resolve, reject) => {
        const pyProcess = spawn(pythonExe, [pythonScript, pdfPath, '--json']);

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

function extractCodebase(folderPath, outputPath, generatePDF = false) {
    try {
        const extractor = new CodebaseExtractor(folderPath);
        const data = extractor.extract();

        if (outputPath) {
            extractor.saveToFile(outputPath);
        }

        let pdfPath = null;
        if (generatePDF) {
            pdfPath = outputPath ? outputPath.replace('.json', '.pdf') : 'codebase-report.pdf';
            extractor.generatePDF(pdfPath);
        }

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

        return { data, pdfPath };
    } catch (error) {
        console.error('Error extracting codebase:', error.message);
        return { data: null, pdfPath: null };
    }
}

// Command line usage
if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);

        if (args.length === 0) {
            console.log('Usage: node codebase-extractor.js <folder-path> [output-file] [--pdf]');
            console.log('Example: node codebase-extractor.js ./my-project ./output.json --pdf');
            console.log('Options:');
            console.log('  --pdf    Generate PDF report along with JSON data');
            process.exit(1);
        }

        const folderPath = args[0];
        const outputPath = args[1] || 'codebase-data.json';
        const generatePDF = args.includes('--pdf');

        const result = extractCodebase(folderPath, outputPath, generatePDF);

        if (generatePDF && result.pdfPath) {
            try {
                await runPythonWithPDF(result.pdfPath);
                console.log('✅ Python script ran successfully with generated PDF');
            } catch (err) {
                console.error('❌ Failed to run Python script:', err.message);
            }
        }
    })();
}

module.exports = { CodebaseExtractor, extractCodebase };
