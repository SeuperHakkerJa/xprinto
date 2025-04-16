import PDFDocument from 'pdfkit';
import { HighlightedFile } from '../syntax/highlighter';
import { PdfOptions } from './generator';

export function generateTOC(
  doc: PDFKit.PDFDocument,
  files: HighlightedFile[],
  options: PdfOptions
): void {
  // Add a new page for TOC
  doc.addPage();
  
  // Set up page dimensions
  const pageWidth = options.paperSize![0] - options.margins!.left - options.margins!.right;
  
  // Add TOC title
  doc.font('Helvetica-Bold')
     .fontSize(18)
     .text('Table of Contents', { align: 'center' })
     .moveDown(2);
  
  // Group files by directories for a hierarchical TOC
  const filesByDirectory: Record<string, HighlightedFile[]> = {};
  
  files.forEach(file => {
    const dirPath = file.relativePath.split('/').slice(0, -1).join('/');
    if (!filesByDirectory[dirPath]) {
      filesByDirectory[dirPath] = [];
    }
    filesByDirectory[dirPath].push(file);
  });
  
  // Calculate actual page numbers
  // Cover page + TOC page = 2 pages before files
  let currentPage = 3;
  const pageNumbers: Record<string, number> = {};
  
  // Calculate page numbers first
  const directories = Object.keys(filesByDirectory).sort();
  directories.forEach(directory => {
    const sortedFiles = filesByDirectory[directory].sort((a, b) => 
      a.relativePath.localeCompare(b.relativePath)
    );
    
    sortedFiles.forEach(file => {
      pageNumbers[file.relativePath] = currentPage;
      
      // Calculate realistic page count based on file size
      const lineCount = file.highlightedLines.length;
      const linesPerPage = Math.floor((options.paperSize![1] - options.margins!.top - options.margins!.bottom - 
                           options.headerHeight! - options.footerHeight!) / (options.fontSize * 1.4));
      const estimatedPages = Math.max(1, Math.ceil(lineCount / linesPerPage));
      currentPage += estimatedPages;
    });
  });
  
  // Now render the TOC with accurate page numbers
  directories.forEach(directory => {
    if (directory) {
      // Add directory name with better formatting
      doc.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#000000');
      
      // Add a box around the directory name
      const directoryText = directory;
      const textWidth = doc.widthOfString(directoryText);
      const textHeight = doc.currentLineHeight();
      
      doc.rect(
        options.margins!.left,
        doc.y,
        pageWidth,
        textHeight + 8
      )
      .fillColor('#f0f0f0')
      .fill();
      
      // Write directory name
      doc.fillColor('#000000')
         .text(directoryText, options.margins!.left + 10, doc.y - textHeight + 4);
      
      doc.moveDown(1);
    }
    
    // Sort files in the directory
    const sortedFiles = filesByDirectory[directory].sort((a, b) => 
      a.relativePath.localeCompare(b.relativePath)
    );
    
    // Add file entries
    sortedFiles.forEach(file => {
      const fileName = file.relativePath.split('/').pop() || file.relativePath;
      const indent = directory ? '    ' : '';
      
      // Get page number for this file
      const pageNum = pageNumbers[file.relativePath];
      
      // Calculate positions
      const startX = options.margins!.left + (directory ? 20 : 0);
      const pageNumWidth = doc.widthOfString(String(pageNum));
      const endX = options.margins!.left + pageWidth - pageNumWidth;
      const nameWidth = endX - startX - 20; // Leave space for dots
      
      // Add file name
      doc.font('Helvetica')
         .fontSize(12)
         .fillColor('#000000')
         .text(`${indent}${fileName}`, startX, doc.y, { 
           continued: true,
           width: nameWidth
         });
      
      // Create a dot leader that's more compact
      const dotLeader = '. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ';
      doc.fillColor('#888888')
         .text(dotLeader, { continued: true });
      
      // Add page number
      doc.fillColor('#000000')
         .font('Helvetica-Bold')
         .text(` ${pageNum}`, { align: 'right' });
      
      doc.moveDown(0.5);
    });
    
    doc.moveDown(0.5);
  });
  
  // Add note about page numbers
  doc.moveDown(2)
     .font('Helvetica-Oblique')
     .fontSize(10)
     .fillColor('#555555')
     .text('Note: Page numbers reflect actual document pagination.', {
       align: 'center',
       width: pageWidth
     });
}