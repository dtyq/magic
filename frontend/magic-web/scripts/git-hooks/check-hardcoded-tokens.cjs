#!/usr/bin/env node

/**
 * Pre-commit script to detect hardcoded tokens/credentials
 * Prevents accidental commits of sensitive data
 */

const { execSync } = require('child_process')
const path = require('path')

// Token patterns to detect
const TOKEN_PATTERNS = [
    {
        name: 'JWT Token',
        // Matches JWT format: eyJ...eyJ...signature or eyJ...=.eyJ...=.signature
        // Supports both standard and base64-padded formats
        regex: /["'`]eyJ[A-Za-z0-9_=+-]{20,}\.eyJ[A-Za-z0-9_=+-]{20,}\.[A-Za-z0-9_=+-]{20,}["'`]/g,
        description: 'JWT tokens (eyJ...)',
        minLength: 100, // JWT tokens are typically very long
    },
    {
        name: 'Bearer Token',
        // Matches Bearer token patterns
        regex: /["'`]Bearer\s+[A-Za-z0-9_-]{32,}["'`]/gi,
        description: 'Bearer authentication tokens',
    },
    {
        name: 'API Key',
        // Matches common API key patterns (long alphanumeric strings)
        regex: /["'`][A-Za-z0-9]{32,}["'`]/g,
        description: 'Long alphanumeric strings (potential API keys)',
        minLength: 50, // Reduce false positives
    },
    {
        name: 'Base64 Credentials',
        // Matches base64 encoded credentials patterns
        // Excludes strings starting with common path prefixes
        regex: /["'`](?!\/api\/|\/v\d+\/|http|\.\/|\.\.\/)[A-Za-z0-9+/]{40,}={0,2}["'`]/g,
        description: 'Base64 encoded strings',
        minLength: 50,
    },
]

// Files/patterns to ignore
const IGNORE_PATTERNS = [
    'node_modules/',
    'dist/',
    'coverage/',
    'build/',
    '.git/',
    '*.min.js',
    '*.bundle.js',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
    '*.test.ts',
    '*.test.tsx',
    '*.spec.ts',
    '*.spec.tsx',
]

// Whitelist: files that are known to contain test data or examples
const WHITELIST_FILES = [
    // Add specific files that should be excluded from checks
    'scripts/git-hooks/check-hardcoded-tokens.cjs', // This file itself
]

/**
 * Get list of staged files
 */
function getStagedFiles() {
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
            encoding: 'utf-8',
        })
        return output
            .split('\n')
            .filter(Boolean)
            .filter((file) => {
                // Filter by extension (only check source files)
                const ext = path.extname(file)
                return ['.ts', '.tsx', '.js', '.jsx', '.vue', '.json'].includes(ext)
            })
            .filter((file) => {
                // Apply ignore patterns
                return !IGNORE_PATTERNS.some((pattern) => file.includes(pattern.replace('*', '')))
            })
            .filter((file) => {
                // Apply whitelist
                return !WHITELIST_FILES.some((whitelistFile) => file.includes(whitelistFile))
            })
    } catch (error) {
        console.error('Error getting staged files:', error.message)
        return []
    }
}

/**
 * Get file content from git staging area
 */
function getStagedFileContent(file) {
    try {
        return execSync(`git show :${file}`, { encoding: 'utf-8' })
    } catch (error) {
        // File might be new and not in index yet
        try {
            const fs = require('fs')
            return fs.readFileSync(file, 'utf-8')
        } catch (readError) {
            console.error(`Error reading file ${file}:`, readError.message)
            return ''
        }
    }
}

/**
 * Check if a line is a comment
 */
function isCommentLine(line, lineNumber, allLines) {
    const trimmed = line.trim()

    // Single line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
        return true
    }

    // Multi-line comments
    let inBlockComment = false
    for (let i = 0; i < lineNumber; i++) {
        const prevLine = allLines[i].trim()
        if (prevLine.includes('/*')) inBlockComment = true
        if (prevLine.includes('*/')) inBlockComment = false
    }

    return inBlockComment || trimmed.includes('/*') || trimmed.includes('*/')
}

/**
 * Check a file for hardcoded tokens
 */
function checkFile(file) {
    const content = getStagedFileContent(file)
    if (!content) return { hasIssues: false, issues: [] }

    const lines = content.split('\n')
    const issues = []

    TOKEN_PATTERNS.forEach((pattern) => {
        let match

        // Reset regex lastIndex
        pattern.regex.lastIndex = 0

        while ((match = pattern.regex.exec(content)) !== null) {
            // Find line number
            const beforeMatch = content.substring(0, match.index)
            const lineNumber = beforeMatch.split('\n').length

            const line = lines[lineNumber - 1]

            // Skip if it's a comment (likely false positive)
            if (isCommentLine(line, lineNumber - 1, lines)) {
                continue
            }

            // Skip if token is too short (reduce false positives)
            if (pattern.minLength && match[0].length < pattern.minLength) {
                continue
            }

            // Skip if it's in a return statement with a mock/test indicator
            if (
                line.includes('return') &&
                (line.toLowerCase().includes('mock') ||
                    line.toLowerCase().includes('test') ||
                    line.toLowerCase().includes('example'))
            ) {
                continue
            }

            issues.push({
                pattern: pattern.name,
                description: pattern.description,
                line: lineNumber,
                content: line.trim(),
                match: match[0].substring(0, 60) + '...', // Preview first 60 chars
            })
        }
    })

    return {
        hasIssues: issues.length > 0,
        issues,
    }
}

/**
 * Main execution
 */
function main() {
    console.log('🔍 Checking for hardcoded tokens and credentials...\n')

    const stagedFiles = getStagedFiles()

    if (stagedFiles.length === 0) {
        console.log('✅ No relevant staged files to check')
        return 0
    }

    console.log(`Checking ${stagedFiles.length} file(s)...\n`)

    let hasIssues = false
    const fileIssues = []

    stagedFiles.forEach((file) => {
        const result = checkFile(file)
        if (result.hasIssues) {
            hasIssues = true
            fileIssues.push({ file, issues: result.issues })
        }
    })

    if (hasIssues) {
        console.error('❌ Hardcoded tokens/credentials detected:\n')

        fileIssues.forEach(({ file, issues }) => {
            console.error(`📄 ${file}`)
            issues.forEach((issue) => {
                console.error(`   Line ${issue.line}: ${issue.pattern}`)
                console.error(`   ${issue.content}`)
                console.error(`   Match: ${issue.match}`)
                console.error('')
            })
        })

        console.error('⚠️  Please remove hardcoded tokens before committing.')
        console.error('💡 Consider using environment variables or secure configuration.')
        console.error('')
        console.error('If this is a false positive, you can:')
        console.error('  1. Add the file to WHITELIST_FILES in scripts/git-hooks/check-hardcoded-tokens.cjs')
        console.error('  2. Use git commit --no-verify (use with caution!)')
        console.error('')

        return 1
    }

    console.log('✅ No hardcoded tokens detected\n')
    return 0
}

// Run the check
const exitCode = main()
process.exit(exitCode)

