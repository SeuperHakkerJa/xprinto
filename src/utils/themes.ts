import { SyntaxTheme } from './types';

/**
 * Defines the 'light' syntax highlighting theme, similar to GitHub's light theme.
 */
const lightTheme: SyntaxTheme = {
    defaultColor: '#24292e', // Default text color
    backgroundColor: '#ffffff', // White background for code blocks
    lineNumberColor: '#aaaaaa', // Light gray for line numbers
    lineNumberBackground: '#f6f8fa', // Very light gray background for the line number gutter
    headerFooterColor: '#586069', // Medium gray for text in headers/footers
    headerFooterBackground: '#f6f8fa', // Match line number background for consistency
    borderColor: '#e1e4e8', // Light gray border color for separators and containers
    tokenColors: {
        comment: '#6a737d',    // Gray
        keyword: '#d73a49',    // Red
        string: '#032f62',     // Dark blue
        number: '#005cc5',     // Blue
        literal: '#005cc5',    // Blue (true, false, null)
        built_in: '#005cc5',   // Blue (console, Math, etc.)
        function: '#6f42c1',   // Purple (function definitions)
        title: '#6f42c1',      // Purple (function/class usage, important identifiers)
        class: '#6f42c1',      // Purple (class definitions)
        params: '#24292e',     // Default text color for parameters
        property: '#005cc5',   // Blue for object properties/member access
        operator: '#d73a49',   // Red
        punctuation: '#24292e',// Default text color
        tag: '#22863a',        // Green (HTML/XML tags)
        attr: '#6f42c1',       // Purple (HTML/XML attributes)
        variable: '#e36209',   // Orange (variables)
        regexp: '#032f62',     // Dark blue
    },
    fontStyles: {
        comment: 'italic',
    }
};

/**
 * Defines the 'dark' syntax highlighting theme, similar to GitHub's dark theme.
 */
const darkTheme: SyntaxTheme = {
    defaultColor: '#c9d1d9', // Light gray default text
    backgroundColor: '#0d1117', // Very dark background for code blocks
    lineNumberColor: '#8b949e', // Medium gray for line numbers
    lineNumberBackground: '#161b22', // Slightly lighter dark background for the gutter
    headerFooterColor: '#8b949e', // Medium gray for text in headers/footers
    headerFooterBackground: '#161b22', // Match line number background
    borderColor: '#30363d', // Darker gray border color
    tokenColors: {
        comment: '#8b949e',    // Medium gray
        keyword: '#ff7b72',    // Light red/coral
        string: '#a5d6ff',     // Light blue
        number: '#79c0ff',     // Bright blue
        literal: '#79c0ff',    // Bright blue
        built_in: '#79c0ff',   // Bright blue
        function: '#d2a8ff',   // Light purple
        title: '#d2a8ff',      // Light purple
        class: '#d2a8ff',      // Light purple
        params: '#c9d1d9',     // Default text color
        property: '#79c0ff',   // Bright blue
        operator: '#ff7b72',   // Light red/coral
        punctuation: '#c9d1d9',// Default text color
        tag: '#7ee787',        // Light green
        attr: '#d2a8ff',       // Light purple
        variable: '#ffa657',   // Light orange
        regexp: '#a5d6ff',     // Light blue
    },
    fontStyles: {
        comment: 'italic',
    }
};

// Add more themes here following the SyntaxTheme interface
// e.g., const solarizedLightTheme: SyntaxTheme = { ... };

/**
 * A record mapping theme names (lowercase) to their corresponding SyntaxTheme objects.
 * Used to look up themes based on the command-line option.
 */
export const themes: Record<string, SyntaxTheme> = {
    light: lightTheme,
    dark: darkTheme,
    // Add other themes here:
    // solarized: solarizedLightTheme,
};

/**
 * Retrieves the theme object for a given theme name.
 * Falls back to the 'light' theme if the requested theme name is not found.
 * @param themeName The name of the theme requested (case-insensitive).
 * @returns The corresponding SyntaxTheme object.
 */
export function getTheme(themeName: string): SyntaxTheme {
    // Normalize the input name (lowercase, default to 'light' if null/undefined)
    const normalizedName = themeName?.toLowerCase() || 'light';
    const theme = themes[normalizedName];

    // Check if the theme exists
    if (!theme) {
        // Log a warning if the theme wasn't found and we're falling back
        console.warn(`[Theme Warning] Theme "${themeName}" not found. Available themes: ${Object.keys(themes).join(', ')}. Falling back to "light" theme.`);
        return themes.light; // Return the default light theme
    }
    return theme; // Return the found theme
}

