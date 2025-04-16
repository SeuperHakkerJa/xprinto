import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob'; // Updated import statement
import { log, LogLevel } from './utils/logger';

// Interface for file content
export interface FileInfo {
  path: string;
  relativePath: string;
  content: string;
  extension: string;
}

// Function to read a single file
export async function readFile(filePath: string, rootPath?: string): Promise<FileInfo> {
  const content = await fs.readFile(filePath, 'utf-8');
  const relativePath = rootPath ? path.relative(rootPath, filePath) : path.basename(filePath);
  const extension = path.extname(filePath).substring(1); // Remove the dot
  
  return {
    path: filePath,
    relativePath,
    content,
    extension
  };
}

// Function to read files from a directory recursively
export async function readDirectory(dirPath: string): Promise<FileInfo[]> {
  // Get all files in the directory and subdirectories - updated to use async/await with glob
  const files = await glob('**/*.*', {
    cwd: dirPath,
    nodir: true,
    ignore: ['**/node_modules/**', '**/.git/**'] // Ignore node_modules and .git
  });
  
  log(`Found ${files.length} files in directory ${dirPath}`, LogLevel.INFO);
  
  // Read all files
  const fileInfos: FileInfo[] = [];
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const fileInfo = await readFile(filePath, dirPath);
      fileInfos.push(fileInfo);
    } catch (err) {
      log(`Error reading file ${filePath}: ${(err as Error).message}`, LogLevel.ERROR);
    }
  }
  
  return fileInfos;
}

// Function to read from either a file or directory
export async function readPath(inputPath: string): Promise<FileInfo[]> {
  const stats = await fs.stat(inputPath);
  
  if (stats.isFile()) {
    const fileInfo = await readFile(inputPath);
    return [fileInfo];
  } else if (stats.isDirectory()) {
    return readDirectory(inputPath);
  } else {
    throw new Error(`Invalid path: ${inputPath} is neither a file nor a directory`);
  }
}