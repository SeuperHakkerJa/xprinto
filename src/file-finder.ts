import path from 'path';
import fs from 'fs-extra'; // Using fs-extra for convenience like pathExists, readFile, stat
import { glob } from 'glob';
import ignore, { Ignore } from 'ignore'; // Note: 'ignore' package includes its own types
import { logger } from './utils/logger';
import { FileInfo } from './utils/types';

/**
 * Set of common binary file extensions to exclude from processing.
 * This list can be expanded based on typical project structures.
 */
const BINARY_EXTENSIONS = new Set([
    // Images
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp', 'ico',
    // Audio
    'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
    // Video
    'mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm', 'flv',
    // Documents
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
    // Archives
    'zip', 'rar', 'gz', 'tar', '7z', 'bz2', 'xz', 'iso', 'dmg',
    // Executables & Libraries
    'exe', 'dll', 'so', 'dylib', 'app', 'msi', 'deb', 'rpm',
    // Compiled code / Intermediate files
    'o', 'a', 'obj', 'class', 'pyc', 'pyd', 'jar', 'war', 'ear',
    // Fonts
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    // Databases
    'db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'dump', 'sqlitedb',
    // Other common non-text files
    'lock', // Lock files (e.g., package-lock.json is text, but yarn.lock might be handled differently)
    'log', // Log files (often large and not source code)
    'svg', // Often treated as code, but can be large assets; exclude for safety unless needed
    'DS_Store', // macOS metadata
    'bin', // Generic binary extension
    'dat', // Generic data extension
    // Add more as needed
]);

/**
 * Glob patterns for files/directories to always ignore, regardless of .gitignore content.
 * Uses gitignore pattern syntax. Ensures common build artifacts, dependencies, and metadata are skipped.
 */
const ALWAYS_IGNORE = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.svn/**',
    '**/.hg/**',
    '**/.bzr/**',
    '**/.DS_Store',
    // Common build/output directories
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/target/**', // Java/Rust common target dir
    '**/.next/**', // Next.js build output
    '**/.nuxt/**', // Nuxt.js build output
    '**/.svelte-kit/**', // SvelteKit build output
    // Common dependency/cache directories
    '**/bower_components/**',
    '**/jspm_packages/**',
    '**/vendor/**', // PHP Composer, Go modules etc.
    '**/.cache/**',
    '**/.npm/**',
    '**/.yarn/**',
    // Common IDE/Editor directories
    '**/.vscode/**',
    '**/.idea/**',
    '**/*.swp', // Vim swap files
    '**/*.swo', // Vim swap files
    '**/.project', // Eclipse
    '**/.settings', // Eclipse
    '**/.classpath', // Eclipse
    // Common OS/Tooling files
    '**/Thumbs.db',
    '**/.env', // Environment variables often contain secrets
    '**/.env.*',
    // Common log/report directories
    '**/logs/**',
    '**/coverage/**',
    '**/report*/**', // Common report directories
];

/**
 * Checks if file content appears to be binary.
 * This is a heuristic based on the presence of null bytes, which are uncommon in UTF-8 text files.
 * @param content The file content as a string.
 * @returns True if the content likely contains binary data, false otherwise.
 */
function isLikelyBinary(content: string): boolean {
    // A simple check for the NULL character (\u0000).
    // While not foolproof, it catches many common binary file types.
    return content.includes('\u0000');
}

/**
 * Asynchronously reads and parses all relevant .gitignore files within a repository path.
 * Handles nested .gitignore files and correctly interprets paths relative to their location.
 * @param repoPath The absolute path to the repository root.
 * @param ig The `ignore` instance to add the loaded rules to.
 */
async function loadGitignoreRules(repoPath: string, ig: Ignore): Promise<void> {
    // Find all .gitignore files, excluding globally ignored directories for efficiency
    const gitignoreFiles = await glob('**/.gitignore', {
        cwd: repoPath,
        absolute: true,
        dot: true,
        ignore: ALWAYS_IGNORE,
        follow: false, // Do not follow symlinks
    });

    logger.debug(`Found ${gitignoreFiles.length} .gitignore files to process.`);

    // Process each found .gitignore file
    for (const gitignorePath of gitignoreFiles) {
        try {
            // Double-check existence in case glob found a broken link etc.
            if (await fs.pathExists(gitignorePath)) {
                const content = await fs.readFile(gitignorePath, 'utf-8');
                // Determine the directory of the .gitignore relative to the repo root
                const relativeDir = path.dirname(path.relative(repoPath, gitignorePath));

                // Parse lines, handling comments, empty lines, and path relativity
                const rules = content.split(/\r?\n/).map(line => {
                    const trimmedLine = line.trim();
                    // Ignore comments (#) and empty lines
                    if (!trimmedLine || trimmedLine.startsWith('#')) {
                        return ''; // Return empty string for filtering
                    }
                    // Handle paths relative to the .gitignore file's location
                    // If a pattern doesn't start with '/' and the .gitignore isn't in the root, prepend its directory.
                    // This matches standard gitignore behavior.
                    if (!trimmedLine.startsWith('/') && relativeDir !== '.') {
                        // Handle negation patterns ('!') correctly by prepending dir *after* the '!'
                        if (trimmedLine.startsWith('!')) {
                            // Use path.posix.join for consistent forward slashes
                            return '!' + path.posix.join(relativeDir, trimmedLine.substring(1));
                        } else {
                            return path.posix.join(relativeDir, trimmedLine);
                        }
                    }
                    // Use the line as is (it's absolute from repo root, or relativity handled)
                    // Ensure forward slashes for consistency with 'ignore' package expectations
                    return trimmedLine.replace(/\\/g, '/');
                }).filter(Boolean); // Remove empty strings from comments/blank lines

                // Add the parsed rules to the ignore instance
                if (rules.length > 0) {
                    ig.add(rules);
                    logger.debug(`Loaded ${rules.length} rules from: ${gitignorePath}`);
                }
            }
        } catch (error) {
            // Log errors reading/parsing specific gitignore files but continue processing others
            logger.warn(`Failed to read or parse .gitignore file ${gitignorePath}: ${(error as Error).message}`);
        }
    }
}

