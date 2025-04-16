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
    appendSpace?: boolean;  // New property to indicate if space should be appended
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

// Improved HTML entity decoder
function decodeHtmlEntities(text: string): string {
  // Handle common HTML entities
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
  };
  
  // First pass: replace named entities
  let result = text;
  for (const [entity, replacement] of Object.entries(entityMap)) {
    result = result.replace(new RegExp(entity, 'g'), replacement);
  }
  
  // Second pass: handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return result;
}

// Main function to highlight code
export function highlightCode(fileInfo: FileInfo): HighlightedFile {
  const language = getLanguage(fileInfo.extension);
  
  try {
    // Split content into lines
    const lines = fileInfo.content.split('\n');
    
    const highlightedLines: HighlightedLine[] = lines.map((line, index) => {
      // Skip highlighting if line is empty
      if (line.trim() === '') {
        return {
          line,
          lineNumber: index + 1,
          tokens: [{ text: '' }]
        };
      }
      
      let highlighted;
      
      // Try to highlight with specific language
      try {
        highlighted = hljs.highlight(line, { language });
      } catch (e) {
        // Fall back to auto detection
        highlighted = hljs.highlightAuto(line);
      }
      
      // Extract tokens using the improved approach with space preservation
      const tokens = extractTokensWithSpaces(line, highlighted.value);
      
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

// Advanced token extraction that preserves spaces between keywords
function extractTokensWithSpaces(originalLine: string, html: string): { text: string; color?: string; fontStyle?: string; appendSpace?: boolean }[] {
  const tokens: { text: string; color?: string; fontStyle?: string; appendSpace?: boolean }[] = [];
  
  // Step 1: Clean up the HTML and decode entities
  const cleanedHtml = decodeHtmlEntities(html);
  
  // Step 2: Extract tokens with a more robust approach
  // This regex matches span elements or text nodes
  const tokenRegex = /<span class="([^"]+)">([^<]+)<\/span>|([^<]+)/g;
  let match;
  
  // Keep track of current position in the original line for space detection
  let currentPos = 0;
  
  while ((match = tokenRegex.exec(cleanedHtml)) !== null) {
    let tokenText = '';
    let className = '';
    
    if (match[3]) {
      // Plain text (not in span)
      tokenText = match[3];
    } else {
      // Text with highlighting in a span
      className = match[1]; // Class like "hljs-keyword", etc.
      tokenText = match[2];
    }
    
    if (tokenText.trim()) {
      const color = getColorForClass(className);
      const fontStyle = getFontStyleForClass(className);

      // Find this token's position in the original line
      const tokenPos = originalLine.indexOf(tokenText, currentPos);
      if (tokenPos !== -1) {
        // Check if there are spaces before this token that need to be preserved
        if (tokenPos > currentPos) {
          const spaces = originalLine.substring(currentPos, tokenPos);
          if (spaces.trim() === '') {
            // Add spaces as a separate token
            tokens.push({ text: spaces });
          }
        }
        
        // Add the actual token
        tokens.push({ text: tokenText, color, fontStyle });
        
        // Update current position for next token
        currentPos = tokenPos + tokenText.length;
      } else {
        // Fallback if we can't find the exact position
        tokens.push({ text: tokenText, color, fontStyle });
      }
    }
  }
  
  // Check if there are any remaining spaces at the end
  if (currentPos < originalLine.length) {
    const remainingText = originalLine.substring(currentPos);
    if (remainingText.trim() !== '') {
      tokens.push({ text: remainingText });
    }
  }
  
  return tokens;
}

// Improved color mapping for syntax highlighting
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
  if (className.includes('attr')) return '#0086b3'; // Light Blue (for attributes)
  return undefined;
}

// Map classes to font styles
function getFontStyleForClass(className: string): string | undefined {
  if (className.includes('comment')) return 'italic';
  if (className.includes('bold')) return 'bold';
  if (className.includes('italic')) return 'italic';
  if (className.includes('emphasis')) return 'italic';
  if (className.includes('strong')) return 'bold';
  return undefined;
}