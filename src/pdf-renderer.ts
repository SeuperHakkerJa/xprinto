import PDFDocument from 'pdfkit';
import fs from 'fs-extra';
import path from 'path';
import { HighlightedFile, HighlightedLine, HighlightedToken, PdfOptions, SyntaxTheme } from './utils/types';
import { logger } from './utils/logger';

// --- Constants ---
const POINTS_PER_INCH = 72;
/** Multiplier for calculating line height based on font size for code blocks. */
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.4;
/** Indentation (in points) for file names under directory names in the Table of Contents. */
const TOC_INDENT = 20;
/** Number of spaces used for indenting wrapped lines of code. */
const WRAP_INDENT_MULTIPLIER = 2;
/** Padding (in points) around the dot leader in the Table of Contents. */
const TOC_DOT_PADDING = 5;
/** Padding (in points) inside the code block container (around text, line numbers). */
const CODE_BLOCK_PADDING = 10;
/** Character(s) used to indicate a wrapped line in the line number gutter. */
const WRAP_INDICATOR = '->'; // Using simple ASCII

// --- Helper Functions ---

/**
 * Converts standard paper size names ('A4', 'Letter') or a [width, height] array
 * into PDF point dimensions [width, height]. Validates input and defaults to A4 on error.
 * @param size The paper size specified in PdfOptions.
 * @returns A tuple [width, height] in PDF points.
 */
function getPaperSizeInPoints(size: PdfOptions['paperSize']): [number, number] {
    if (Array.isArray(size)) {
        // Validate custom size array
        if (size.length === 2 && typeof size[0] === 'number' && typeof size[1] === 'number' && size[0] > 0 && size[1] > 0) {
            return size;
        } else {
            logger.warn(`Invalid custom paper size array: [${size.join(', ')}]. Falling back to A4.`);
            return [595.28, 841.89]; // Default to A4
        }
    }
    // Handle standard size names
    switch (size?.toUpperCase()) { // Add safe navigation for size
        case 'LETTER':
            return [8.5 * POINTS_PER_INCH, 11 * POINTS_PER_INCH];
        case 'A4':
            return [595.28, 841.89]; // A4 dimensions in points
        default:
            // Log warning and default to A4 if string is unrecognized or null/undefined
            logger.warn(`Unrecognized paper size string: "${size}". Falling back to A4.`);
            return [595.28, 841.89];
    }
}

/**
 * Calculates the available vertical space (in points) for content on a page,
 * excluding margins, header, and footer. Ensures result is non-negative.
 * @param doc The active PDFDocument instance.
 * @param options The PDF generation options.
 * @returns The calculated content height in points.
 */
function getContentHeight(doc: PDFKit.PDFDocument, options: PdfOptions): number {
    const pageHeight = doc.page.height; // Use current page height
    const calculatedHeight = pageHeight - options.margins.top - options.margins.bottom - options.headerHeight - options.footerHeight;
    return Math.max(0, calculatedHeight); // Ensure non-negative height
}

/**
 * Calculates the available horizontal space (in points) for content on a page,
 * excluding left and right margins. Ensures result is non-negative.
 * @param doc The active PDFDocument instance.
 * @param options The PDF generation options.
 * @returns The calculated content width in points.
 */
 function getContentWidth(doc: PDFKit.PDFDocument, options: PdfOptions): number {
    const pageWidth = doc.page.width; // Use current page width
    const calculatedWidth = pageWidth - options.margins.left - options.margins.right;
    return Math.max(0, calculatedWidth); // Ensure non-negative width
}


// --- PDF Rendering Sections ---

/**
 * Adds a cover page to the PDF document. Includes basic error handling.
 * @param doc The active PDFDocument instance.
 * @param options The PDF generation options.
 * @param repoName The name of the repository being processed, displayed on the cover.
 */
