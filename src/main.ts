import path from 'path';
import { findCodeFiles } from './file-finder';
import { highlightCode } from './syntax-highlighter';
import { generatePdf } from './pdf-renderer';
import { PdfOptions, HighlightedFile, FileInfo } from './utils/types';
import { getTheme } from './utils/themes';
import { logger } from './utils/logger';

/**
 * Main orchestration function for the codepdf tool.
 * Takes the repository path and PDF options, finds files, highlights them,
 * and generates the final PDF document. Handles top-level errors.
 *
 * @param repoPath Absolute path to the repository/directory to process.
 * @param options PDF generation options derived from CLI arguments.
 * @returns A Promise that resolves when the process is complete or rejects on critical error.
 * @throws Propagates errors from file finding or PDF generation stages if they are not handled internally.
 */
// *** Added 'export' keyword here ***
export async function run(repoPath: string, options: PdfOptions): Promise<void> {
    logger.info(`Starting processing for repository: ${repoPath}`);
    logger.info(`Output PDF will be saved to: ${options.output}`);
    logger.info(`Using Theme: ${options.theme}, Font Size: ${options.fontSize}pt, Line Numbers: ${options.showLineNumbers}`);

    try {
        // --- Step 1: Find relevant code files ---
        logger.info("Scanning for code files...");
        const filesToProcess: FileInfo[] = await findCodeFiles(repoPath);

        // If no files are found, log a warning and exit gracefully.
        if (filesToProcess.length === 0) {
            logger.warn("No relevant code files found in the specified path. Nothing to generate.");
            return; // Exit the function successfully, nothing more to do.
        }
        logger.info(`Found ${filesToProcess.length} files to process.`);

        // --- Step 2: Load the selected syntax theme ---
        const theme = getTheme(options.theme);
        logger.info(`Using theme: ${options.theme}`); // Log the name provided by the user

        // --- Step 3: Apply syntax highlighting ---
        logger.info("Applying syntax highlighting to files...");
        const highlightStartTime = Date.now();

        // Process highlighting for each file, handling individual file errors
        const highlightedFiles: HighlightedFile[] = filesToProcess.map(fileInfo => {
            try {
                 // Attempt to highlight the code for the current file
                 return highlightCode(fileInfo, theme);
            } catch (highlightError) {
                // Catch and log errors during highlighting of a single file
                logger.error(`Failed to highlight ${fileInfo.relativePath}: ${(highlightError as Error).message}`);
                // Return a fallback structure for this file to prevent crashing PDF generation
                // The content will appear unhighlighted in the PDF.
                 return {
                     ...fileInfo,
                     language: 'plaintext', // Mark as plaintext due to error
                     highlightedLines: fileInfo.content.split(/\r?\n/).map((line, index) => ({
                         lineNumber: index + 1,
                         tokens: [{ text: line, color: theme.defaultColor, fontStyle: 'normal' }],
                     })),
                 };
            }
        });
        const highlightEndTime = Date.now();
        logger.info(`Syntax highlighting complete (${((highlightEndTime - highlightStartTime) / 1000).toFixed(2)}s).`);


        // --- Step 4: Generate the PDF document ---
        logger.info("Generating PDF document...");
        const repoName = path.basename(repoPath); // Use directory name for cover page context
        // generatePdf handles its own success/error logging for the final PDF generation step
        await generatePdf(highlightedFiles, options, theme, repoName);

    } catch (error) {
        // Catch critical errors (e.g., from file finding, PDF stream setup)
        logger.error(`❌ An unexpected critical error occurred during the process:`);
        logger.error((error as Error).message);
        // Log the stack trace if verbose mode is enabled for detailed debugging
        if (logger.isVerbose()) {
             console.error("Stack Trace:");
             console.error((error as Error).stack);
        }
        // Re-throw the error so the calling context (CLI) knows about the failure
        // and can set the appropriate exit code.
        throw error;
    }
}
