import PDFDocument from 'pdfkit';
import fs from 'fs-extra';
import path from 'path';
import { HighlightedFile, HighlightedLine, HighlightedToken, PdfOptions, SyntaxTheme } from './utils/types';
import { logger } from './utils/logger';

// --- Constants ---
const POINTS_PER_INCH = 72;
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.4; // Adjust for code readability
const TOC_INDENT = 20; // Points to indent file names under directories in TOC
const WRAP_INDENT_MULTIPLIER = 2; // How many characters to indent wrapped lines
const TOC_DOT_PADDING = 5; // Points padding around dots
const CODE_BLOCK_PADDING = 10; // Padding inside the code block container

// --- Helper Functions ---

/**
 * Converts paper size name to points array or returns the array.
 */
function getPaperSizeInPoints(size: PdfOptions['paperSize']): [number, number] {
    if (Array.isArray(size)) {
        return size;
    }
    switch (size.toUpperCase()) {
        case 'LETTER':
            return [8.5 * POINTS_PER_INCH, 11 * POINTS_PER_INCH];
        case 'A4':
        default:
            return [595.28, 841.89]; // A4 dimensions in points
    }
}

/**
 * Calculates the available content height on a page.
 */
function getContentHeight(doc: PDFKit.PDFDocument, options: PdfOptions): number {
    const pageHeight = doc.page.height;
    return pageHeight - options.margins.top - options.margins.bottom - options.headerHeight - options.footerHeight;
}

/**
 * Calculates the available content width on a page.
 */
 function getContentWidth(doc: PDFKit.PDFDocument, options: PdfOptions): number {
    const pageWidth = doc.page.width;
    return pageWidth - options.margins.left - options.margins.right;
}


// --- PDF Rendering Sections ---

/**
 * Adds a cover page to the PDF document.
 */
function addCoverPage(doc: PDFKit.PDFDocument, options: PdfOptions, repoName: string): void {
    // Ensure we always add a page, even if it's the very first one
    doc.addPage();
    const contentWidth = getContentWidth(doc, options);
    const contentHeight = getContentHeight(doc, options); // Use full page height for cover
    const centerX = doc.page.margins.left + contentWidth / 2;

    // Title
    doc.font(options.textFont + '-Bold')
       .fontSize(24)
       .text(options.title, doc.page.margins.left, doc.page.margins.top + contentHeight * 0.2, { align: 'center', width: contentWidth });

    doc.moveDown(2);

    // Repository Name
    doc.font(options.textFont)
       .fontSize(16)
       .text(`Repository: ${repoName}`, { align: 'center', width: contentWidth });

    doc.moveDown(1);

    // Generation Date
    doc.fontSize(12)
       .fillColor('#555555') // Use a less prominent color
       .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center', width: contentWidth });

    logger.info('Added cover page.');
}

/**
 * Adds a Table of Contents page.
 */