function addCoverPage(doc: PDFKit.PDFDocument, options: PdfOptions, repoName: string): void {
    try {
        doc.addPage({ margins: options.margins }); // Add page with specified margins
        const contentWidth = getContentWidth(doc, options);
        const pageHeight = doc.page.height;
        const topMargin = doc.page.margins.top;
        const bottomMargin = doc.page.margins.bottom;
        const availableHeight = pageHeight - topMargin - bottomMargin;

        // Position elements vertically relative to available height
        const titleY = topMargin + availableHeight * 0.2;
        const repoY = titleY + 50; // Adjust spacing as needed
        const dateY = repoY + 30;

        // Title
        doc.font(options.textFont + '-Bold')
           .fontSize(24)
           .text(options.title, doc.page.margins.left, titleY, {
                align: 'center',
                width: contentWidth
           });

        // Repository Name
        doc.font(options.textFont)
           .fontSize(16)
           .text(`Repository: ${repoName}`, doc.page.margins.left, repoY, {
                align: 'center',
                width: contentWidth
            });

        // Generation Date
        doc.font(options.textFont) // Reset font style
           .fontSize(12)
           .fillColor('#555555') // Use a less prominent color
           .text(`Generated: ${new Date().toLocaleString()}`, doc.page.margins.left, dateY, {
               align: 'center',
               width: contentWidth
            });
        // *** REMOVED problematic line: doc.fillColor(theme.defaultColor || '#000000'); ***

        logger.info('Added cover page.');
    } catch (error) {
        logger.error(`Failed to add cover page: ${(error as Error).message}`);
        // Decide if this error should halt the process or just be logged
    }
}

/**
 * Adds a Table of Contents (TOC) page(s) to the PDF document.
 * Groups files by directory, estimates page numbers, and renders the list with dot leaders.
 * Handles page breaks within the TOC itself.
 * @param doc The active PDFDocument instance.
 * @param files An array of `HighlightedFile` objects to include in the TOC.
 * @param options The PDF generation options.
 * @param theme The active syntax theme (used for text colors).
 * @param pageNumberOffset The logical page number where the first actual code file will start.
 * @returns A record mapping file relative paths to their estimated starting page number.
 */
