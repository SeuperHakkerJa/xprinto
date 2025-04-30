#!/usr/bin/env node

import { Command, OptionValues } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { run } from './main';
import { logger } from './utils/logger';
import { PdfOptions } from './utils/types';
import { themes } from './utils/themes'; // Import available themes for validation

/**
 * Reads the package version from package.json.
 * Handles potential errors during file reading.
 * @returns The package version string or a fallback.
 */
function getPackageVersion(): string {
    let packageVersion = '0.0.0'; // Default fallback version
    try {
        // Resolve path relative to the executing JS file (expected in dist/)
        const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
        if (fs.existsSync(packageJsonPath)) {
             const packageJson = fs.readJsonSync(packageJsonPath);
             packageVersion = packageJson.version || packageVersion;
        } else {
            // This might happen during development if 'dist' doesn't exist yet
            logger.debug(`package.json not found at expected path: ${packageJsonPath}`);
        }
    } catch (error) {
        // Log warning but don't crash if package.json is unreadable
        logger.warn(`Could not read package.json: ${(error as Error).message}`);
    }
    return packageVersion;
}

/**
 * Creates and configures the Commander program for the CLI, defining arguments and options.
 * @returns The configured Commander program instance.
 */
function setupCli(): Command {
    const program = new Command();
    const packageVersion = getPackageVersion();

    program
        .name('codepdf')
        .description('Convert code repositories or directories to beautiful PDFs with syntax highlighting.')
        .version(packageVersion)
        .argument('<repository-path>', 'Path to the code repository or directory to process')
        .option('-o, --output <path>', 'Output path for the generated PDF file.', 'code-output.pdf')
        .option('-t, --title <title>', 'Title for the PDF document cover page.', 'Code Repository Documentation')
        .option('-f, --font-size <size>', 'Font size (in points) for code blocks.', '9')
        .option('--theme <name>', `Syntax highlighting theme (available: ${Object.keys(themes).join(', ')}).`, 'light')
        // Default is true, --no-line-numbers flag makes it false via Commander's boolean handling
        .option('--line-numbers', 'Show line numbers in code blocks (default).', true)
        .option('--no-line-numbers', 'Hide line numbers in code blocks.')
        .option('--paper-size <size>', 'Paper size (A4, Letter, or width,height in points e.g., "595.28,841.89").', 'A4')
        .option('-v, --verbose', 'Enable verbose (debug) logging output.', false)
        .action(runCliAction); // Delegate the core logic to the action function

    return program;
}

/**
 * Validates parsed command-line options and constructs the PdfOptions object.
 * Logs errors and exits the process with code 1 if validation fails.
 * @param repoPathArg The repository path argument provided by the user.
 * @param options The parsed options object from Commander.
 * @returns A Promise resolving to an object containing the validated PdfOptions and the resolved repository path.
 */
