// This script wraps the real test execution for ease of use
// It sets ADB_PATH and invokes the test file
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADB_PATH = process.env.ADB_PATH || process.env.ADB || 'adb';
const TEST_FILE = path.join(__dirname, 'wait_for_element_real.js');

// Merge ADB_PATH into the child environment if provided
const childEnv = { ...process.env, ADB_PATH };

// Use NODE to execute the JS test by default, or respect RUNNER env if set (e.g., 'npx tsx')
const runner = process.env.RUNNER || 'node';
const runnerArgs = [TEST_FILE];

const child = spawn(runner, runnerArgs, {
    env: childEnv,
    stdio: 'inherit'
});
child.on('exit', (code) => {
    process.exit(code || 0);
});