function addTableOfContents(
    doc: PDFKit.PDFDocument,
    files: HighlightedFile[],
    options: PdfOptions,
    theme: SyntaxTheme,
    pageNumberOffset: number
): Record<string, number> {
    const pageEstimates: Record<string, number> = {}; // Stores relativePath -> estimated startPage

    try {
        doc.addPage(); // Add the first page for the TOC
        const contentWidth = getContentWidth(doc, options);
        const startY = doc.page.margins.top;
        doc.y = startY; // Set starting Y position

        // --- TOC Title ---
        doc.font(options.textFont + '-Bold')
           .fontSize(18)
           .fillColor(theme.defaultColor)
           .text(options.tocTitle, { align: 'center', width: contentWidth });
        doc.moveDown(2); // Space after title

        // --- Group Files by Directory ---
        const filesByDir: Record<string, HighlightedFile[]> = {};
        files.forEach(file => {
            const dir = path.dirname(file.relativePath);
            const dirKey = (dir === '.' || dir === '/') ? '/' : `/${dir.replace(/\\/g, '/')}`; // Normalize key
            if (!filesByDir[dirKey]) filesByDir[dirKey] = [];
            filesByDir[dirKey].push(file);
        });

        // --- Estimate Page Numbers ---
        let estimatedCurrentPage = pageNumberOffset;
        const codeLinesPerPage = Math.max(1, Math.floor(getContentHeight(doc, options) / (options.fontSize * DEFAULT_LINE_HEIGHT_MULTIPLIER)));

        const sortedDirs = Object.keys(filesByDir).sort(); // Sort directory keys alphabetically
        for (const dir of sortedDirs) {
            // Sort files within each directory alphabetically
            const sortedFiles = filesByDir[dir].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
            for (const file of sortedFiles) {
                pageEstimates[file.relativePath] = estimatedCurrentPage; // Store estimated start page
                const lineCount = file.highlightedLines.length;
                // Estimate pages needed for this file (minimum 1 page)
                const estimatedPagesForFile = Math.max(1, Math.ceil(lineCount / codeLinesPerPage));
                estimatedCurrentPage += estimatedPagesForFile; // Increment estimated page counter
            }
        }
        logger.debug(`Estimated total pages after code content: ${estimatedCurrentPage - 1}`);

        // --- Render TOC Entries ---
        doc.font(options.textFont).fontSize(12); // Set default font for TOC entries
        const tocLineHeight = doc.currentLineHeight() * 1.1; // Approximate line height for TOC entries
        const tocEndY = doc.page.height - doc.page.margins.bottom; // Bottom boundary for TOC content

        for (const dir of sortedDirs) {
            // Check for page break before rendering directory header (need space for header + one entry)
            if (doc.y > tocEndY - (tocLineHeight * 2)) {
                 doc.addPage();
                 doc.y = doc.page.margins.top; // Reset Y to top margin
            }

            // Render Directory Header (if not root)
            if (dir !== '/') {
                doc.moveDown(1); // Add space before directory header
                doc.font(options.textFont + '-Bold')
                   .fillColor(theme.defaultColor)
                   .text(dir, { continued: false }); // Render directory name
                doc.moveDown(0.5); // Space after directory header
            }

            // Render File Entries for this Directory
            const sortedFiles = filesByDir[dir].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
            for (const file of sortedFiles) {
                 // Check for page break before rendering file entry
                 if (doc.y > tocEndY - tocLineHeight) {
                     doc.addPage();
                     doc.y = doc.page.margins.top; // Reset Y to top margin
                 }

                const fileName = path.basename(file.relativePath);
                const pageNum = pageEstimates[file.relativePath]?.toString() || '?'; // Use estimated page
                const indent = (dir === '/') ? 0 : TOC_INDENT; // Indent if not in root directory
                const startX = doc.page.margins.left + indent;
                const availableWidth = contentWidth - indent;
                const currentY = doc.y; // Store Y position for precise placement on this line

                // Calculate positions for filename, dots, and page number
                doc.font(options.textFont).fontSize(12).fillColor(theme.defaultColor); // Ensure correct font for width calc
                const nameWidth = doc.widthOfString(fileName);
                const pageNumWidth = doc.widthOfString(pageNum);
                const fileNameEndX = startX + nameWidth;
                const pageNumStartX = doc.page.margins.left + contentWidth - pageNumWidth; // Position for right alignment

                // Render file name (ensure it doesn't wrap)
                doc.text(fileName, startX, currentY, {
                    width: nameWidth,
                    lineBreak: false,
                    continued: false // Stop after filename
                });

                // Render page number (explicitly positioned)
                doc.text(pageNum, pageNumStartX, currentY, {
                    width: pageNumWidth,
                    lineBreak: false,
                    continued: false // Stop after page number
                });

                // Render dot leader in the space between filename and page number
                const dotsStartX = fileNameEndX + TOC_DOT_PADDING;
                const dotsEndX = pageNumStartX - TOC_DOT_PADDING;
                const dotsAvailableWidth = dotsEndX - dotsStartX;

                if (dotsAvailableWidth > doc.widthOfString('. ')) { // Check if there's enough space for at least one dot sequence
                    const dot = '. ';
                    const dotWidth = doc.widthOfString(dot);
                    const numDots = Math.floor(dotsAvailableWidth / dotWidth);
                    const dotsString = dot.repeat(numDots);

                    doc.fillColor('#aaaaaa'); // Use a lighter color for dots
                    doc.text(dotsString, dotsStartX, currentY, {
                        width: dotsAvailableWidth, // Constrain dots width
                        lineBreak: false,
                        continued: false
                    });
                    doc.fillColor(theme.defaultColor); // Reset fill color
                }

                // Move down for the next TOC entry
                doc.moveDown(0.6); // Adjust spacing as needed
            } // End loop through files in directory
        } // End loop through directories

        logger.info('Added Table of Contents.');

    } catch (error) {
        logger.error(`Failed to add Table of Contents: ${(error as Error).message}`);
        // Continue PDF generation even if TOC fails?
    }

    return pageEstimates; // Return estimates (might be useful for debugging)
}