function addTableOfContents(
    doc: PDFKit.PDFDocument,
    files: HighlightedFile[],
    options: PdfOptions,
    theme: SyntaxTheme,
    pageNumberOffset: number // Starting page number for files (after cover/TOC)
): Record<string, number> { // Returns map of relativePath to starting page number

    // Ensure we always add a page for the TOC
    doc.addPage();
    const contentWidth = getContentWidth(doc, options);
    const startY = doc.page.margins.top;
    doc.y = startY;

    // TOC Title
    doc.font(options.textFont + '-Bold')
       .fontSize(18)
       .fillColor(theme.defaultColor) // Use theme default color
       .text(options.tocTitle, { align: 'center', width: contentWidth });

    doc.moveDown(2);

    // Group files by directory
    const filesByDir: Record<string, HighlightedFile[]> = {};
    files.forEach(file => {
        const dir = path.dirname(file.relativePath);
        const dirKey = (dir === '.' || dir === '/') ? '/' : `/${dir.replace(/\\/g, '/')}`;
        if (!filesByDir[dirKey]) filesByDir[dirKey] = [];
        filesByDir[dirKey].push(file);
    });

    // Estimate page numbers BEFORE drawing TOC
    const pageEstimates: Record<string, number> = {}; // relativePath -> startPage
    let estimatedCurrentPage = pageNumberOffset;
    // Recalculate linesPerPage based on the current document's font size for TOC
    const tocLineHeight = 12 * 1.2; // Estimate TOC line height
    const tocLinesPerPage = Math.floor(getContentHeight(doc, options) / tocLineHeight);
    // Estimate pages needed for code files
    const codeLinesPerPage = Math.floor(getContentHeight(doc, options) / (options.fontSize * DEFAULT_LINE_HEIGHT_MULTIPLIER));


    const sortedDirs = Object.keys(filesByDir).sort();
    for (const dir of sortedDirs) {
        const sortedFiles = filesByDir[dir].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        for (const file of sortedFiles) {
            pageEstimates[file.relativePath] = estimatedCurrentPage;
            const lineCount = file.highlightedLines.length;
            const estimatedPagesForFile = Math.max(1, Math.ceil(lineCount / codeLinesPerPage));
            estimatedCurrentPage += estimatedPagesForFile;
        }
    }
    logger.debug(`Estimated total pages (including cover/TOC): ${estimatedCurrentPage -1}`);


    // Render TOC using estimated page numbers
    doc.font(options.textFont).fontSize(12);
    const tocStartY = doc.y;
    const tocEndY = doc.page.height - options.margins.bottom;

    for (const dir of sortedDirs) {
        // Check if space is running out for directory header AND at least one file entry
        if (doc.y > tocEndY - (tocLineHeight * 2)) {
             doc.addPage();
             doc.y = doc.page.margins.top; // Reset Y to top margin
             // Re-render TOC title maybe? Or just continue entries. For now, continue.
        }

        // Directory Header
        if (dir !== '/') {
            doc.moveDown(1);
            doc.font(options.textFont + '-Bold')
               .fillColor(theme.defaultColor) // Use theme default color
               .text(dir, { continued: false });
            doc.moveDown(0.5);
        }

        // Files in Directory
        const sortedFiles = filesByDir[dir].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        for (const file of sortedFiles) {
             // Check for page break before file entry
             if (doc.y > tocEndY - tocLineHeight) {
                 doc.addPage();
                 doc.y = doc.page.margins.top; // Reset Y to top margin
             }

            const fileName = path.basename(file.relativePath);
            const pageNum = pageEstimates[file.relativePath]?.toString() || '?';
            const indent = (dir === '/') ? 0 : TOC_INDENT;
            const startX = doc.page.margins.left + indent;
            const availableWidth = contentWidth - indent;
            const currentY = doc.y;

            // --- Calculate positions ---
            doc.font(options.textFont).fontSize(12).fillColor(theme.defaultColor);
            const nameWidth = doc.widthOfString(fileName);
            const pageNumWidth = doc.widthOfString(pageNum);

            const fileNameEndX = startX + nameWidth;
            const pageNumStartX = doc.page.margins.left + contentWidth - pageNumWidth; // Right align page number

            // --- Render file name ---
            doc.text(fileName, startX, currentY, {
                width: nameWidth, // Use measured width to prevent unwanted wrapping
                lineBreak: false,
                continued: false // Important: Don't continue after filename
            });

            // --- Render page number ---
            // Explicitly set the position for the page number
            doc.text(pageNum, pageNumStartX, currentY, {
                width: pageNumWidth,
                lineBreak: false,
                continued: false // Important: Don't continue after page number
            });

            // --- Render dots (if space allows) ---
            const dotsStartX = fileNameEndX + TOC_DOT_PADDING;
            const dotsEndX = pageNumStartX - TOC_DOT_PADDING;
            const dotsAvailableWidth = dotsEndX - dotsStartX;

            if (dotsAvailableWidth > doc.widthOfString('. ')) {
                const dot = '. ';
                const dotWidth = doc.widthOfString(dot);
                const numDots = Math.floor(dotsAvailableWidth / dotWidth);
                const dotsString = dot.repeat(numDots);

                doc.fillColor('#aaaaaa'); // Lighter color for dots
                // Draw dots at the correct Y position, between filename and page number
                doc.text(dotsString, dotsStartX, currentY, {
                    width: dotsAvailableWidth, // Use calculated width
                    lineBreak: false,
                    continued: false // Ensure this doesn't interfere
                });
            }

            // Move down AFTER rendering all parts of the line
            doc.moveDown(0.6);
        }
    }

    logger.info('Added Table of Contents.');
    return pageEstimates;
}

/**
 * Renders the header for a code page.
 */
