import hljs from 'highlight.js';
import he from 'he'; // Use 'he' library for robust HTML entity decoding
import { FileInfo, HighlightedFile, HighlightedLine, HighlightedToken, SyntaxTheme } from './utils/types';
import { logger } from './utils/logger';

// --- Language Mapping ---

/**
 * A mapping from common file extensions (lowercase) to the language identifier
 * expected by highlight.js. This helps when highlight.js might not automatically
 * detect the correct language based solely on the extension.
 */
const LANGUAGE_MAP: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'py': 'python',
    'pyw': 'python',
    'rb': 'ruby',
    'java': 'java',
    'cs': 'csharp',
    'go': 'go',
    'php': 'php',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss', // Treat sass as scss for highlighting
    'less': 'less',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'md': 'markdown',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'ksh': 'bash',
    'fish': 'bash', // Highlight most shells as bash
    'sql': 'sql',
    'xml': 'xml',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'swift': 'swift',
    'pl': 'perl',
    'pm': 'perl',
    'rs': 'rust',
    'lua': 'lua',
    'dockerfile': 'dockerfile',
    'h': 'c', // Often C or C++ header, default to C
    'hpp': 'cpp',
    'cpp': 'cpp',
    'cxx': 'cpp',
    'cc': 'cpp',
    'c': 'c',
    'm': 'objectivec',
    'mm': 'objectivec',
    'gradle': 'gradle',
    'groovy': 'groovy',
    'cmake': 'cmake',
    'tf': 'terraform',
    'vue': 'vue',
    'svelte': 'svelte',
    // Add more as needed
};

// --- Theme Mapping Logic ---

/**
 * Maps highlight.js CSS class names (found in `result.value`) to semantic token types
 * defined in the `SyntaxTheme` interface. This allows applying theme colors correctly.
 * @param className A space-separated string of CSS classes from highlight.js (e.g., "hljs-keyword", "hljs-string").
 * @returns The corresponding semantic token type key from `SyntaxTheme['tokenColors']`, or null if no specific mapping is found.
 */
function mapHljsClassToThemeToken(className: string): keyof SyntaxTheme['tokenColors'] | null {
    // Order matters slightly - more specific checks first if classes overlap
    if (className.includes('comment')) return 'comment';
    if (className.includes('keyword')) return 'keyword';
    if (className.includes('string')) return 'string';
    if (className.includes('number')) return 'number';
    if (className.includes('literal')) return 'literal'; // true, false, null
    if (className.includes('built_in')) return 'built_in'; // console, Math, standard library types/functions
    if (className.includes('function')) return 'function'; // Function definition keyword/name container
    if (className.includes('class') && className.includes('title')) return 'class'; // Class definition name
    // Title often applies to function names, class names (usage), important identifiers
    if (className.includes('title')) return 'title';
    if (className.includes('params')) return 'params'; // Function parameters
    if (className.includes('property')) return 'property'; // Object properties, member access
    if (className.includes('operator')) return 'operator';
    if (className.includes('punctuation')) return 'punctuation';
    if (className.includes('tag')) return 'tag'; // HTML/XML tags
    if (className.includes('attr') || className.includes('attribute')) return 'attr'; // HTML/XML attributes
    if (className.includes('variable')) return 'variable';
    if (className.includes('regexp')) return 'regexp';

    // Fallback if no specific class matched our defined types
    return null;
}

/**
 * Determines the font style for a token based on highlight.js classes and theme configuration.
 * @param className A space-separated string of CSS classes from highlight.js.
 * @param theme The active syntax theme configuration.
 * @returns The appropriate font style ('normal', 'italic', 'bold', 'bold-italic').
 */
function getFontStyle(className: string, theme: SyntaxTheme): HighlightedToken['fontStyle'] {
    const styles = theme.fontStyles || {};
    // Simple checks for now, could be expanded
    if (className.includes('comment') && styles.comment === 'italic') return 'italic';
    if (className.includes('keyword') && styles.keyword === 'bold') return 'bold';
    // Add more style mappings based on theme config if needed
    return 'normal'; // Default style
}


// --- Language Detection ---

/**
 * Detects the language identifier for syntax highlighting based on the file extension.
 * Uses the `LANGUAGE_MAP` for overrides, otherwise falls back to the extension itself.
 * @param extension The file extension (e.g., 'ts', 'py') without the leading dot.
 * @returns The language name recognized by highlight.js or the extension itself (lowercase).
 */