/**
 * Renders the header section for a code page. Includes basic error handling.
 * @param doc The active PDFDocument instance.
 * @param file The `HighlightedFile` being rendered.
 * @param options The PDF generation options.
 * @param theme The active syntax theme.
 */
function renderHeader(doc: PDFKit.PDFDocument, file: HighlightedFile, options: PdfOptions, theme: SyntaxTheme): void {
    try {
        const headerY = doc.page.margins.top; // Use actual top margin of the current page
        // Calculate Y position to vertically center typical 9pt text within the header height
        const headerContentY = headerY + (options.headerHeight - 9) / 2; // Adjust multiplier if needed
        const contentWidth = getContentWidth(doc, options);
        const startX = doc.page.margins.left;

        // Draw header background rectangle
        doc.rect(startX, headerY, contentWidth, options.headerHeight)
           .fillColor(theme.headerFooterBackground)
           .fill();

        // Draw file path (truncated with ellipsis if it exceeds available width)
        doc.font(options.textFont) // Use standard text font
           .fontSize(9) // Use a smaller font size for header/footer
           .fillColor(theme.headerFooterColor)
           .text(file.relativePath, startX + CODE_BLOCK_PADDING, headerContentY, {
               width: contentWidth - (CODE_BLOCK_PADDING * 2), // Constrain width by padding
               align: 'left',
               lineBreak: false, // Prevent wrapping
               ellipsis: true // Add '...' if path is too long
           });

        // Draw border line below the header area
        doc.moveTo(startX, headerY + options.headerHeight)
           .lineTo(startX + contentWidth, headerY + options.headerHeight)
           .lineWidth(0.5) // Use a thin line
           .strokeColor(theme.borderColor)
           .stroke();
        // Reset fill color after potential changes
        doc.fillColor(theme.defaultColor || '#000000');
    } catch (error) {
         logger.error(`Failed to render header for ${file.relativePath}: ${(error as Error).message}`);
    }
}

/**
 * Renders the footer section for a code page. Includes basic error handling.
 * @param doc The active PDFDocument instance.
 * @param currentPage The logical page number to display.
 * @param options The PDF generation options.
 * @param theme The active syntax theme.
 */
function renderFooter(doc: PDFKit.PDFDocument, currentPage: number, options: PdfOptions, theme: SyntaxTheme): void {
     try {
        // Calculate Y position for the top of the footer area
        const footerY = doc.page.height - doc.page.margins.bottom - options.footerHeight; // Use actual bottom margin
        // Calculate Y position to vertically center typical 9pt text
        const footerContentY = footerY + (options.footerHeight - 9) / 2;
        const contentWidth = getContentWidth(doc, options);
        const startX = doc.page.margins.left;

         // Draw border line above the footer area
         doc.moveTo(startX, footerY)
            .lineTo(startX + contentWidth, footerY)
            .lineWidth(0.5)
            .strokeColor(theme.borderColor)
            .stroke();

        // Draw page number centered in the footer
        doc.font(options.textFont)
           .fontSize(9) // Use smaller font size
           .fillColor(theme.headerFooterColor)
           .text(`Page ${currentPage}`, startX, footerContentY, {
               width: contentWidth,
               align: 'center'
           });
         // Reset fill color
         doc.fillColor(theme.defaultColor || '#000000');
    } catch (error) {
         logger.error(`Failed to render footer on page ${currentPage}: ${(error as Error).message}`);
    }
}

/**
 * Renders the highlighted code content for a single file onto the PDF document.
 * Handles page breaks, line numbers (if enabled), code wrapping, and applies theme styling.
 * Manages vertical positioning explicitly to avoid overlaps.
 *
 * @param doc The active PDFDocument instance.
 * @param file The `HighlightedFile` object containing the code and tokens.
 * @param options The PDF generation options.
 * @param theme The active syntax theme.
 * @param initialPageNumber The logical page number this file should start on (used for footer).
 * @returns The last logical page number used by this file.
 */