function renderHeader(doc: PDFKit.PDFDocument, file: HighlightedFile, options: PdfOptions, theme: SyntaxTheme): void {
    const headerY = options.margins.top;
    const headerContentY = headerY + (options.headerHeight - 9) / 2; // Vertically center ~9pt text
    const contentWidth = getContentWidth(doc, options);
    const startX = options.margins.left;

    // Background
    doc.rect(startX, headerY, contentWidth, options.headerHeight)
       .fillColor(theme.headerFooterBackground)
       .fill();

    // File Path (truncated if too long)
    doc.font(options.textFont)
       .fontSize(9)
       .fillColor(theme.headerFooterColor)
       .text(file.relativePath, startX + CODE_BLOCK_PADDING, headerContentY, { // Use padding
           width: contentWidth - (CODE_BLOCK_PADDING * 2), // Adjust width for padding
           align: 'left',
           lineBreak: false,
           ellipsis: true
       });

    // Border line below header
    doc.moveTo(startX, headerY + options.headerHeight)
       .lineTo(startX + contentWidth, headerY + options.headerHeight)
       .lineWidth(0.5)
       .strokeColor(theme.borderColor)
       .stroke();
}

/**
 * Renders the footer for a code page.
 */
function renderFooter(doc: PDFKit.PDFDocument, currentPage: number, options: PdfOptions, theme: SyntaxTheme): void {
    const footerY = doc.page.height - options.margins.bottom - options.footerHeight;
    const footerContentY = footerY + (options.footerHeight - 9) / 2; // Vertically center ~9pt text
    const contentWidth = getContentWidth(doc, options);
    const startX = options.margins.left;

     // Border line above footer
     doc.moveTo(startX, footerY)
        .lineTo(startX + contentWidth, footerY)
        .lineWidth(0.5)
        .strokeColor(theme.borderColor)
        .stroke();

    // Page Number
    doc.font(options.textFont)
       .fontSize(9)
       .fillColor(theme.headerFooterColor)
       .text(`Page ${currentPage}`, startX, footerContentY, { // Use calculated Y
           width: contentWidth,
           align: 'center'
       });
}

/**
 * Renders the highlighted code for a file, handling line numbers, wrapping, and page breaks.
 */