function detectLanguage(extension: string): string {
    const lowerExt = extension?.toLowerCase() || ''; // Handle potential null/undefined extension
    return LANGUAGE_MAP[lowerExt] || lowerExt; // Fallback to extension if no mapping
}

// --- HTML Parsing ---

/**
 * Parses the HTML output generated by highlight.js into an array of styled tokens.
 * This implementation uses a simple stack-based approach to handle nested spans
 * and correctly applies styles based on the active theme. It also decodes HTML entities.
 *
 * @param highlightedHtml The HTML string generated by `hljs.highlight().value`.
 * @param theme The syntax theme configuration object.
 * @returns An array of `HighlightedToken` objects representing the styled segments of the line.
 */
function parseHighlightedHtml(highlightedHtml: string, theme: SyntaxTheme): HighlightedToken[] {
    const tokens: HighlightedToken[] = [];
    // Stack to keep track of nested spans and their classes
    const stack: { tag: string; class?: string }[] = [];
    let currentText = '';
    let currentIndex = 0;

    while (currentIndex < highlightedHtml.length) {
        const tagStart = highlightedHtml.indexOf('<', currentIndex);

        // Extract text content occurring before the next tag (or until the end)
        const textBeforeTag = tagStart === -1
            ? highlightedHtml.substring(currentIndex)
            : highlightedHtml.substring(currentIndex, tagStart);

        if (textBeforeTag) {
            currentText += textBeforeTag;
        }

        // If no more tags, process remaining text and exit
        if (tagStart === -1) {
            if (currentText) {
                const decodedText = he.decode(currentText); // Decode entities
                const currentStyle = stack[stack.length - 1]; // Get style from top of stack
                const themeKey = currentStyle?.class ? mapHljsClassToThemeToken(currentStyle.class) : null;
                tokens.push({
                    text: decodedText,
                    color: themeKey ? (theme.tokenColors[themeKey] ?? theme.defaultColor) : theme.defaultColor,
                    fontStyle: currentStyle?.class ? getFontStyle(currentStyle.class, theme) : 'normal',
                });
            }
            break; // Exit loop
        }

        const tagEnd = highlightedHtml.indexOf('>', tagStart);
        if (tagEnd === -1) {
            // Malformed HTML (unclosed tag) - treat the rest as text
             logger.warn("Malformed HTML detected in highlighter output (unclosed tag).");
             currentText += highlightedHtml.substring(tagStart);
             // Process the potentially malformed remaining text
             if (currentText) {
                 const decodedText = he.decode(currentText);
                 const currentStyle = stack[stack.length - 1];
                 const themeKey = currentStyle?.class ? mapHljsClassToThemeToken(currentStyle.class) : null;
                 tokens.push({
                     text: decodedText,
                     color: themeKey ? (theme.tokenColors[themeKey] ?? theme.defaultColor) : theme.defaultColor,
                     fontStyle: currentStyle?.class ? getFontStyle(currentStyle.class, theme) : 'normal',
                 });
             }
             break; // Exit loop
        }

        const tagContent = highlightedHtml.substring(tagStart + 1, tagEnd);
        const isClosingTag = tagContent.startsWith('/');

        // Process any accumulated text *before* handling the current tag
        if (currentText) {
             const decodedText = he.decode(currentText);
             const currentStyle = stack[stack.length - 1];
             const themeKey = currentStyle?.class ? mapHljsClassToThemeToken(currentStyle.class) : null;
             tokens.push({
                 text: decodedText,
                 color: themeKey ? (theme.tokenColors[themeKey] ?? theme.defaultColor) : theme.defaultColor, // Use default if key not in theme
                 fontStyle: currentStyle?.class ? getFontStyle(currentStyle.class, theme) : 'normal',
             });
             currentText = ''; // Reset accumulated text
        }

        // Handle the tag itself
        if (isClosingTag) {
            // Closing tag: Pop the corresponding tag from the stack
            const tagName = tagContent.substring(1).trim();
            if (stack.length > 0 && stack[stack.length - 1].tag === tagName) {
                stack.pop();
            } else if (tagName === 'span') {
                 // Allow potentially mismatched </span> tags from hljs sometimes? Log it.
                 logger.debug(`Potentially mismatched closing tag </${tagName}> encountered.`);
                 if(stack.length > 0 && stack[stack.length - 1].tag === 'span') stack.pop(); // Try popping if top is span
            }
        } else {
            // Opening tag: Extract tag name and class, push onto stack
            // Improved regex to handle tags without attributes
            const parts = tagContent.match(/^([a-zA-Z0-9]+)(?:\s+(.*))?$/) || [null, tagContent, ''];
            const tagName = parts[1];
            const attributesStr = parts[2] || '';
            let className: string | undefined;
            // Simple class attribute parsing
            const classAttrMatch = attributesStr.match(/class="([^"]*)"/);
            if (classAttrMatch) {
                className = classAttrMatch[1];
            }
            stack.push({ tag: tagName, class: className });
        }

        // Move index past the processed tag
        currentIndex = tagEnd + 1;
    }

     // Filter out any tokens that ended up with empty text after decoding/parsing
    return tokens.filter(token => token.text.length > 0);
}


