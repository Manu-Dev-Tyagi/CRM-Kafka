# MongoDB Local Setup Guide

This guide will help you install and configure MongoDB locally for the Mini CRM project.

## Installation

### macOS (using Homebrew)

```bash
# Install MongoDB Community Edition
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB as a service
brew services start mongodb-community

# Stop MongoDB service (when needed)
brew services stop mongodb-community

# Check if MongoDB is running
brew services list | grep mongodb
```

### Linux (Ubuntu/Debian)

```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Windows

1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Run the installer and follow the setup wizard
3. MongoDB will be installed as a Windows service and start automatically

## Verification

After installation, verify MongoDB is running:

```bash
# Connect to MongoDB shell
mongosh

# Or connect directly to the mini_crm database
mongosh mini_crm

# Check MongoDB version
mongosh --version
```

## Database Setup

Once MongoDB is installed and running, initialize the Mini CRM database:

```bash
# From the project root directory
make setup-mongodb

# Or run the script directly
node scripts/setup-local-mongodb.js
```

This will:
- Create the `mini_crm` database
- Create all required collections (leads, orders, segments, campaigns, communication_logs, users)
- Set up indexes for optimal performance
- Apply data validation schemas

## Configuration

The application is configured to connect to MongoDB at:
- **Host**: localhost
- **Port**: 27017 (default)
- **Database**: mini_crm
- **Connection String**: `mongodb://localhost:27017/mini_crm`

## Troubleshooting

### MongoDB won't start

**macOS:**
```bash
# Check if MongoDB is already running
brew services list | grep mongodb

# Restart the service
brew services restart mongodb-community

# Check logs
tail -f /usr/local/var/log/mongodb/mongo.log
```

**Linux:**
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check logs
sudo journalctl -u mongod

# Restart MongoDB
sudo systemctl restart mongod
```

### Connection refused errors

1. Ensure MongoDB is running: `brew services list | grep mongodb` (macOS) or `sudo systemctl status mongod` (Linux)
2. Check if port 27017 is available: `lsof -i :27017`
3. Verify MongoDB is listening on localhost: `netstat -an | grep 27017`

### Permission issues

**macOS:**
```bash
# Fix data directory permissions
sudo chown -R $(whoami) /usr/local/var/mongodb
sudo chown -R $(whoami) /usr/local/var/log/mongodb
```

**Linux:**
```bash
# Fix data directory permissions
sudo chown -R mongodb:mongodb /var/lib/mongodb
sudo chown -R mongodb:mongodb /var/log/mongodb
```

## Data Directory

MongoDB stores data in the following locations:

- **macOS**: `/usr/local/var/mongodb`
- **Linux**: `/var/lib/mongodb`
- **Windows**: `C:\data\db`

## Backup and Restore

```bash
# Backup the mini_crm database
mongodump --db mini_crm --out ./backup

# Restore from backup
mongorestore --db mini_crm ./backup/mini_crm

# Export specific collection
mongoexport --db mini_crm --collection leads --out leads.json

# Import specific collection
mongoimport --db mini_crm --collection leads --file leads.json
```

## Security Notes

This setup is for development only. For production:

1. Enable authentication
2. Configure network access restrictions
3. Use SSL/TLS encryption
4. Set up proper user roles and permissions
5. Regular backups and monitoring

## Next Steps

After MongoDB is set up:

1. Start Redpanda: `docker-compose up -d redpanda`
2. Start the application: `make dev`
3. Verify everything is working: `curl http://localhost:3000/health`