function renderCodeFile(
    doc: PDFKit.PDFDocument,
    file: HighlightedFile,
    options: PdfOptions,
    theme: SyntaxTheme,
    initialPageNumber: number // This is the LOGICAL page number this file starts on
): number { // Returns the last PHYSICAL page number used by this file

    let currentPage = initialPageNumber; // Track the logical page number for the footer
    const contentWidth = getContentWidth(doc, options);
    const contentHeight = getContentHeight(doc, options);
    const startY = options.margins.top + options.headerHeight;
    const endY = doc.page.height - options.margins.bottom - options.footerHeight;
    const startX = options.margins.left;
    const lineHeight = options.fontSize * DEFAULT_LINE_HEIGHT_MULTIPLIER;

    // Calculate line number column width
    const maxLineNumDigits = String(file.highlightedLines.length).length;
    // Ensure minimum width for line numbers, add padding
    const lineNumberWidth = options.showLineNumbers ? Math.max(maxLineNumDigits * options.fontSize * 0.65 + CODE_BLOCK_PADDING, 35 + CODE_BLOCK_PADDING) : 0;
    const lineNumberPaddingRight = 10; // Space between line number and code
    // Adjust codeStartX based on whether line numbers are shown
    const codeStartX = startX + (options.showLineNumbers ? lineNumberWidth + lineNumberPaddingRight : CODE_BLOCK_PADDING);
    const codeWidth = contentWidth - (codeStartX - startX) - CODE_BLOCK_PADDING; // Subtract right padding
    const wrapIndent = ' '.repeat(WRAP_INDENT_MULTIPLIER);
    const wrapIndentWidth = doc.font(options.codeFont).fontSize(options.fontSize).widthOfString(wrapIndent);

    // --- Page Setup Function ---
    // This function now focuses ONLY on setting up the visual elements of a page
    const setupPageVisuals = () => {
        renderHeader(doc, file, options, theme);
        renderFooter(doc, currentPage, options, theme); // Use the current logical page number
        doc.y = startY; // Reset Y position to top of content area

        // --- Draw Code Block Container ---
        doc.rect(startX, startY, contentWidth, contentHeight)
           .fillColor(theme.backgroundColor)
           .lineWidth(0.75)
           .strokeColor(theme.borderColor)
           .fillAndStroke();

        // Draw line number background and separator if shown
        if (options.showLineNumbers) {
            doc.rect(startX, startY, lineNumberWidth, contentHeight)
               .fillColor(theme.lineNumberBackground)
               .fill();
             doc.moveTo(startX + lineNumberWidth, startY)
                .lineTo(startX + lineNumberWidth, startY + contentHeight)
                .lineWidth(0.5)
                .strokeColor(theme.borderColor)
                .stroke();
        }
         // Add initial top padding
         doc.y += CODE_BLOCK_PADDING / 2;
    };

    // --- Initial Page Setup ---
    // Add the first page for this file explicitly
    doc.addPage();
    setupPageVisuals(); // Set up the visuals for the first page

    // --- Render Loop ---
    for (const line of file.highlightedLines) {

        // Check if we need a new page BEFORE rendering the line
        // Compare current Y against the bottom edge minus padding
        if (doc.y + lineHeight > endY - CODE_BLOCK_PADDING) {
             doc.addPage();
             currentPage++; // Increment the logical page number for the footer
             setupPageVisuals(); // Set up visuals for the new page
        }

        const currentLineY = doc.y; // Store Y position for the line

        // 1. Draw Line Number (if enabled)
        if (options.showLineNumbers) {
            // Ensure font is set before drawing text
            doc.font(options.codeFont)
               .fontSize(options.fontSize)
               .fillColor(theme.lineNumberColor)
               .text(
                   String(line.lineNumber).padStart(maxLineNumDigits, ' '),
                   startX + CODE_BLOCK_PADDING / 2, // Start drawing within padding
                   currentLineY,
                   {
                       width: lineNumberWidth - CODE_BLOCK_PADDING, // Constrain width to padded area
                       align: 'right', // Right-align within the column
                       lineBreak: false
                   }
               );
        }

        // 2. Render Code Tokens (handling wrapping)
        let currentX = codeStartX; // Start code after line numbers/padding
        let isFirstTokenOfLine = true; // Flag for wrapping logic

        // Helper function to handle moving to the next line during wrapping
        const moveToNextWrapLine = () => {
            doc.y += lineHeight; // Move Y down
            // Check for page break *after* moving Y, before drawing next segment
            if (doc.y + lineHeight > endY - CODE_BLOCK_PADDING) {
                doc.addPage();
                currentPage++; // Increment logical page number
                setupPageVisuals(); // Setup visuals for new page
            }
            currentX = codeStartX + wrapIndentWidth; // Apply wrap indent for the new line
            // Draw wrap indicator if line numbers are shown
            if (options.showLineNumbers) {
                doc.font(options.codeFont).fontSize(options.fontSize).fillColor(theme.lineNumberColor)
                   .text('↪', startX + CODE_BLOCK_PADDING / 2, doc.y, { width: lineNumberWidth - CODE_BLOCK_PADDING, align: 'right', lineBreak: false });
            }
        };


        // Iterate through tokens for the current source line
        for (const token of line.tokens) {
             // Set font and color for the current token
             doc.font(options.codeFont + (token.fontStyle === 'bold' ? '-Bold' : token.fontStyle === 'italic' ? '-Oblique' : ''))
                .fontSize(options.fontSize)
                .fillColor(token.color || theme.defaultColor);

            const tokenText = token.text;
            const tokenWidth = doc.widthOfString(tokenText);

            // Check if token fits on the current PDF line segment
            if (currentX + tokenWidth <= codeStartX + codeWidth) {
                // Fits: Draw it and update X
                doc.text(tokenText, currentX, doc.y, { continued: true, lineBreak: false });
                currentX += tokenWidth;
            } else {
                // Needs wrapping: Process character by character or segment by segment
                let remainingText = tokenText;

                // If it's not the first token, move to the next line immediately
                if (!isFirstTokenOfLine) {
                    moveToNextWrapLine();
                }

                while (remainingText.length > 0) {
                    let fitsChars = 0;
                    let currentSegmentWidth = 0;
                    // Available width on the current (potentially wrapped) line
                    const availableWidth = (codeStartX + codeWidth) - currentX;

                    // Find how many characters fit
                    for (let i = 1; i <= remainingText.length; i++) {
                        const segment = remainingText.substring(0, i);
                        const width = doc.widthOfString(segment);
                        if (width <= availableWidth) {
                            fitsChars = i;
                            currentSegmentWidth = width;
                        } else {
                            break; // Exceeded available width
                        }
                    }

                     if (fitsChars === 0 && remainingText.length > 0) {
                         // Cannot fit even one character - force at least one
                         // This might happen if wrapIndentWidth makes the line too narrow
                         fitsChars = 1;
                         currentSegmentWidth = doc.widthOfString(remainingText[0]);
                         logger.warn(`Cannot fit character '${remainingText[0]}' on wrapped line ${line.lineNumber} of ${file.relativePath}.`);
                     }

                    const textToDraw = remainingText.substring(0, fitsChars);
                    // Draw the segment that fits
                    doc.text(textToDraw, currentX, doc.y, { continued: true, lineBreak: false });

                    currentX += currentSegmentWidth;
                    remainingText = remainingText.substring(fitsChars);

                    // If there's more text in this token, move to the next line
                    if (remainingText.length > 0) {
                        moveToNextWrapLine();
                    }
                } // End while remainingText in token
            } // End else (wrapping needed)
             isFirstTokenOfLine = false; // After processing the first token, this flag is false
        } // End for loop (tokens)

        // Move Y position down for the next line in the source file
        doc.y = currentLineY + lineHeight;

    } // End for loop (lines)

    logger.info(`Rendered file ${file.relativePath} spanning pages ${initialPageNumber}-${currentPage}.`);
    // Return the physical page count used by this file.
    // We need to know the actual number of pages added by doc.addPage() within this function.
    // This is tricky without direct access to pdfkit's internal page count *during* rendering.
    // A simpler approach is to return the final logical page number.
    // The main function will sum these up, which might lead to inaccurate TOC numbers if wrapping causes many extra pages.
    // For now, returning the final logical page number.
    return currentPage;
}


