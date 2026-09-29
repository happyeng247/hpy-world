import path from 'node:path';
import { loadConfig, defaultDataDir } from './config.mjs';

if (!process.env.APP_PASSCODE) {
  console.error('Set APP_PASSCODE for this command to configure or change the passcode.');
  process.exitCode = 1;
} else {
  const dataDir = path.resolve(process.env.DATA_DIR || defaultDataDir);
  await loadConfig({ dataDir, passcode: process.env.APP_PASSCODE, resetPasscode: true });
  console.log(`Private storage configured in ${dataDir}. Keep this directory private and back it up together.`);
}
