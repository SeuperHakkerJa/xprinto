import path from 'path';
import fs from 'fs-extra'; // Using fs-extra for convenience like pathExists
import { glob } from 'glob';
import ignore, { Ignore } from 'ignore';
import { logger } from './utils/logger';
import { FileInfo } from './utils/types';

// List of common binary file extensions (can be expanded)
const BINARY_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp',
    'mp3', 'wav', 'ogg', 'flac',
    'mp4', 'avi', 'mov', 'wmv', 'mkv',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'rar', 'gz', 'tar', '7z',
    'exe', 'dll', 'so', 'dylib', 'app',
    'o', 'a', 'obj',
    'jar', 'class',
    'pyc',
    'lock', // Lock files
    'log', // Log files often not needed
    'svg', // Sometimes treated as code, sometimes as binary asset
    // Add more as needed
]);

// Files to always ignore regardless of .gitignore
const ALWAYS_IGNORE = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/dist/**', // Common build output directory
    '**/build/**', // Common build output directory
    '**/coverage/**', // Coverage reports
];

/**
 * Finds relevant code files in a directory, respecting .gitignore.
 * @param repoPath The absolute path to the repository root.
 * @returns A promise resolving to an array of FileInfo objects.
 */
export async function findCodeFiles(repoPath: string): Promise<FileInfo[]> {
    logger.info(`Scanning directory: ${repoPath}`);

    // 1. Initialize ignore instance and add always-ignored patterns
    const ig = ignore().add(ALWAYS_IGNORE);

    // 2. Find and load .gitignore files
    const gitignoreFiles = await glob('**/.gitignore', {
        cwd: repoPath,
        absolute: true,
        dot: true, // Include dotfiles like .gitignore
        ignore: ['**/node_modules/**', '**/.git/**'], // Avoid searching in these
    });

    for (const gitignorePath of gitignoreFiles) {
        try {
            if (await fs.pathExists(gitignorePath)) {
                const content = await fs.readFile(gitignorePath, 'utf-8');
                const relativeDir = path.dirname(path.relative(repoPath, gitignorePath));
                // Add patterns relative to the .gitignore file's location
                ig.add(content.split(/\r?\n/).map(line => {
                    // Handle patterns relative to the .gitignore location
                    if (line.trim() && !line.startsWith('#')) {
                        // If pattern doesn't start with '/', make it relative to the dir
                        if (!line.startsWith('/') && relativeDir !== '.') {
                             // Prepend directory path if pattern is not absolute within gitignore context
                            if (!line.startsWith('!')) { // Handle negations separately
                                return path.join(relativeDir, line).replace(/\\/g, '/');
                            } else {
                                // For negated patterns, keep them relative but adjust path
                                return '!' + path.join(relativeDir, line.substring(1)).replace(/\\/g, '/');
                            }
                        }
                        return line;
                    }
                    return ''; // Ignore empty lines/comments
                }).filter(Boolean)); // Filter out empty strings
                logger.debug(`Loaded .gitignore: ${gitignorePath}`);
            }
        } catch (error) {
            logger.warn(`Failed to read or parse .gitignore file ${gitignorePath}: ${(error as Error).message}`);
        }
    }

    // 3. Find all files using glob initially (excluding directories)
    const allFiles = await glob('**/*', {
        cwd: repoPath,
        absolute: true,
        nodir: true, // Only files, not directories
        dot: true, // Include dotfiles (like .eslintrc, .prettierrc)
        follow: false, // Don't follow symlinks to avoid potential loops/issues
        ignore: ['**/node_modules/**', '**/.git/**'], // Basic ignore for performance
    });

    logger.info(`Found ${allFiles.length} total files initially.`);

    // 4. Filter files
    const includedFiles: FileInfo[] = [];
    for (const absolutePath of allFiles) {
        const relativePath = path.relative(repoPath, absolutePath).replace(/\\/g, '/'); // Use forward slashes

        // Skip if ignored by .gitignore rules or always-ignore list
        if (ig.ignores(relativePath)) {
            logger.debug(`Ignoring (gitignore): ${relativePath}`);
            continue;
        }

        // Skip binary files based on extension
        const extension = path.extname(absolutePath).substring(1).toLowerCase();
        if (BINARY_EXTENSIONS.has(extension)) {
            logger.debug(`Ignoring (binary extension): ${relativePath}`);
            continue;
        }

        // Skip potentially very large files (e.g., > 5MB) - adjust as needed
        try {
            const stats = await fs.stat(absolutePath);
            if (stats.size > 5 * 1024 * 1024) {
                logger.warn(`Ignoring (large file > 5MB): ${relativePath}`);
                continue;
            }
        } catch (error) {
            logger.warn(`Could not get stats for ${relativePath}: ${(error as Error).message}`);
            continue; // Skip if stats fail
        }

        // If we reach here, include the file
        try {
            const content = await fs.readFile(absolutePath, 'utf-8');
            // Basic check for binary content (presence of null bytes) - might need refinement
             if (content.includes('\u0000')) {
                 logger.debug(`Ignoring (likely binary content): ${relativePath}`);
                 continue;
             }

            includedFiles.push({
                absolutePath,
                relativePath,
                content,
                extension,
                language: '', // Language will be detected later
            });
        } catch (error) {
            // Might fail if it's not UTF-8, likely binary
            logger.warn(`Could not read file ${relativePath} as UTF-8 (skipping): ${(error as Error).message}`);
        }
    }

    logger.success(`Found ${includedFiles.length} relevant code files to include.`);
    return includedFiles;
}
