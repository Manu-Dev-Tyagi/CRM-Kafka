#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const services = [
  { name: 'Backend', dir: 'backend', command: 'npm', args: ['run', 'dev'] },
  { name: 'Workers', dir: 'workers', command: 'npm', args: ['run', 'dev'] },
  { name: 'Vendor Sim', dir: 'vendor-sim', command: 'npm', args: ['run', 'dev'] },
  { name: 'Frontend', dir: 'frontend', command: 'npm', args: ['run', 'dev'] }
];

const processes = [];

const startService = (service) => {
  console.log(`🚀 Starting ${service.name}...`);
  
  const child = spawn(service.command, service.args, {
    cwd: path.join(__dirname, '..', service.dir),
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (err) => {
    console.error(`❌ Failed to start ${service.name}:`, err.message);
  });

  child.on('exit', (code) => {
    console.log(`📴 ${service.name} exited with code ${code}`);
  });

  processes.push({ name: service.name, process: child });
  return child;
};

const cleanup = () => {
  console.log('\n🛑 Shutting down services...');
  processes.forEach(({ name, process }) => {
    console.log(`Stopping ${name}...`);
    process.kill('SIGTERM');
  });
  
  setTimeout(() => {
    processes.forEach(({ name, process }) => {
      if (!process.killed) {
        console.log(`Force killing ${name}...`);
        process.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 5000);
};

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('🎯 Starting Mini CRM services locally...');
console.log('⚠️  Make sure MongoDB and Redpanda are running first!');
console.log('   MongoDB: Install and start locally (brew install mongodb-community && brew services start mongodb-community)');
console.log('   Redpanda: docker-compose up -d redpanda\n');

// Start all services
services.forEach(startService);

console.log('\n✅ All services started!');
console.log('🌐 Access URLs:');
console.log('   Backend API: http://localhost:3000');
console.log('   Vendor Sim: http://localhost:3001');
console.log('   Frontend: http://localhost:3002');
console.log('\nPress Ctrl+C to stop all services');
