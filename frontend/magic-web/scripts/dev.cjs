#!/usr/bin/env node

/**
 * Development script
 * Syncs theme RGB tokens, runs icon generation, and starts dev servers
 */

const { spawn } = require('child_process')
const path = require('path')

// Color codes for output
const colors = {
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}`))
      } else {
        resolve()
      }
    })

    child.on('error', reject)
  })
}

async function main() {
  try {
    log('Starting development environment...', 'green')

    // Sync theme RGB tokens first
    log('Syncing theme RGB tokens...', 'cyan')
    await runCommand('pnpm', ['run', 'generate:theme-rgb-tokens'])
    log('Theme RGB tokens synced successfully', 'green')

    // Generate icon tags first
    log('Generating icon tags...', 'cyan')
    await runCommand('node', ['scripts/icons/gen-tabler-icon-tags.cjs'])
    log('Icon tags generated successfully', 'green')

    // Start concurrently with both dev servers
    log('Starting dev servers...', 'cyan')
    await runCommand(
      'concurrently',
      [
        '"vite"',
        '"pnpm dev:iframe"',
        '--names',
        '"main,iframe"',
        '--prefix-colors',
        '"cyan,yellow"',
      ],
      { stdio: 'inherit' }
    )
  } catch (error) {
    log(`Error: ${error.message}`, 'red')
    process.exit(1)
  }
}

main()
