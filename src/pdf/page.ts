import PDFDocument from 'pdfkit';
import { HighlightedFile } from '../syntax/highlighter';
import { PdfOptions } from './generator';

// Track page number across page renders - global counter
let currentPageNumber = 1;

// Define token type for better type safety
interface RenderToken {
  text: string;
  color?: string;
  fontStyle?: string;
}

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
  const lineNumberWidth = options.showLineNumbers ? Math.max(String(maxLineNumber).length * options.fontSize * 0.8, 50) : 0;
  
  // Render code
  renderCodeBlockSimple(doc, file, options, lineNumberWidth, startY, contentHeight);
  
  // Add footer with page number
  renderFooter(doc, options, currentPageNumber);
  
  // Increment page counter after rendering the page
  currentPageNumber++;
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
     .text(file.relativePath, options.margins!.left + 10, headerY + 8, { 
       width: pageWidth - 150, 
       align: 'left' 
     });
  
  // Draw language
  doc.font('Helvetica')
     .fontSize(10)
     .fillColor('#666666')
     .text(`Language: ${file.language.toUpperCase()}`, options.margins!.left + pageWidth - 140, headerY + 8, {
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
  
  // Draw page number
  doc.font('Helvetica')
     .fontSize(10)
     .fillColor('#666666')
     .text(`Page ${pageNumber}`, options.margins!.left, footerY + 10, { 
       width: pageWidth, 
       align: 'center' 
     });
}

function renderCodeBlockSimple(
  doc: PDFKit.PDFDocument,
  file: HighlightedFile,
  options: PdfOptions,
  lineNumberWidth: number,
  startY: number,
  contentHeight: number
): void {
  // Set consistent monospace font
  doc.font('Courier')
     .fontSize(options.fontSize);
  
  // Calculate available width for code
  const codeWidth = options.paperSize![0] - options.margins!.left - options.margins!.right - lineNumberWidth - 30;
  
  // Calculate line height (increased for better readability)
  const lineHeight = options.fontSize * 1.8;
  
  // Current position for drawing
  let currentY = startY + 10;
  
  // Draw background for the code block
  doc.rect(options.margins!.left, startY, options.paperSize![0] - options.margins!.left - options.margins!.right, contentHeight)
     .fill('#f8f8f8');
  
  // Draw line number background if line numbers are shown
  if (options.showLineNumbers) {
    doc.rect(options.margins!.left, startY, lineNumberWidth, contentHeight)
       .fill('#e8e8e8');
  }
  
  // Process each line of code
  for (let i = 0; i < file.highlightedLines.length; i++) {
    const line = file.highlightedLines[i];
    
    // Starting X position for code content
    const codeX = options.margins!.left + (options.showLineNumbers ? lineNumberWidth + 15 : 15);
    
    // Check if we need a new page
    if (currentY + lineHeight > startY + contentHeight) {
      // Add footer to current page
      renderFooter(doc, options, currentPageNumber);
      
      // Add a new page
      doc.addPage();
      
      // Increment page counter
      currentPageNumber++;
      
      // Reset current Y position
      currentY = startY + 10;
      
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
         .fontSize(options.fontSize)
         .fillColor('#888888')
         .text(
           String(line.lineNumber).padStart(String(file.highlightedLines.length).length, ' '),
           options.margins!.left + 5,
           currentY,
           { width: lineNumberWidth - 10, align: 'right' }
         );
    }
    
    // Calculate total width of the line (including spaces)
    let totalWidth = 0;
    for (const token of line.tokens) {
      doc.font(token.fontStyle === 'bold' ? 'Courier-Bold' : 
               token.fontStyle === 'italic' ? 'Courier-Oblique' : 'Courier');
      totalWidth += doc.widthOfString(token.text);
    }
    
    // Check if line needs wrapping
    if (totalWidth <= codeWidth) {
      // Simple case: Draw each token sequentially
      let xPos = codeX;
      for (const token of line.tokens) {
        doc.font(token.fontStyle === 'bold' ? 'Courier-Bold' : 
                token.fontStyle === 'italic' ? 'Courier-Oblique' : 'Courier')
           .fillColor(token.color || '#000000');
        
        doc.text(token.text, xPos, currentY, { continued: false });
        xPos += doc.widthOfString(token.text);
      }
      
      currentY += lineHeight;

    } else {
      // Handle wrapped lines
      // Two-pass approach: First break into lines, then render
      const virtualLines: RenderToken[][] = [];
      let currentVirtualLine: RenderToken[] = [];
      let currentLineWidth = 0;
      
      // First pass: Determine line breaks
      for (const token of line.tokens) {
        const font = token.fontStyle === 'bold' ? 'Courier-Bold' : 
                     token.fontStyle === 'italic' ? 'Courier-Oblique' : 'Courier';
        doc.font(font);
        
        // If token would make line too long, create a new virtual line
        if (currentLineWidth + doc.widthOfString(token.text) > codeWidth) {
          // If token itself is very long, we need to split it
          if (doc.widthOfString(token.text) > codeWidth / 2) {
            // Split long token into parts
            let remainingText = token.text;
            
            while (remainingText.length > 0) {
              // Find maximum characters that can fit
              let charsThatFit = 0;
              let spaceLeft = codeWidth - currentLineWidth;
              
              if (spaceLeft < doc.widthOfString('W')) {
                // Not enough space on current line, add to next line
                virtualLines.push([...currentVirtualLine]);
                currentVirtualLine = [];
                currentLineWidth = 0;
                spaceLeft = codeWidth;
              }
              
              // Try to fit as many characters as possible
              for (let j = 1; j <= remainingText.length; j++) {
                const partWidth = doc.widthOfString(remainingText.substring(0, j));
                if (partWidth <= spaceLeft) {
                  charsThatFit = j;
                } else {
                  break;
                }
              }
              
              if (charsThatFit > 0) {
                const partText = remainingText.substring(0, charsThatFit);
                const partToken: RenderToken = {
                  text: partText,
                  color: token.color,
                  fontStyle: token.fontStyle
                };
                
                currentVirtualLine.push(partToken);
                currentLineWidth += doc.widthOfString(partText);
                remainingText = remainingText.substring(charsThatFit);
              }
              
              if (remainingText.length > 0) {
                // We have more text that needs to go to the next line
                virtualLines.push([...currentVirtualLine]);
                currentVirtualLine = [];
                currentLineWidth = 0;
              }
            }
          } else {
            // Token doesn't fit on current line but isn't too long
            if (currentVirtualLine.length > 0) {
              virtualLines.push([...currentVirtualLine]);
            }
            currentVirtualLine = [token];
            currentLineWidth = doc.widthOfString(token.text);
          }
        } else {
          // Token fits on current line
          currentVirtualLine.push(token);
          currentLineWidth += doc.widthOfString(token.text);
        }
      }
      
      // Add the last virtual line if it has content
      if (currentVirtualLine.length > 0) {
        virtualLines.push(currentVirtualLine);
      }
      
      // Second pass: Render each virtual line
      let isFirstLine = true;
      for (const vLine of virtualLines) {
        // Check if we need a new page
        if (currentY + lineHeight > startY + contentHeight) {
          renderFooter(doc, options, currentPageNumber);
          doc.addPage();
          currentPageNumber++;
          currentY = startY + 10;
          renderHeader(doc, file, options);
          
          // Redraw backgrounds
          doc.rect(options.margins!.left, startY, options.paperSize![0] - options.margins!.left - options.margins!.right, contentHeight)
            .fill('#f8f8f8');
          
          if (options.showLineNumbers) {
            doc.rect(options.margins!.left, startY, lineNumberWidth, contentHeight)
              .fill('#e8e8e8');
          }
        }
        
        // For wrapped lines after the first, show continuation marker
        if (!isFirstLine && options.showLineNumbers) {
          doc.font('Courier')
             .fontSize(options.fontSize)
             .fillColor('#888888')
             .text('↪', options.margins!.left + lineNumberWidth/2 - 10, currentY, { align: 'center' });
        }
        
        // Draw tokens for this virtual line
        let xPos = codeX;
        // Add indentation for continuation lines
        if (!isFirstLine) {
          xPos += options.fontSize * 2;
        }
        
        for (const token of vLine) {
          doc.font(token.fontStyle === 'bold' ? 'Courier-Bold' : 
                  token.fontStyle === 'italic' ? 'Courier-Oblique' : 'Courier')
             .fillColor(token.color || '#000000');
          
          doc.text(token.text, xPos, currentY, { continued: false });
          xPos += doc.widthOfString(token.text);
        }
        
        currentY += lineHeight;
        isFirstLine = false;
      }
    }
  }
}