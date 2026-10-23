import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import puppeteer from 'puppeteer';

// Helper to clean up .wrangler/test-state directory safely using Recycle Bin on Windows
function cleanTestState() {
  const dirPath = path.resolve('.wrangler/test-state');
  if (fs.existsSync(dirPath)) {
    console.log(`♻️ Moving previous test state to Recycle Bin: ${dirPath}...`);
    try {
      const escapedPath = dirPath.replace(/'/g, "''");
      execSync(`powershell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${escapedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"` );
      console.log('✅ Previous test state directory moved to Recycle Bin.');
    } catch (e) {
      console.warn('⚠️ Warning: failed to move test-state to Recycle Bin:', e.message);
    }
  }
}

// Helper to wait for the local port to become active
async function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  console.log(`⏳ Waiting for local server on port ${port} to start...`);
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/api/auth/me`);
      // Any response (even 401 Unauthorized or 404) means the server is listening
      if (res.status) {
        console.log(`📡 Port ${port} is active (status: ${res.status}).`);
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Timeout: Server did not start on port ${port} within ${timeoutMs / 1000}s.`);
}

(async () => {
  let wranglerProcess = null;
  
  try {
    // 1. Build the frontend assets
    console.log('🔨 Step 1: Building frontend assets...');
    execSync('npm run build:local', { stdio: 'inherit' });

    // 2. Clean previous test D1 state directory
    cleanTestState();

    // 3. Initialize isolated D1 database schema
    console.log('💾 Step 2: Initializing isolated database schema...');
    execSync(
      'npx wrangler d1 execute mistake-notebook --local --file=./db/schema.sql --persist-to=.wrangler/test-state',
      { stdio: 'inherit' }
    );

    // 4. Start Wrangler Pages dev server on isolated port 8888
    console.log('🚀 Step 3: Starting Wrangler Pages dev server...');
    wranglerProcess = spawn(
      'npx',
      [
        'wrangler',
        'pages',
        'dev',
        'dist',
        '--port=8888',
        '--persist-to=.wrangler/test-state',
        '--compatibility-date=2024-04-01',
        '--show-interactive-dev-session=false'
      ],
      { shell: true, stdio: 'pipe' }
    );

    // Log Wrangler outputs to debug file or console if verbose
    wranglerProcess.stdout.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Ready on')) {
        console.log(`[Wrangler Log] ${text.trim()}`);
      }
    });

    wranglerProcess.stderr.on('data', (data) => {
      // Wrangler logs general info on stderr as well
      const text = data.toString();
      if (text.includes('Ready on') || text.includes('Error')) {
        console.log(`[Wrangler Log] ${text.trim()}`);
      }
    });

    // 5. Wait for the server to be ready
    await waitForPort(8888);

    // 6. Launch Puppeteer and execute E2E test files
    console.log('🌐 Step 4: Running E2E Test Suite via Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const testFiles = [
      './auth-admin.test.js',
      './feedback.test.js',
      './mistake-filter.test.js',
      './self-deletion.test.js',
      './sidebar-collapse.test.js',
      './real-world.test.js',
      './acceptance-16.test.js'
    ];

    const results = [];
    const baseUrl = 'http://localhost:8888';

    for (const file of testFiles) {
      console.log(`\n======================================`);
      console.log(`🏃 Executing: ${file}`);
      console.log(`======================================`);
      try {
        const testPath = path.resolve('tests/e2e', file);
        const module = await import(`file://${testPath}`);
        await module.default(browser, baseUrl);
        console.log(`✅ Passed: ${file}`);
        results.push({ file, success: true });
      } catch (err) {
        console.error(`❌ Failed: ${file}`);
        console.error(`Reason: ${err.message}`);
        results.push({ file, success: false, error: err.message });
      }
    }

    await browser.close();

    // 7. Print the final summary report
    console.log('\n==================================================');
    console.log('📊           E2E Test Execution Summary           ');
    console.log('==================================================');
    let failCount = 0;
    for (const r of results) {
      if (r.success) {
        console.log(`  🟢 ${r.file.padEnd(28)} : PASSED`);
      } else {
        console.log(`  🔴 ${r.file.padEnd(28)} : FAILED (${r.error})`);
        failCount++;
      }
    }
    console.log('==================================================');
    console.log(`Total: ${results.length} | Passed: ${results.length - failCount} | Failed: ${failCount}`);
    console.log('==================================================');

  } catch (error) {
    console.error('💥 Execution error during E2E testing run:', error);
  } finally {
    // 8. Clean teardown: Terminate Wrangler process tree
    if (wranglerProcess) {
      console.log('🛑 Step 5: Shutting down Wrangler dev server...');
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${wranglerProcess.pid} /f /t`);
        } else {
          wranglerProcess.kill('SIGKILL');
        }
        console.log('⚡ Wrangler process terminated.');
      } catch (e) {
        console.warn('⚠️ Warning: failed to kill wrangler process tree:', e.message);
      }
    }

    // 9. Post-run database workspace cleanup
    cleanTestState();
    console.log('🏁 E2E Test Suite Run Finished.');
  }
})();
