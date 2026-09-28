import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envExamplePath = path.join(__dirname, '.env.example');
const envPath = path.join(__dirname, '.env');
const dataDir = path.join(__dirname, 'data');

console.log('\n====================================================');
console.log('   Paystack-Stripe Gateway Beginner Setup 🚀');
console.log('====================================================\n');

// 1. Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 Created /data folder for local session storage.');
}

// 2. Check if .env exists
if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created your personal .env file from .env.example!');
    console.log('\n👉 NEXT STEP:');
    console.log('   1. Open the new ".env" file in your text editor (VS Code, Notepad, etc.).');
    console.log('   2. Paste your Paystack test keys:');
    console.log('      PAYSTACK_SECRET_KEY=sk_test_xxxx');
    console.log('      PAYSTACK_PUBLIC_KEY=pk_test_xxxx');
    console.log('      (Get them at: https://dashboard.paystack.com/#/settings/developer)');
    console.log('\n   3. Run: npm start');
  } else {
    console.error('❌ Error: .env.example file not found.');
  }
} else {
  console.log('ℹ️  Your ".env" file already exists.');
  const content = fs.readFileSync(envPath, 'utf8');
  if (content.includes('placeholder') || content.includes('your_paystack_secret_key_here')) {
    console.log('⚠️  Notice: Your .env is still using placeholder keys.');
    console.log('   Don\'t forget to add your real Paystack keys from:');
    console.log('   https://dashboard.paystack.com/#/settings/developer\n');
  } else {
    console.log('✅ Paystack keys appear to be configured in your .env file!\n');
  }
  console.log('Ready to run:');
  console.log('   npm start        -> Start the server');
  console.log('   npm run dev      -> Start with auto-reload');
  console.log('   Visit: http://localhost:3000/demo\n');
}

console.log('====================================================\n');
