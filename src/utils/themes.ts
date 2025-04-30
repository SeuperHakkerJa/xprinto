import { SyntaxTheme } from './types';

// Define color themes here
// Using common hex color codes

const lightTheme: SyntaxTheme = {
    defaultColor: '#24292e', // GitHub default text
    backgroundColor: '#ffffff', // White background
    lineNumberColor: '#aaaaaa', // Light gray line numbers
    lineNumberBackground: '#f6f8fa', // Very light gray background for numbers
    headerFooterColor: '#586069', // Gray for header/footer text
    headerFooterBackground: '#f6f8fa', // Match line number background
    borderColor: '#e1e4e8', // Light border color
    tokenColors: {
        comment: '#6a737d',    // Gray
        keyword: '#d73a49',    // Red
        string: '#032f62',     // Dark blue
        number: '#005cc5',     // Blue
        literal: '#005cc5',    // Blue (true, false, null)
        built_in: '#005cc5',   // Blue (console, Math, etc.)
        function: '#6f42c1',   // Purple (function definitions)
        title: '#6f42c1',      // Purple (function/class usage)
        class: '#6f42c1',      // Purple (class definitions)
        params: '#24292e',     // Default text color for params
        property: '#005cc5',   // Blue for object properties
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

const darkTheme: SyntaxTheme = {
    defaultColor: '#c9d1d9', // Light gray default text
    backgroundColor: '#0d1117', // Very dark background
    lineNumberColor: '#8b949e', // Medium gray line numbers
    lineNumberBackground: '#161b22', // Slightly lighter dark background
    headerFooterColor: '#8b949e', // Medium gray for header/footer
    headerFooterBackground: '#161b22', // Match line number background
    borderColor: '#30363d', // Dark border color
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

// Add more themes here (e.g., solarized, monokai)

export const themes: Record<string, SyntaxTheme> = {
    light: lightTheme,
    dark: darkTheme,
    // Add other themes here
};

export function getTheme(themeName: string): SyntaxTheme {
    return themes[themeName.toLowerCase()] || themes.light; // Default to light theme
}
