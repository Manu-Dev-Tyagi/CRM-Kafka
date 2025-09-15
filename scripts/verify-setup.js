#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Mini CRM Setup...\n');

const requiredFiles = [
  'backend/package.json',
  'backend/src/index.js',
  'backend/Dockerfile',
  'workers/package.json',
  'workers/src/index.js',
  'workers/Dockerfile',
  'vendor-sim/package.json',
  'vendor-sim/src/index.js',
  'vendor-sim/Dockerfile',
  'frontend/package.json',
  'frontend/src/pages/index.js',
  'frontend/Dockerfile',
  'docker-compose.yml',
  'README.md',
  'scripts/mongo-init.js'
];

const requiredDirs = [
  'backend',
  'workers',
  'vendor-sim',
  'frontend',
  'scripts'
];

let allGood = true;

// Check directories
console.log('📁 Checking directories...');
requiredDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`❌ ${dir}/ - MISSING`);
    allGood = false;
  }
});

// Check files
console.log('\n📄 Checking files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allGood = false;
  }
});

// Check package.json dependencies
console.log('\n📦 Checking package.json files...');
const services = ['backend', 'workers', 'vendor-sim', 'frontend'];
services.forEach(service => {
  const packagePath = path.join(service, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      console.log(`✅ ${service}/package.json - ${pkg.name} v${pkg.version}`);
    } catch (err) {
      console.log(`❌ ${service}/package.json - INVALID JSON`);
      allGood = false;
    }
  }
});

// Check environment files
console.log('\n🔧 Checking environment files...');
services.forEach(service => {
  const envExample = path.join(service, '.env.example');
  if (fs.existsSync(envExample)) {
    console.log(`✅ ${service}/.env.example`);
  } else {
    console.log(`❌ ${service}/.env.example - MISSING`);
    allGood = false;
  }
});

console.log('\n📊 Setup Verification Results:');
if (allGood) {
  console.log('✅ All required files and directories are present!');
  console.log('\n🚀 Next steps:');
  console.log('   1. Copy .env.example files to .env in each service');
  console.log('   2. Configure your environment variables');
  console.log('   3. Start Docker: docker-compose up -d');
  console.log('   4. Test setup: node scripts/test-setup.js');
  console.log('\n🌐 Service URLs (when running):');
  console.log('   Backend API: http://localhost:3000');
  console.log('   Vendor Sim: http://localhost:3001');
  console.log('   Frontend: http://localhost:3002');
} else {
  console.log('❌ Setup verification failed!');
  console.log('   Please check the missing files and directories above.');
}

process.exit(allGood ? 0 : 1);
