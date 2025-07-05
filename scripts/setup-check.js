#!/usr/bin/env node

/**
 * Setup verification script
 * Checks if all required tools and dependencies are available
 */
const { execSync } = require('child_process');
const { existsSync } = require('fs');

function checkCommand(command, name) {
  try {
    execSync(command, { stdio: 'ignore' });
    console.log(`✅ ${name} is available`);
    return true;
  } catch (error) {
    console.log(`❌ ${name} is not available`);
    return false;
  }
}

function checkFile(path, name) {
  if (existsSync(path)) {
    console.log(`✅ ${name} exists`);
    return true;
  } else {
    console.log(`❌ ${name} does not exist`);
    return false;
  }
}

console.log('🔍 Checking setup requirements...\n');

// Check required commands
const checks = [
  checkCommand('node --version', 'Node.js'),
  checkCommand('npm --version', 'npm'),
  checkCommand('docker --version', 'Docker'),
  checkCommand('docker-compose --version', 'Docker Compose'),
];

// Check required files
checks.push(
  checkFile('package.json', 'package.json'),
  checkFile('docker-compose.yml', 'docker-compose.yml')
);

console.log('\n📋 Setup Summary:');
const passed = checks.filter(Boolean).length;
const total = checks.length;

if (passed === total) {
  console.log(`✅ All checks passed (${passed}/${total})`);
  console.log('\n🚀 Ready to start development!');
  console.log('Next steps:');
  console.log('1. npm run localstack:start');
  console.log('2. npm run deploy:local');
} else {
  console.log(`❌ ${total - passed} checks failed (${passed}/${total})`);
  console.log('\n🔧 Please fix the issues above before proceeding.');
}