async function validateAndPrepareOptions(repoPathArg: string, options: OptionValues): Promise<{ resolvedRepoPath: string; pdfOptions: PdfOptions }> {
    // Set logger verbosity based on the --verbose flag
    logger.setVerbose(options.verbose);

    // Resolve paths to absolute paths for consistency
    const resolvedRepoPath = path.resolve(process.cwd(), repoPathArg); // Resolve relative to current working directory
    const resolvedOutputPath = path.resolve(process.cwd(), options.output);

    logger.info(`Input path resolved to: ${resolvedRepoPath}`);
    logger.info(`Output path resolved to: ${resolvedOutputPath}`);

    // --- Validate Input Path ---
    try {
        const stats = await fs.stat(resolvedRepoPath);
        if (!stats.isDirectory()) {
            logger.error(`❌ Input path must be a directory: ${resolvedRepoPath}`);
            process.exit(1); // Exit on validation failure
        }
    } catch (error) {
        logger.error(`❌ Cannot access input path: ${resolvedRepoPath}`);
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
             logger.error("   Reason: Path does not exist.");
        } else {
             logger.error(`   Reason: ${(error as Error).message}`);
        }
        process.exit(1); // Exit on validation failure
    }

    // --- Validate Theme ---
    const themeName = options.theme.toLowerCase();
    if (!themes[themeName]) {
         logger.error(`❌ Invalid theme specified: "${options.theme}".`);
         logger.error(`   Available themes: ${Object.keys(themes).join(', ')}`);
         process.exit(1); // Exit on validation failure
    }

    // --- Parse and Validate Paper Size ---
    let paperSizeOption: PdfOptions['paperSize'];
    const paperSizeInput = options.paperSize;
    if (paperSizeInput.includes(',')) {
        const dims = paperSizeInput.split(',').map(Number);
        if (dims.length === 2 && !isNaN(dims[0]) && !isNaN(dims[1]) && dims[0] > 0 && dims[1] > 0) {
            paperSizeOption = [dims[0], dims[1]];
            logger.debug(`Using custom paper size: ${dims[0]}x${dims[1]} points.`);
        } else {
            logger.error(`❌ Invalid custom paper size format: "${paperSizeInput}". Use "width,height" in positive points (e.g., "595.28,841.89").`);
            process.exit(1); // Exit on validation failure
        }
    } else if (paperSizeInput.toUpperCase() === 'A4' || paperSizeInput.toUpperCase() === 'LETTER') {
        paperSizeOption = paperSizeInput.toUpperCase() as 'A4' | 'Letter';
        logger.debug(`Using standard paper size: ${paperSizeOption}`);
    } else {
        logger.error(`❌ Invalid paper size name: "${paperSizeInput}". Use "A4", "Letter", or "width,height".`);
        process.exit(1); // Exit on validation failure
    }

     // --- Parse and Validate Font Size ---
     const fontSize = parseInt(options.fontSize, 10);
     // Add reasonable bounds check for font size
     if (isNaN(fontSize) || fontSize <= 2 || fontSize > 72) {
        logger.error(`❌ Invalid font size: "${options.fontSize}". Must be a positive number (e.g., 8-14 recommended).`);
        process.exit(1); // Exit on validation failure
    }

    // --- Construct Final Options Object ---
    const pdfOptions: PdfOptions = {
        output: resolvedOutputPath,
        title: options.title,
        fontSize: fontSize,
        // Commander automatically handles boolean flags like --line-numbers / --no-line-numbers
        showLineNumbers: options.lineNumbers,
        theme: themeName,
        paperSize: paperSizeOption,
        // Define sensible defaults for layout - could be made configurable if needed
        margins: { top: 50, right: 40, bottom: 50, left: 40 },
        headerHeight: 25, // Space reserved for header (file path)
        footerHeight: 25, // Space reserved for footer (page number)
        tocTitle: "Table of Contents",
        codeFont: 'Courier', // Standard monospace PDF font (widely available)
        textFont: 'Helvetica' // Standard sans-serif PDF font (widely available)
    };

    // Return validated options and resolved path
    return { resolvedRepoPath, pdfOptions };
}


/**
 * The main action function executed by Commander when the CLI command is run.
 * It orchestrates option validation and calls the core application logic (`run`).
 * Handles top-level errors and sets the process exit code appropriately.
 * @param repoPathArg The repository path argument provided by the user.
 * @param options The parsed options object from Commander.
 */
async function runCliAction(repoPathArg: string, options: OptionValues): Promise<void> {
    try {
        // Validate inputs and prepare the options object needed by the core logic
        const { resolvedRepoPath, pdfOptions } = await validateAndPrepareOptions(repoPathArg, options);

        // Execute the main application logic from main.ts
        await run(resolvedRepoPath, pdfOptions);

        // If 'run' completes without throwing, log final success message
        logger.info("✅ Process completed successfully.");

    } catch (error) {
        // Catch errors propagated from 'run' or validation steps
        // Specific error messages should have already been logged by the logger
        logger.error("❌ Process failed due to an error.");
        // Ensure the node process exits with a non-zero code to indicate failure
        process.exitCode = 1;
    }
}

// --- Execute CLI ---
/**
 * Entry point check: Only run the CLI setup and parsing logic
 * if this script is the main module being executed (i.e., not imported elsewhere).
 */
if (require.main === module) {
    const cli = setupCli();
    cli.parse(process.argv); // Parse command-line arguments and execute action
} else {
    // This block usually won't run when executed as a CLI tool,
    // but useful if exporting setupCli for testing.
    logger.debug("CLI setup skipped (not main module).");
}
