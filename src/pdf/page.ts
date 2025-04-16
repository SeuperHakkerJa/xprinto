import PDFDocument from 'pdfkit';
import { HighlightedFile } from '../syntax/highlighter';
import { PdfOptions } from './generator';

// Track page number across page renders - global counter
let currentPageNumber = 1;

export function renderPage(
  doc: PDFKit.PDFDocument,
  file: HighlightedFile,
  options: PdfOptions
): void {
  const pageWidth = options.paperSize![0] - options.margins!.left - options.margins!.right;
  const contentHeight = options.paperSize![1] - options.margins!.top - options.margins!.bottom - options.headerHeight! - options.footerHeight!;
  
  // Add header with file path
  renderHeader(doc, file, options);
  
  // Calculate starting position after header
  const startY = options.margins!.top + options.headerHeight!;
  doc.y = startY;
  
  // Calculate line number column width based on the number of lines
  const maxLineNumber = file.highlightedLines.length;
  const lineNumberWidth = options.showLineNumbers ? Math.max(String(maxLineNumber).length * options.fontSize * 0.6, 30) : 0;
  
  // Render code
  renderCodeBlock(doc, file, options, lineNumberWidth, startY, contentHeight);
  
  // Add footer with page number
  renderFooter(doc, options, currentPageNumber);
}

function renderHeader(
  doc: PDFKit.PDFDocument,
  file: HighlightedFile,
  options: PdfOptions
): void {
  const headerY = options.margins!.top;
  const pageWidth = options.paperSize![0] - options.margins!.left - options.margins!.right;
  
  // Draw background for header
  doc.rect(options.margins!.left, headerY, pageWidth, options.headerHeight!)
     .fillColor('#f8f8f8')
     .fill();
  
  // Draw file path
  doc.font('Helvetica-Bold')
     .fontSize(12)
     .fillColor('#333333')
     .text(file.relativePath, options.margins!.left + 10, headerY + 5, { 
       width: pageWidth - 150, 
       align: 'left' 
     });
  
  // Draw language
  doc.font('Helvetica')
     .fontSize(10)
     .fillColor('#666666')
     .text(`Language: ${file.language.toUpperCase()}`, options.margins!.left + pageWidth - 140, headerY + 5, {
       width: 130,
       align: 'right' 
     });
  
  // Draw a line under the header
  doc.moveTo(options.margins!.left, headerY + options.headerHeight! - 1)
     .lineTo(options.paperSize![0] - options.margins!.right, headerY + options.headerHeight! - 1)
     .lineWidth(1)
     .strokeColor('#dddddd')
     .stroke();
}

function renderFooter(
  doc: PDFKit.PDFDocument,
  options: PdfOptions,
  pageNumber: number
): void {
  const footerY = options.paperSize![1] - options.margins!.bottom - options.footerHeight!;
  const pageWidth = options.paperSize![0] - options.margins!.left - options.margins!.right;
  
  // Draw a line above the footer
  doc.moveTo(options.margins!.left, footerY)
     .lineTo(options.paperSize![0] - options.margins!.right, footerY)
     .lineWidth(1)
     .strokeColor('#dddddd')
     .stroke();
  
  // Draw page number using the global counter
  doc.font('Helvetica')
     .fontSize(10)
     .fillColor('#666666')
     .text(`Page ${pageNumber}`, options.margins!.left, footerY + 10, { 
       width: pageWidth, 
       align: 'center' 
     });
}

