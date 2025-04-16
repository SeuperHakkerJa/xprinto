import hljs from 'highlight.js';
import { FileInfo } from '../file-reader';
import { log, LogLevel } from '../utils/logger';

// Language mapping for extensions not automatically recognized by highlight.js
const LANGUAGE_MAP: Record<string, string> = {
  'ts': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'tsx': 'typescript',
  'md': 'markdown',
  'yml': 'yaml',
  // Add more mappings as needed
};

export interface HighlightedLine {
  line: string;
  lineNumber: number;
  tokens: {
    text: string;
    color?: string;
    fontStyle?: string;
  }[];
}

export interface HighlightedFile extends FileInfo {
  highlightedLines: HighlightedLine[];
  language: string;
}

// Function to get language for syntax highlighting
function getLanguage(extension: string): string {
  return LANGUAGE_MAP[extension.toLowerCase()] || extension.toLowerCase();
}

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
  };
  
  // Replace all known entities
  return text.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x27;|&#x2F;|&#x60;|&#x[\dA-Fa-f]{2,};/g, 
    match => entities[match] || match);
}

// Function to highlight code based on file extension
export function highlightCode(fileInfo: FileInfo): HighlightedFile {
  const language = getLanguage(fileInfo.extension);
  
  try {
    // Split content into lines
    const lines = fileInfo.content.split('\n');
    
    const highlightedLines: HighlightedLine[] = lines.map((line, index) => {
      let highlighted;
      
      // Try to highlight with specific language
      try {
        highlighted = hljs.highlight(line, { language });
      } catch (e) {
        // Fall back to auto detection
        highlighted = hljs.highlightAuto(line);
      }
      
      // Parse hljs output to extract tokens
      const tokens = parseHighlightedTokens(highlighted.value);
      
      return {
        line,
        lineNumber: index + 1,
        tokens
      };
    });
    
    return {
      ...fileInfo,
      highlightedLines,
      language
    };
  } catch (err) {
    log(`Error highlighting code for ${fileInfo.path}: ${(err as Error).message}`, LogLevel.ERROR);
    
    // Return basic line-by-line structure without highlighting
    const lines = fileInfo.content.split('\n');
    const highlightedLines = lines.map((line, index) => ({
      line,
      lineNumber: index + 1,
      tokens: [{ text: line }]
    }));
    
    return {
      ...fileInfo,
      highlightedLines,
      language
    };
  }
}

// Function to parse hljs output into tokens
function parseHighlightedTokens(highlightedHtml: string): { text: string; color?: string; fontStyle?: string }[] {
  const tokens: { text: string; color?: string; fontStyle?: string }[] = [];
  
  // Pre-process: decode HTML entities in the entire string
  const decodedHtml = decodeHtmlEntities(highlightedHtml);
  
  // Regular expression to find span elements with class
  const regex = /<span class="([^"]+)">([^<]+)<\/span>|([^<]+)/g;
  let match;
  
  while ((match = regex.exec(decodedHtml)) !== null) {
    if (match[3]) {
      // Plain text without span
      const text = decodeHtmlEntities(match[3]);
      tokens.push({ text });
    } else {
      // Text with highlighting
      const className = match[1]; // hljs-keyword, hljs-string, etc.
      const text = decodeHtmlEntities(match[2]);
      
      // Map hljs classes to colors/styles
      const color = getColorForClass(className);
      const fontStyle = getFontStyleForClass(className);
      
      tokens.push({ text, color, fontStyle });
    }
  }
  
  return tokens;
}

// Map hljs classes to colors (improved color scheme)
function getColorForClass(className: string): string | undefined {
  if (className.includes('keyword')) return '#0000ff'; // Blue
  if (className.includes('string')) return '#008000'; // Green
  if (className.includes('comment')) return '#808080'; // Gray
  if (className.includes('number')) return '#009999'; // Teal
  if (className.includes('function')) return '#AA6E28'; // Brown
  if (className.includes('title')) return '#900'; // Dark Red
  if (className.includes('params')) return '#444'; // Dark Gray
  if (className.includes('built_in')) return '#0086b3'; // Light Blue
  if (className.includes('literal')) return '#990073'; // Purple
  if (className.includes('property')) return '#905'; // Pink
  if (className.includes('operator')) return '#9a6e3a'; // Dark Brown
  if (className.includes('punctuation')) return '#333'; // Dark Gray
  return undefined;
}

// Map hljs classes to font styles
function getFontStyleForClass(className: string): string | undefined {
  if (className.includes('comment')) return 'italic';
  if (className.includes('bold')) return 'bold';
  if (className.includes('italic')) return 'italic';
  if (className.includes('emphasis')) return 'italic';
  if (className.includes('strong')) return 'bold';
  return undefined;
}