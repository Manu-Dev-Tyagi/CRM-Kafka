#!/usr/bin/env node

const http = require('http');
const { exec } = require('child_process');

const services = [
  { name: 'Backend', url: 'http://localhost:3000/health', port: 3000 },
  { name: 'Vendor Simulator', url: 'http://localhost:3001/health', port: 3001 },
  { name: 'Frontend', url: 'http://localhost:3002', port: 3002 }
];

const checkService = (service) => {
  return new Promise((resolve) => {
    const req = http.get(service.url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${service.name}: UP (${res.statusCode})`);
          resolve(true);
        } else {
          console.log(`❌ ${service.name}: DOWN (${res.statusCode})`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${service.name}: DOWN (${err.message})`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log(`❌ ${service.name}: TIMEOUT`);
      req.destroy();
      resolve(false);
    });
  });
};

const checkDocker = () => {
  return new Promise((resolve) => {
    exec('docker-compose ps', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Docker Compose: NOT RUNNING');
        console.log('   Please start Docker and run: docker-compose up -d');
        resolve(false);
      } else {
        console.log('✅ Docker Compose: RUNNING');
        console.log(stdout);
        resolve(true);
      }
    });
  });
};

const main = async () => {
  console.log('🔍 Testing Mini CRM Setup...\n');

  // Check Docker first
  const dockerRunning = await checkDocker();
  
  if (!dockerRunning) {
    console.log('\n❌ Setup test failed: Docker not running');
    process.exit(1);
  }

  console.log('\n📡 Checking services...\n');

  // Check all services
  const results = await Promise.all(services.map(checkService));
  const allUp = results.every(result => result);

  console.log('\n📊 Test Results:');
  if (allUp) {
    console.log('✅ All services are running correctly!');
    console.log('\n🌐 Access URLs:');
    console.log('   Backend API: http://localhost:3000');
    console.log('   Vendor Sim: http://localhost:3001');
    console.log('   Frontend: http://localhost:3002');
    console.log('   MongoDB: localhost:27017');
    console.log('   Redpanda: localhost:19092');
  } else {
    console.log('❌ Some services are not running');
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure Docker is running');
    console.log('   2. Run: docker-compose up -d');
    console.log('   3. Wait a few minutes for services to start');
    console.log('   4. Check logs: docker-compose logs');
  }

  process.exit(allUp ? 0 : 1);
};

main().catch(console.error);