// --- Main PDF Generation Function ---

/**
 * Generates the PDF document from highlighted files.
 */
export async function generatePdf(
    files: HighlightedFile[],
    options: PdfOptions,
    theme: SyntaxTheme,
    repoName: string
): Promise<void> {
    logger.info(`Starting PDF generation for ${files.length} files.`);
    const startTime = Date.now();

    const doc = new PDFDocument({
        size: getPaperSizeInPoints(options.paperSize),
        margins: options.margins,
        autoFirstPage: false, // We explicitly add all pages
        bufferPages: true, // Recommended for complex layouts / page counting issues
        info: {
            Title: options.title,
            Author: 'xprinto',
            Creator: 'xprinto',
            CreationDate: new Date(),
        }
    });

    const outputDir = path.dirname(options.output);
    await fs.ensureDir(outputDir);
    const writeStream = fs.createWriteStream(options.output);
    doc.pipe(writeStream);

    let physicalPageCount = 0; // Track actual pages added

    // 1. Cover Page
    addCoverPage(doc, options, repoName); // Adds page 1
    physicalPageCount = doc.bufferedPageRange().count; // Should be 1

    // 2. Table of Contents
    let tocPages = 0;
    // The logical page number where code files *should* start (after cover + TOC)
    let fileStartLogicalPageNumber = physicalPageCount + 1;

    if (files.length > 1) {
        const tocStartPhysicalPage = physicalPageCount + 1;
        // Pass the estimated logical start page for files to TOC for its calculations
        addTableOfContents(doc, files, options, theme, fileStartLogicalPageNumber); // Adds TOC page(s)
        const tocEndPhysicalPage = doc.bufferedPageRange().count;
        tocPages = tocEndPhysicalPage - physicalPageCount;
        physicalPageCount = tocEndPhysicalPage; // Update physical page count
        // Update the logical start page number for files *after* TOC is rendered
        fileStartLogicalPageNumber = physicalPageCount + 1;
        logger.info(`Table of Contents added (${tocPages} page(s)). Files will start on logical page ${fileStartLogicalPageNumber}. Current physical page count: ${physicalPageCount}`);
    } else {
         logger.info('Skipping Table of Contents (single file).');
         // fileStartLogicalPageNumber remains physicalPageCount + 1
    }

    // 3. Render Code Files
    let lastLogicalPageNumber = physicalPageCount; // Track the logical page number for the footer

    const sortedFiles = files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    for (const file of sortedFiles) {
        // Pass the correct starting logical page number for this file
        const currentFileStartLogicalPage = lastLogicalPageNumber + 1;
        logger.debug(`Rendering file: ${file.relativePath}, starting on logical page ${currentFileStartLogicalPage}`);
        // renderCodeFile returns the last logical page number used by that file
        lastLogicalPageNumber = renderCodeFile(doc, file, options, theme, currentFileStartLogicalPage);
    }

    // --- Finalize PDF ---
    // The page numbers in the footer should now be correct based on the logical flow.
    // The actual physical page count might differ slightly if TOC estimation was off,
    // but the footer numbering should be consistent.
    doc.end();

    await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => {
            const endTime = Date.now();
            logger.success(`PDF generated successfully: ${options.output}`);
            logger.info(`Total generation time: ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
            resolve();
        });
        writeStream.on('error', (err) => {
            logger.error(`Error writing PDF file: ${err.message}`);
            reject(err);
        });
    });
}