function renderCodeFile(
    doc: PDFKit.PDFDocument,
    file: HighlightedFile,
    options: PdfOptions,
    theme: SyntaxTheme,
    initialPageNumber: number
): number {

    let currentPage = initialPageNumber; // Tracks the logical page number for the footer
    const contentWidth = getContentWidth(doc, options);
    const contentHeight = getContentHeight(doc, options);
    const startY = options.margins.top + options.headerHeight; // Top of code content area
    const endY = doc.page.height - options.margins.bottom - options.footerHeight; // Bottom of code content area
    const startX = options.margins.left;
    const lineHeight = options.fontSize * DEFAULT_LINE_HEIGHT_MULTIPLIER; // Calculated line height

    // --- Calculate dimensions related to line numbers ---
    const maxLineNumDigits = String(file.highlightedLines.length).length;
    const lineNumberWidth = options.showLineNumbers
        ? Math.max(maxLineNumDigits * options.fontSize * 0.65 + CODE_BLOCK_PADDING, 35 + CODE_BLOCK_PADDING) // Ensure min width
        : 0; // No width if line numbers are disabled
    const lineNumberPaddingRight = 10; // Space between line number and start of code
    // Calculate starting X coordinate for the code text
    const codeStartX = startX + (options.showLineNumbers ? lineNumberWidth + lineNumberPaddingRight : CODE_BLOCK_PADDING);
    // Calculate the usable width for the code text (accounts for left/right padding)
    const codeWidth = contentWidth - (codeStartX - startX) - CODE_BLOCK_PADDING;
    // Indentation string and its width for wrapped lines
    const wrapIndent = ' '.repeat(WRAP_INDENT_MULTIPLIER);
    const wrapIndentWidth = doc.font(options.codeFont).fontSize(options.fontSize).widthOfString(wrapIndent);


    // --- Page Setup Helper ---
    /** Sets up the header, footer, and background visuals for a new code page. Returns the starting Y coordinate for content. */
    const setupPageVisuals = (): number => {
        try {
            renderHeader(doc, file, options, theme);
            renderFooter(doc, currentPage, options, theme); // Use the current logical page number
            const pageContentStartY = startY;
            doc.y = pageContentStartY; // Reset internal Y cursor (though we manage drawing Y manually)

            // Draw background container for the code block
            doc.rect(startX, pageContentStartY, contentWidth, contentHeight)
               .fillColor(theme.backgroundColor)
               .lineWidth(0.75)
               .strokeColor(theme.borderColor)
               .fillAndStroke(); // Fill and draw border

            // Draw line number gutter background and separator line if enabled
            if (options.showLineNumbers && lineNumberWidth > 0) {
                doc.rect(startX, pageContentStartY, lineNumberWidth, contentHeight)
                   .fillColor(theme.lineNumberBackground)
                   .fill(); // Fill gutter background
                // Draw vertical separator line
                doc.moveTo(startX + lineNumberWidth, pageContentStartY)
                   .lineTo(startX + lineNumberWidth, pageContentStartY + contentHeight)
                   .lineWidth(0.5)
                   .strokeColor(theme.borderColor)
                   .stroke();
            }
             // Return the Y position where actual text content should start (includes top padding)
             return pageContentStartY + CODE_BLOCK_PADDING / 2;
        } catch (setupError) {
            logger.error(`Error setting up page visuals for ${file.relativePath}: ${(setupError as Error).message}`);
            // Return startY as a fallback, though rendering might be broken
            return startY;
        }
    };

    // --- Initial Page Setup ---
    doc.addPage(); // Add the first page for this file
    let currentLineY = setupPageVisuals(); // Set up visuals and get starting Y


    // --- Main Rendering Loop (Iterate through source lines) ---
    for (const line of file.highlightedLines) {
        const lineStartY = currentLineY; // Store the Y position where this source line begins rendering

        // --- Page Break Check ---
        // Check if rendering this line (at minimum height) would exceed the available content area
        if (lineStartY + lineHeight > endY - CODE_BLOCK_PADDING) {
             doc.addPage(); // Add a new page
             currentPage++; // Increment the logical page number
             currentLineY = setupPageVisuals(); // Set up visuals and get new starting Y
        }

        // --- Draw Line Number ---
        if (options.showLineNumbers && lineNumberWidth > 0) {
            try {
                // Determine a visible color for the line number, fallback to gray
                const lnColor = (theme.lineNumberColor && theme.lineNumberColor !== theme.lineNumberBackground)
                                ? theme.lineNumberColor
                                : '#888888';
                const numStr = String(line.lineNumber).padStart(maxLineNumDigits, ' '); // Format number string
                const numX = startX + CODE_BLOCK_PADDING / 2; // X position within padding
                const numWidth = lineNumberWidth - CODE_BLOCK_PADDING; // Available width in gutter

                doc.font(options.codeFont) // Ensure correct font
                   .fontSize(options.fontSize)
                   .fillColor(lnColor)
                   .text(numStr, numX, currentLineY, { // Draw at current line's Y
                       width: numWidth,
                       align: 'right', // Align number to the right of the gutter
                       lineBreak: false // Prevent number from wrapping
                   });
            } catch (lnError) {
                 logger.warn(`Error drawing line number ${line.lineNumber} for ${file.relativePath}: ${(lnError as Error).message}`);
            }
        }

        // --- Render Code Tokens (Handles Wrapping Internally) ---
        let currentX = codeStartX; // Reset X position for the start of code content for this line
        let isFirstTokenOfLine = true; // Reset wrap flag for each new source line

        /** Helper function to advance Y position and handle page breaks during line wrapping. */
        const moveToNextWrapLine = () => {
            currentLineY += lineHeight; // Advance our managed Y position
            // Check if the *new* position requires a page break
            if (currentLineY + lineHeight > endY - CODE_BLOCK_PADDING) {
                doc.addPage();
                currentPage++;
                currentLineY = setupPageVisuals(); // Setup new page, get new starting Y
            }
            // Set X for the wrapped line, applying indentation
            currentX = codeStartX + wrapIndentWidth;
            // Draw wrap indicator in the line number gutter
            if (options.showLineNumbers && lineNumberWidth > 0) {
                try {
                    const wrapColor = (theme.lineNumberColor && theme.lineNumberColor !== theme.lineNumberBackground)
                                    ? theme.lineNumberColor
                                    : '#888888';
                    doc.font(options.codeFont).fontSize(options.fontSize).fillColor(wrapColor)
                       .text(WRAP_INDICATOR, startX + CODE_BLOCK_PADDING / 2, currentLineY, { // Draw at the new Y
                           width: lineNumberWidth - CODE_BLOCK_PADDING,
                           align: 'right',
                           lineBreak: false
                       });
                } catch (wrapIndicatorError) {
                     logger.warn(`Error drawing wrap indicator for ${file.relativePath}: ${(wrapIndicatorError as Error).message}`);
                }
            }
        };

        // --- Token Loop (Iterate through tokens of the current source line) ---
        for (const token of line.tokens) {
            try {
                // Set font and color for the current token
                doc.font(options.codeFont + (token.fontStyle === 'bold' ? '-Bold' : token.fontStyle === 'italic' ? '-Oblique' : ''))
                   .fontSize(options.fontSize)
                   .fillColor(token.color || theme.defaultColor);

                const tokenText = token.text;
                // Skip empty tokens
                if (!tokenText || tokenText.length === 0) {
                    continue;
                }
                const tokenWidth = doc.widthOfString(tokenText);

                // --- Wrapping Logic ---
                if (currentX + tokenWidth <= codeStartX + codeWidth) {
                    // Token fits: Draw it and advance X
                    doc.text(tokenText, currentX, currentLineY, { continued: true, lineBreak: false });
                    currentX += tokenWidth;
                } else {
                    // Token needs wrapping: Process it segment by segment
                    let remainingText = tokenText;

                    // Move to the next line in the PDF before drawing the wrapped part,
                    // but only if necessary (first token overflow or subsequent tokens).
                    if (isFirstTokenOfLine && currentX === codeStartX) {
                         moveToNextWrapLine(); // First token overflows immediately
                    } else if (!isFirstTokenOfLine) {
                         // Subsequent token overflows
                         moveToNextWrapLine();
                    }
                    // If first token partially fit, loop handles moves.

                    // Loop to draw segments of the remaining text
                    while (remainingText.length > 0) {
                        let fitsChars = 0;
                        let currentSegmentWidth = 0;
                        const availableWidth = (codeStartX + codeWidth) - currentX; // Width available

                        // Determine how many characters fit
                        for (let i = 1; i <= remainingText.length; i++) {
                            const segment = remainingText.substring(0, i);
                            const width = doc.widthOfString(segment);
                            if (width <= availableWidth + 0.001) { // Tolerance
                                fitsChars = i;
                                currentSegmentWidth = width;
                            } else {
                                break;
                            }
                        }

                        // Handle cases where not even one character fits
                        if (fitsChars === 0 && remainingText.length > 0) {
                            if (availableWidth <= 0) {
                                // No space left, definitely move to next line and retry fitting
                                moveToNextWrapLine();
                                continue; // Re-evaluate fitting in the next iteration
                            } else {
                                // Force at least one character if space was available
                                fitsChars = 1;
                                currentSegmentWidth = doc.widthOfString(remainingText[0]);
                                logger.warn(`Forcing character fit '${remainingText[0]}' on wrapped line ${line.lineNumber} of ${file.relativePath}.`);
                            }
                        }

                        // Draw the segment that fits
                        const textToDraw = remainingText.substring(0, fitsChars);
                        doc.font(options.codeFont + (token.fontStyle === 'bold' ? '-Bold' : token.fontStyle === 'italic' ? '-Oblique' : ''))
                           .fontSize(options.fontSize)
                           .fillColor(token.color || theme.defaultColor);
                        doc.text(textToDraw, currentX, currentLineY, { continued: true, lineBreak: false });

                        // Update state for the next segment/token
                        currentX += currentSegmentWidth;
                        remainingText = remainingText.substring(fitsChars);

                        // If there's still remaining text in this token, move to the next line
                        if (remainingText.length > 0) {
                            moveToNextWrapLine();
                        }
                    } // End while(remainingText)
                } // End else (wrapping needed)
            } catch (tokenError) {
                 logger.warn(`Error rendering token "${token.text.substring(0, 20)}..." on line ${line.lineNumber} of ${file.relativePath}: ${(tokenError as Error).message}`);
                 // Continue to next token
            } finally {
                 isFirstTokenOfLine = false; // Mark that we are past the first token for this source line
            }
        } // End for loop (tokens)

        // --- Advance Y for Next Source Line ---
        // After processing all tokens for the original source line, move our managed Y position down.
        currentLineY += lineHeight;

    } // End for loop (lines)

    logger.info(`Rendered file ${file.relativePath} spanning pages ${initialPageNumber}-${currentPage}.`);
    return currentPage; // Return the last logical page number used by this file
}