/**
 * Finds relevant code files within a given repository path.
 * It respects .gitignore rules, filters out binary files, skips overly large files,
 * and ignores common non-code directories/files.
 * @param repoPath The absolute path to the repository root directory.
 * @returns A promise resolving to an array of FileInfo objects for included files, sorted alphabetically.
 * @throws An error if the initial path cannot be accessed or is not a directory.
 */
export async function findCodeFiles(repoPath: string): Promise<FileInfo[]> {
    logger.info(`Scanning directory: ${repoPath}`);

    // --- 1. Validate repoPath ---
    try {
        const stats = await fs.stat(repoPath);
        if (!stats.isDirectory()) {
            // Throw a specific error if the path isn't a directory
            throw new Error(`Input path is not a directory: ${repoPath}`);
        }
    } catch (error) {
        logger.error(`Error accessing input path ${repoPath}: ${(error as Error).message}`);
        // Re-throw the error to halt execution if the path is invalid
        throw error;
    }

    // --- 2. Initialize ignore instance and load rules ---
    const ig = ignore();
    ig.add(ALWAYS_IGNORE); // Add global ignores first
    await loadGitignoreRules(repoPath, ig); // Load all .gitignore rules

    // --- 3. Find all potential files using glob ---
    // Use stat:true to get file size efficiently during globbing
    const allFilePaths = await glob('**/*', {
        cwd: repoPath,
        absolute: true,
        nodir: true, // Only files
        dot: true, // Include dotfiles
        follow: false, // Don't follow symlinks
        ignore: ['**/node_modules/**', '**/.git/**'], // Basic ignore for glob performance; main filtering is below
        stat: true, // Request stats object for size check
        withFileTypes: false, // Paths are sufficient with absolute:true and nodir:true
    });

    logger.info(`Found ${allFilePaths.length} total file system entries initially.`);

    // --- 4. Filter and process files ---
    const includedFiles: FileInfo[] = [];
    const fileSizeLimit = 10 * 1024 * 1024; // 10 MB limit (configurable?)

    // Process files potentially in parallel
    await Promise.all(allFilePaths.map(async (globResult) => {
        // The result from glob with stat:true is an object with a path property
        // However, type definitions might be simpler; cast or check type if needed.
        // For simplicity, assuming it returns path strings or objects easily usable.
        // Let's assume globResult is the path string here for clarity. Adjust if types differ.
        const absolutePath = globResult as string; // Adjust based on actual glob return type with stat:true
        const relativePath = path.relative(repoPath, absolutePath).replace(/\\/g, '/'); // Ensure forward slashes

        // --- Filtering Logic ---
        // a) Skip if ignored by .gitignore or global rules
        if (ig.ignores(relativePath)) {
            logger.debug(`Ignoring (gitignore/always): ${relativePath}`);
            return;
        }

        // b) Skip binary files based on extension
        const extension = path.extname(absolutePath).substring(1).toLowerCase();
        if (BINARY_EXTENSIONS.has(extension)) {
            logger.debug(`Ignoring (binary extension): ${relativePath}`);
            return;
        }

        // c) Read file content and perform content-based checks
        try {
            // Get stats (might be redundant if glob provides reliable stats)
            const stats = await fs.stat(absolutePath);

            // d) Skip overly large files
             if (stats.size > fileSizeLimit) {
                 logger.warn(`Ignoring (large file > ${fileSizeLimit / 1024 / 1024}MB): ${relativePath}`);
                 return;
             }
             // e) Skip empty files
             if (stats.size === 0) {
                 logger.debug(`Ignoring (empty file): ${relativePath}`);
                 return;
             }

            // f) Read content and check for binary markers
            const content = await fs.readFile(absolutePath, 'utf-8');
            if (isLikelyBinary(content)) {
                logger.debug(`Ignoring (likely binary content): ${relativePath}`);
                return;
            }

            // --- Add to included list ---
            // If all checks pass, create FileInfo object
            includedFiles.push({
                absolutePath,
                relativePath,
                content,
                extension,
                language: '', // Language detection is done later
            });
        } catch (error) {
            // Catch errors during stat or readFile (permissions, non-UTF8, etc.)
            logger.warn(`Could not read or process file ${relativePath} (skipping): ${(error as Error).message}`);
        }
    })); // End Promise.all map

    // --- 5. Sort results and return ---
    // Sort alphabetically by relative path for consistent PDF output order
    includedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    logger.success(`Found ${includedFiles.length} relevant text files to include in the PDF.`);
    return includedFiles;
}