function renderCodeBlock(
  doc: PDFKit.PDFDocument,
  file: HighlightedFile,
  options: PdfOptions,
  lineNumberWidth: number,
  startY: number,
  contentHeight: number
): void {
  // Set up monospaced font for code
  doc.font('Courier')
     .fontSize(options.fontSize);
  
  // Calculate available width for code
  const codeWidth = options.paperSize![0] - options.margins!.left - options.margins!.right - lineNumberWidth - 20; // Extra padding
  
  // Current Y position for drawing
  let currentY = startY;
  const lineHeight = options.fontSize * 1.4; // Line height slightly larger than font size
  
  // Draw background for the code block
  doc.rect(options.margins!.left, startY, options.paperSize![0] - options.margins!.left - options.margins!.right, contentHeight)
     .fill('#f8f8f8');
  
  // Draw line number background if line numbers are shown
  if (options.showLineNumbers) {
    doc.rect(options.margins!.left, startY, lineNumberWidth, contentHeight)
       .fill('#e8e8e8');
  }
  
  // Render each line
  for (let i = 0; i < file.highlightedLines.length; i++) {
    const line = file.highlightedLines[i];
    
    // Check if we need a new page
    if (currentY + lineHeight > startY + contentHeight) {
      // Add footer to current page
      renderFooter(doc, options, currentPageNumber);
      
      // Add a new page
      doc.addPage();
      
      // Increment page counter
      currentPageNumber++;
      
      // Reset current Y position
      currentY = startY;
      
      // Add header to new page
      renderHeader(doc, file, options);
      
      // Draw background for the code block on the new page
      doc.rect(options.margins!.left, startY, options.paperSize![0] - options.margins!.left - options.margins!.right, contentHeight)
         .fill('#f8f8f8');
      
      // Draw line number background if line numbers are shown
      if (options.showLineNumbers) {
        doc.rect(options.margins!.left, startY, lineNumberWidth, contentHeight)
           .fill('#e8e8e8');
      }
    }
    
    // Draw line number if enabled
    if (options.showLineNumbers) {
      doc.font('Courier-Bold')
         .fillColor('#888888')
         .text(
           String(line.lineNumber).padStart(String(file.highlightedLines.length).length, ' '),
           options.margins!.left + 5,
           currentY,
           { lineBreak: false }
         );
    }
    
    // Calculate starting X position for code
    const codeX = options.margins!.left + (options.showLineNumbers ? lineNumberWidth + 10 : 0);
    
    // Draw code with syntax highlighting
    let currentX = codeX;
    let lineWrapped = false;
    
    for (const token of line.tokens) {
      // Set color for token
      doc.font(token.fontStyle === 'bold' ? 'Courier-Bold' : token.fontStyle === 'italic' ? 'Courier-Oblique' : 'Courier')
         .fillColor(token.color || '#000000');
      
      // Calculate width of token text
      const tokenWidth = doc.widthOfString(token.text);
      
      // Check if token fits on current line
      if (currentX + tokenWidth > codeX + codeWidth) {
        // Move to next line
        currentY += lineHeight;
        currentX = codeX + 20; // Indent continuation lines
        lineWrapped = true;
        
        // Check if we need a new page
        if (currentY + lineHeight > startY + contentHeight) {
          // Add footer to current page
          renderFooter(doc, options, currentPageNumber);
          
          // Add a new page
          doc.addPage();
          
          // Increment page counter
          currentPageNumber++;
          
          // Reset current Y position
          currentY = startY;
          
          // Add header to new page
          renderHeader(doc, file, options);
          
          // Draw background for the code block on the new page
          doc.rect(options.margins!.left, startY, options.paperSize![0] - options.margins!.left - options.margins!.right, contentHeight)
             .fill('#f8f8f8');
          
          // Draw line number background if line numbers are shown
          if (options.showLineNumbers) {
            doc.rect(options.margins!.left, startY, lineNumberWidth, contentHeight)
               .fill('#e8e8e8');
          }
        }
      }
      
      // Draw token text
      doc.text(token.text, currentX, currentY, { continued: true });
      
      // Update current X position
      currentX += tokenWidth;
    }
    
    // End the line
    doc.text('', 0, 0);
    
    // Move to next line (add extra space if line was wrapped)
    currentY += lineWrapped ? lineHeight * 0.2 : lineHeight;
  }
}