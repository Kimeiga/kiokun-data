#!/usr/bin/env node
/**
 * Development script that reads the CORS server port and starts Vite with it
 * 
 * This script:
 * 1. Waits for the CORS server to write its port to .cors_port
 * 2. Reads the port number
 * 3. Starts Vite with VITE_CORS_PORT environment variable set
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync, watchFile } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT_FILE = join(__dirname, '../../output_dictionary/.cors_port');
const MAX_WAIT_TIME = 10000; // 10 seconds
const CHECK_INTERVAL = 100; // 100ms

/**
 * Wait for the port file to exist and read the port
 */
async function waitForPort() {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkPort = () => {
      if (existsSync(PORT_FILE)) {
        try {
          const port = readFileSync(PORT_FILE, 'utf-8').trim();
          console.log(`✅ Found CORS server port: ${port}`);
          resolve(port);
        } catch (err) {
          console.error('❌ Error reading port file:', err);
          reject(err);
        }
      } else if (Date.now() - startTime > MAX_WAIT_TIME) {
        console.error('❌ Timeout waiting for CORS server to start');
        reject(new Error('Timeout waiting for CORS server'));
      } else {
        setTimeout(checkPort, CHECK_INTERVAL);
      }
    };
    
    checkPort();
  });
}

/**
 * Start Vite with the CORS port as an environment variable
 */
function startVite(port) {
  console.log(`🚀 Starting Vite with CORS port ${port}...`);
  
  const vite = spawn('vite', ['dev'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      VITE_CORS_PORT: port
    }
  });
  
  vite.on('error', (err) => {
    console.error('❌ Failed to start Vite:', err);
    process.exit(1);
  });
  
  vite.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    vite.kill('SIGINT');
  });
}

// Main execution
(async () => {
  try {
    console.log('⏳ Waiting for CORS server to start...');
    const port = await waitForPort();
    startVite(port);
  } catch (err) {
    console.error('❌ Failed to start development server:', err);
    process.exit(1);
  }
})();

