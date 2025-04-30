/**
 * Represents information about a file found in the repository.
 */
export interface FileInfo {
    absolutePath: string; // Full path to the file
    relativePath: string; // Path relative to the repository root
    content: string;      // File content as a string
    extension: string;    // File extension (e.g., 'ts', 'js')
    language: string;     // Detected language for highlighting
  }
  
  /**
   * Represents a single token within a line of highlighted code.
   */
  export interface HighlightedToken {
    text: string;
    color?: string;     // Hex color code (e.g., '#0000ff')
    fontStyle?: 'normal' | 'italic' | 'bold' | 'bold-italic';
  }
  
  /**
   * Represents a single line of code with its tokens.
   */
  export interface HighlightedLine {
    lineNumber: number;
    tokens: HighlightedToken[];
  }
  
  /**
   * Represents a file with its content processed for highlighting.
   */
  export interface HighlightedFile extends FileInfo {
    highlightedLines: HighlightedLine[];
  }
  
  /**
   * Options for configuring the PDF generation process.
   */
  export interface PdfOptions {
    output: string;
    title: string;
    fontSize: number;
    showLineNumbers: boolean;
    theme: string; // Identifier for the theme (maps to colors)
    // Standard PDF page sizes (points)
    paperSize: 'A4' | 'Letter' | [number, number];
    margins: { top: number; right: number; bottom: number; left: number };
    headerHeight: number;
    footerHeight: number;
    tocTitle: string;
    codeFont: string; // Font for code blocks
    textFont: string; // Font for titles, TOC, headers/footers
  }
  
  /**
   * Defines the color scheme for a syntax highlighting theme.
   */
  export interface SyntaxTheme {
    defaultColor: string;
    backgroundColor: string; // Background for code blocks
    lineNumberColor: string;
    lineNumberBackground: string;
    headerFooterColor: string;
    headerFooterBackground: string;
    borderColor: string;
    tokenColors: {
      keyword?: string;
      string?: string;
      comment?: string;
      number?: string;
      function?: string; // e.g., function name definition
      class?: string;    // e.g., class name definition
      title?: string;    // e.g., function/class usage, important identifiers
      params?: string;   // Function parameters
      built_in?: string; // Built-in functions/variables
      literal?: string;  // e.g., true, false, null
      property?: string; // Object properties
      operator?: string;
      punctuation?: string;
      attr?: string;     // HTML/XML attributes
      tag?: string;      // HTML/XML tags
      variable?: string; // Variable declarations/usage
      regexp?: string;
      // Add more specific highlight.js scopes as needed
    };
    fontStyles?: { // Optional font styles
      comment?: 'italic';
      keyword?: 'bold';
      // Add more styles
    };
  }
  