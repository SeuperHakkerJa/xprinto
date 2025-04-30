# codepdf 📄✨

[![npm version](https://badge.fury.io/js/codepdf.svg)](https://badge.fury.io/js/codepdf) 

Convert code repositories or directories into beautifully formatted PDF documents with syntax highlighting, line numbers, and a table of contents. Ideal for code reviews, documentation, or offline reading.

## Description

`codepdf` is a command-line tool that scans a given directory, identifies code files, applies syntax highlighting, and generates a clean, readable PDF document. It's designed to help document codebases, share code snippets, or create offline references.

## Features

* **Automatic File Discovery:** Scans directories recursively, respecting `.gitignore` rules and common exclusion patterns (like `node_modules`, `.git`).
* **Language Detection:** Automatically detects the programming language for syntax highlighting.
* **Syntax Highlighting:** Uses `highlight.js` to provide highlighting for numerous languages.
* **Theming:** Supports customizable themes (e.g., 'light', 'dark') for code appearance.
* **PDF Generation:** Creates well-structured PDFs using `pdfkit`.
* **Customization:** Offers options for:
    * Output filename.
    * PDF Title.
    * Code font size.
    * Line numbers (optional).
    * Paper size (A4, Letter, custom).
    * Cover page.
    * Table of Contents (for multiple files).
    * Headers with file paths and footers with page numbers.


## Example Usage


```bash
# Process the current directory using npx
npx codepdf . -o report.pdf --theme dark

# Process another directory
npx codepdf ~/my-project -o project.pdf -f 8
```
