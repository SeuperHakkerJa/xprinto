import path from 'path';
import { findCodeFiles } from './file-finder';
import { highlightCode } from './syntax-highlighter';
import { generatePdf } from './pdf-renderer';
import { PdfOptions, HighlightedFile } from './utils/types';
import { getTheme } from './utils/themes';
import { logger } from './utils/logger';

/**
 * Main orchestration function for the xprinto tool.
 *
 * @param repoPath Absolute path to the repository/directory.
 * @param options PDF generation options from the CLI.
 */
export async function run(repoPath: string, options: PdfOptions): Promise<void> {
    try {
        logger.info(`Processing repository: ${repoPath}`);
        logger.info(`Output PDF: ${options.output}`);
        logger.info(`Theme: ${options.theme}, Font Size: ${options.fontSize}, Line Numbers: ${options.showLineNumbers}`);

        // 1. Find relevant code files
        const filesToProcess = await findCodeFiles(repoPath);

        if (filesToProcess.length === 0) {
            logger.warn("No relevant code files found to process in the specified path.");
            return;
        }

        // 2. Load the selected theme
        const theme = getTheme(options.theme);
        logger.info(`Using theme: ${options.theme}`);

        // 3. Highlight code for each file
        logger.info("Applying syntax highlighting...");
        const highlightedFiles: HighlightedFile[] = filesToProcess.map(fileInfo => {
            return highlightCode(fileInfo, theme);
        });
        logger.info("Syntax highlighting complete.");


        // 4. Generate the PDF
        logger.info("Generating PDF document...");
        const repoName = path.basename(repoPath); // Use directory name for cover page
        await generatePdf(highlightedFiles, options, theme, repoName);

    } catch (error) {
        logger.error(`An unexpected error occurred: ${(error as Error).message}`);
        // Log stack trace in verbose mode
        if (process.env.XP_VERBOSE === 'true') { // Check env var set by CLI perhaps
             console.error((error as Error).stack);
        }
        // Ensure the process exits with an error code if run from CLI
        process.exitCode = 1;
    }
}
