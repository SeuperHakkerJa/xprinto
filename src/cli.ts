#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { run } from './main';
import { logger } from './utils/logger';
import { PdfOptions } from './utils/types';
import { themes } from './utils/themes'; 
 
const program = new Command();

// Get version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json'); // Adjust path if needed
const packageJson = fs.readJsonSync(packageJsonPath);

program
    .name('xprinto')
    .description('Convert code repositories to beautiful PDFs with syntax highlighting.')
    .version(packageJson.version)
    .argument('<repository-path>', 'Path to the code repository or directory')
    .option('-o, --output <path>', 'Output path for the generated PDF file', 'code-output.pdf')
    .option('-t, --title <title>', 'Title for the PDF document', 'Code Repository Documentation')
    .option('-f, --font-size <size>', 'Font size for code blocks', '9') // Adjusted default
    .option('--theme <name>', `Syntax highlighting theme (available: ${Object.keys(themes).join(', ')})`, 'light')
    .option('--line-numbers', 'Show line numbers in code blocks (default)')
    .option('--no-line-numbers', 'Hide line numbers in code blocks')
    .option('--paper-size <size>', 'Paper size (A4, Letter, or width,height in points)', 'A4')
    .option('-v, --verbose', 'Enable verbose logging output', false)
    .action(async (repoPathArg, options) => {
        logger.setVerbose(options.verbose);
        // Set env var for verbose stack traces in main
        if (options.verbose) {
            process.env.XP_VERBOSE = 'true';
        }

        const resolvedRepoPath = path.resolve(repoPathArg);
        const resolvedOutputPath = path.resolve(options.output);

        logger.info(`Input path resolved to: ${resolvedRepoPath}`);
        logger.info(`Output path resolved to: ${resolvedOutputPath}`);

        // Validate input path exists and is a directory
        try {
            const stats = await fs.stat(resolvedRepoPath);
            if (!stats.isDirectory()) {
                logger.error(`Input path must be a directory: ${resolvedRepoPath}`);
                process.exit(1);
            }
        } catch (error) {
            logger.error(`Cannot access input path: ${resolvedRepoPath}`);
            logger.error((error as Error).message);
            process.exit(1);
        }

        // Validate theme
        if (!themes[options.theme.toLowerCase()]) {
             logger.error(`Invalid theme specified: ${options.theme}. Available: ${Object.keys(themes).join(', ')}`);
             process.exit(1);
        }

        // Parse paper size
        let paperSizeOption: PdfOptions['paperSize'];
        if (options.paperSize.includes(',')) {
            const dims = options.paperSize.split(',').map(Number);
            if (dims.length === 2 && !isNaN(dims[0]) && !isNaN(dims[1]) && dims[0] > 0 && dims[1] > 0) {
                paperSizeOption = [dims[0], dims[1]];
            } else {
                logger.error('Invalid paper size format. Use "width,height" in points (e.g., "595,842").');
                process.exit(1);
            }
        } else if (options.paperSize.toUpperCase() === 'A4' || options.paperSize.toUpperCase() === 'LETTER') {
            paperSizeOption = options.paperSize.toUpperCase() as 'A4' | 'Letter';
        } else {
            logger.error('Invalid paper size. Use "A4", "Letter", or "width,height".');
            process.exit(1);
        }


        // Construct PDF options object
        const pdfOptions: PdfOptions = {
            output: resolvedOutputPath,
            title: options.title,
            fontSize: parseInt(options.fontSize, 10),
            showLineNumbers: options.lineNumbers, // Commander handles --no- prefix automatically
            theme: options.theme.toLowerCase(),
            paperSize: paperSizeOption,
            // --- Sensible Defaults for Layout ---
            // Adjust these margins and heights as needed for aesthetics
            margins: { top: 50, right: 40, bottom: 50, left: 40 },
            headerHeight: 25, // Space for file path header
            footerHeight: 25, // Space for page number footer
            tocTitle: "Table of Contents",
            codeFont: 'Courier', // Standard monospace PDF font
            textFont: 'Helvetica' // Standard sans-serif PDF font
        };

         // Validate font size
         if (isNaN(pdfOptions.fontSize) || pdfOptions.fontSize <= 0) {
            logger.error(`Invalid font size: ${options.fontSize}. Must be a positive number.`);
            process.exit(1);
        }


        // Run the main logic
        await run(resolvedRepoPath, pdfOptions);
    });

// Make sure to parse arguments
program.parse(process.argv);