// --- Main PDF Generation Function ---

/**
 * Orchestrates the entire PDF generation process:
 * Finds files, highlights code, sets up the PDF document, adds cover page,
 * adds table of contents (if applicable), renders each file's code, and saves the PDF.
 * Includes error handling for stream operations.
 *
 * @param files An array of `HighlightedFile` objects already processed by the syntax highlighter.
 * @param options The `PdfOptions` controlling the generation process.
 * @param theme The active `SyntaxTheme` object.
 * @param repoName The name of the repository, used for the cover page.
 * @returns A Promise that resolves when the PDF has been successfully written, or rejects on error.
 * @throws Propagates errors from critical stages like stream writing or PDF finalization.
 */
export async function generatePdf(
    files: HighlightedFile[],
    options: PdfOptions,
    theme: SyntaxTheme,
    repoName: string
): Promise<void> {
    logger.info(`Starting PDF generation for ${files.length} files.`);
    const startTime = Date.now();

    let doc: PDFKit.PDFDocument | null = null;
    let writeStream: fs.WriteStream | null = null;

    // Promise wrapper to handle stream events correctly
    return new Promise(async (resolve, reject) => {
        try {
            // Initialize PDF document
            doc = new PDFDocument({
                size: getPaperSizeInPoints(options.paperSize),
                margins: options.margins,
                autoFirstPage: false,
                bufferPages: true, // Enable buffering for potential page counting/manipulation
                info: { // PDF metadata
                    Title: options.title,
                    Author: 'codepdf', // Consider making this configurable
                    Creator: 'codepdf',
                    CreationDate: new Date(),
                }
            });

            // Setup file stream and pipe PDF output to it
            const outputDir = path.dirname(options.output);
            await fs.ensureDir(outputDir); // Ensure output directory exists
            writeStream = fs.createWriteStream(options.output);
            doc.pipe(writeStream);

            // --- Register Stream Event Handlers ---
            // Handle successful completion
            writeStream.on('finish', () => {
                const endTime = Date.now();
                logger.success(`PDF generated successfully: ${options.output}`);
                logger.info(`Total generation time: ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
                resolve(); // Resolve the main promise on successful finish
            });

            // Handle errors during writing
            writeStream.on('error', (err) => {
                logger.error(`WriteStream error for ${options.output}: ${err.message}`);
                reject(err); // Reject the main promise on stream error
            });

            // Handle potential errors from the PDFDocument itself
            doc.on('error', (err) => {
                logger.error(`PDFDocument error: ${err.message}`);
                reject(err); // Reject the main promise on document error
            });

            // --- Add PDF Content ---
            let physicalPageCount = 0; // Track actual pages added to the document

            // 1. Cover Page
            addCoverPage(doc, options, repoName);
            physicalPageCount = doc.bufferedPageRange().count;

            // 2. Table of Contents
            let tocPages = 0;
            let fileStartLogicalPageNumber = physicalPageCount + 1; // Logical page files start on

            if (files.length > 1) {
                const tocStartPhysicalPage = physicalPageCount + 1;
                addTableOfContents(doc, files, options, theme, fileStartLogicalPageNumber);
                const tocEndPhysicalPage = doc.bufferedPageRange().count;
                tocPages = tocEndPhysicalPage - physicalPageCount;
                physicalPageCount = tocEndPhysicalPage;
                fileStartLogicalPageNumber = physicalPageCount + 1; // Update logical start page after TOC
                logger.info(`Table of Contents added (${tocPages} page(s)). Files will start on logical page ${fileStartLogicalPageNumber}. Current physical page count: ${physicalPageCount}`);
            } else {
                 logger.info('Skipping Table of Contents (single file).');
            }

            // 3. Render Code Files
            let lastLogicalPageNumber = physicalPageCount; // Initialize with page count after cover/TOC

            const sortedFiles = files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

            for (const file of sortedFiles) {
                const currentFileStartLogicalPage = lastLogicalPageNumber + 1;
                logger.debug(`Rendering file: ${file.relativePath}, starting on logical page ${currentFileStartLogicalPage}`);
                // renderCodeFile handles adding pages internally and returns the last logical page number used
                lastLogicalPageNumber = renderCodeFile(doc, file, options, theme, currentFileStartLogicalPage);
            }

            // --- Finalize PDF ---
            logger.info("Finalizing PDF document...");
            // This triggers the 'finish' event on the writeStream eventually
            doc.end();

        } catch (error) {
             // Catch synchronous errors during setup or file processing loops
             logger.error(`Failed during PDF generation setup or rendering loop: ${(error as Error).message}`);
             // Ensure stream is closed if open, though pdfkit might handle this on error
             if (writeStream && !writeStream.closed) {
                 writeStream.close();
             }
             reject(error); // Reject the main promise
        }
    }); // End Promise wrapper
}