// --- Main Highlighting Function ---

/**
 * Applies syntax highlighting to the content of a single file.
 * It detects the language, processes the content line by line using highlight.js,
 * parses the resulting HTML into styled tokens, and applies colors/styles from the theme.
 * Includes fallbacks for unsupported languages or highlighting errors.
 *
 * @param fileInfo The `FileInfo` object containing the file's path, content, and extension.
 * @param theme The `SyntaxTheme` object defining the colors and styles to apply.
 * @returns A `HighlightedFile` object containing the original file info plus the array of `HighlightedLine` objects.
 */
export function highlightCode(fileInfo: FileInfo, theme: SyntaxTheme): HighlightedFile {
    const language = detectLanguage(fileInfo.extension);
    // Verify if the detected language is actually supported by highlight.js
    const detectedLanguageName = hljs.getLanguage(language) ? language : 'plaintext';
    logger.debug(`Highlighting ${fileInfo.relativePath} as language: ${detectedLanguageName}`);

    const highlightedLines: HighlightedLine[] = [];
    // Robustly split lines, handling \n and \r\n
    const lines = fileInfo.content.split(/\r?\n/);

    try {
        // Process line by line
        lines.forEach((line, index) => {
            let lineTokens: HighlightedToken[];
            const lineNumber = index + 1; // 1-based line number

            if (line.trim() === '') {
                // Handle empty lines simply: one empty token
                lineTokens = [{ text: '', fontStyle: 'normal', color: theme.defaultColor }];
            } else {
                // *** REMOVED explicit type annotation for 'result' ***
                let result = null; // Initialize as null
                try {
                    // Attempt highlighting with the detected (and verified) language
                    if (detectedLanguageName !== 'plaintext') {
                        // ignoreIllegals helps prevent errors on slightly malformed code
                        result = hljs.highlight(line, { language: detectedLanguageName, ignoreIllegals: true });
                    } else {
                        // If language wasn't registered, try auto-detection as a fallback
                        logger.debug(`Attempting auto-detect for line ${lineNumber} in ${fileInfo.relativePath}`);
                        result = hljs.highlightAuto(line);
                    }
                } catch (highlightError) {
                    // Log specific highlighting errors but continue processing the file
                    logger.warn(`Highlighting failed for line ${lineNumber} in ${fileInfo.relativePath}, using plain text. Error: ${(highlightError as Error).message}`);
                    result = null; // Ensure result is null on error
                }

                // Parse the HTML output (or use encoded plain text as fallback)
                // Use optional chaining on result?.value
                const htmlToParse = result?.value ?? he.encode(line);
                lineTokens = parseHighlightedHtml(htmlToParse, theme);

                 // Final safety check: If parsing resulted in empty tokens for a non-empty line, use a single plain token
                 if (lineTokens.length === 0 && line.length > 0) {
                    logger.debug(`Token parsing yielded empty array for non-empty line ${lineNumber} in ${fileInfo.relativePath}. Using plain text token.`);
                    lineTokens = [{ text: line, color: theme.defaultColor, fontStyle: 'normal' }];
                }
            }

            // Add the processed line (tokens) to the results
            highlightedLines.push({
                lineNumber: lineNumber,
                tokens: lineTokens,
            });
        });

    } catch (processingError) {
        // Catch unexpected errors during the line processing loop (less likely now)
        logger.error(`Critical error during highlighting loop for ${fileInfo.relativePath}: ${(processingError as Error).message}`);
        // Fallback: return the file structure but with unhighlighted lines to prevent total failure
        const fallbackLines = lines.map((line, index) => ({
            lineNumber: index + 1,
            tokens: [{ text: line, color: theme.defaultColor, fontStyle: 'normal' as const }],
        }));
        return {
            ...fileInfo,
            language: 'plaintext', // Indicate highlighting failed
            highlightedLines: fallbackLines,
        };
    }

    // Return the processed file info with highlighted lines
    return {
        ...fileInfo,
        language: detectedLanguageName, // Store the language that was actually used for highlighting
        highlightedLines,
    };
}
