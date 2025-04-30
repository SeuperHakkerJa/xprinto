/**
 * Represents information about a single file discovered within the target repository.
 * This interface holds metadata and the raw content before processing.
 */
export interface FileInfo {
  /** The absolute path to the file on the filesystem. */
  absolutePath: string;
  /** The path to the file relative to the root of the scanned repository. Used for display and TOC generation. */
  relativePath: string;
  /** The raw text content of the file, read as UTF-8. */
  content: string;
  /** The file extension (e.g., 'ts', 'js', 'py') without the leading dot, converted to lowercase. */
  extension: string;
  /** The programming language detected for syntax highlighting purposes. Initially empty, populated by the highlighter. */
  language: string;
}

/**
 * Represents a single, styled segment (token) within a line of highlighted code.
 * Tokens are typically keywords, strings, comments, operators, etc.
 */
export interface HighlightedToken {
  /** The text content of this specific token. */
  text: string;
  /** Optional: The hex color code (e.g., '#0000ff') determined by the syntax theme for this token type. */
  color?: string;
  /** Optional: The font style ('normal', 'italic', 'bold', 'bold-italic') determined by the syntax theme. Defaults to 'normal'. */
  fontStyle?: 'normal' | 'italic' | 'bold' | 'bold-italic';
}

/**
 * Represents a single line of source code after syntax highlighting,
 * broken down into styled tokens.
 */
export interface HighlightedLine {
  /** The original line number (1-based) in the source file. */
  lineNumber: number;
  /** An array of styled tokens that make up this line. */
  tokens: HighlightedToken[];
}

/**
 * Represents a file after its content has been processed by the syntax highlighter.
 * Extends FileInfo with the tokenized lines.
 */
export interface HighlightedFile extends FileInfo {
  /** An array of highlighted lines, each containing styled tokens. */
  highlightedLines: HighlightedLine[];
}

/**
 * Configuration options controlling the PDF generation process.
 * These are typically derived from command-line arguments or defaults.
 */
export interface PdfOptions {
  /** The absolute path where the output PDF file will be saved. */
  output: string;
  /** The main title displayed on the cover page of the PDF document. */
  title: string;
  /** The font size (in points) to use for rendering code blocks. */
  fontSize: number;
  /** Flag indicating whether line numbers should be displayed next to the code. */
  showLineNumbers: boolean;
  /** The identifier (e.g., 'light', 'dark') of the syntax highlighting theme to use. */
  theme: string;
  /**
   * The paper size for the PDF document. Can be a standard name ('A4', 'Letter')
   * or a custom size specified as [width, height] in PDF points (72 points per inch).
   */
  paperSize: 'A4' | 'Letter' | [number, number];
  /** Margins (in points) for the top, right, bottom, and left edges of each page. */
  margins: { top: number; right: number; bottom: number; left: number };
  /** The height (in points) reserved for the header section on each code page. */
  headerHeight: number;
  /** The height (in points) reserved for the footer section on each code page. */
  footerHeight: number;
  /** The title text used for the Table of Contents page. */
  tocTitle: string;
  /** The name of the font to use for rendering code blocks (e.g., 'Courier', 'Consolas'). Must be a standard PDF font or embedded. */
  codeFont: string;
  /** The name of the font to use for non-code text (titles, TOC, headers, footers) (e.g., 'Helvetica', 'Times-Roman'). Must be a standard PDF font or embedded. */
  textFont: string;
}

/**
 * Defines the color scheme and styling rules for a syntax highlighting theme.
 * Used by the PDF renderer to apply colors and styles to code tokens.
 */
export interface SyntaxTheme {
  /** The default text color used when no specific token rule applies. */
  defaultColor: string;
  /** The background color for the main code rendering area. */
  backgroundColor: string;
  /** The text color for line numbers. */
  lineNumberColor: string;
  /** The background color for the line number gutter area. */
  lineNumberBackground: string;
  /** The text color used in page headers and footers. */
  headerFooterColor: string;
  /** The background color used for page headers and footers. */
  headerFooterBackground: string;
  /** The color used for border lines (e.g., around code blocks, header/footer separators). */
  borderColor: string;
  /** A mapping of semantic token types (derived from highlight.js classes) to specific hex color codes. */
  tokenColors: {
    keyword?: string;
    string?: string;
    comment?: string;
    number?: string;
    function?: string; // e.g., function name definition
    class?: string;    // e.g., class name definition
    title?: string;    // e.g., function/class usage, important identifiers
    params?: string;   // Function parameters
    built_in?: string; // Built-in functions/variables/types
    literal?: string;  // e.g., true, false, null, undefined
    property?: string; // Object properties, member access
    operator?: string;
    punctuation?: string;
    attr?: string;     // HTML/XML attributes names
    tag?: string;      // HTML/XML tags names including </>
    variable?: string; // Variable declarations/usage
    regexp?: string;   // Regular expressions
    // Add more specific highlight.js scopes as needed (e.g., 'meta', 'section', 'type')
  };
  /** Optional: A mapping of semantic token types to specific font styles. */
  fontStyles?: {
    comment?: 'italic';
    keyword?: 'bold';
    // Add more styles if desired
  };
}

