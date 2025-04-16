#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { generatePdfFromPath } from './pdf/generator';
import { log, LogLevel } from './utils/logger';

const program = new Command();

program
  .name('xprinto')
  .description('Convert code to beautiful PDFs with syntax highlighting')
  .version('1.0.0')
  .argument('<path>', 'File or directory path to convert')
  .option('-o, --output <path>', 'Output path for the PDF', './output.pdf')
  .option('-t, --title <title>', 'Title for the PDF document', 'Code Documentation')
  .option('--theme <theme>', 'Syntax highlighting theme', 'github')
  .option('--font-size <size>', 'Font size for code', '10')
  .option('--line-numbers', 'Show line numbers', true)
  .option('--no-line-numbers', 'Hide line numbers')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (inputPath: string, options) => {
    try {
      // Set log level based on verbose flag
      if (options.verbose) {
        log('Verbose mode enabled', LogLevel.INFO);
      }
      
      // Resolve input path
      const resolvedPath = path.resolve(inputPath);
      
      // Check if path exists
      if (!fs.existsSync(resolvedPath)) {
        log(`Path does not exist: ${resolvedPath}`, LogLevel.ERROR);
        process.exit(1);
      }
      
      // Generate PDF
      log(`Converting ${resolvedPath} to PDF...`, LogLevel.INFO);
      await generatePdfFromPath(
        resolvedPath, 
        options.output, 
        {
          title: options.title,
          theme: options.theme,
          fontSize: parseInt(options.fontSize, 10),
          showLineNumbers: options.lineNumbers
        }
      );
      
      log(`PDF generated successfully: ${options.output}`, LogLevel.SUCCESS);
    } catch (err) {
      log(`Error: ${(err as Error).message}`, LogLevel.ERROR);
      process.exit(1);
    }
  });

program.parse();