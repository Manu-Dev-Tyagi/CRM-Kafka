# Mini CRM Makefile

.PHONY: help install start stop clean test health

help: ## Show this help message
	@echo "Mini CRM - Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies for all services
	@echo "Installing dependencies..."
	cd backend && npm install
	cd workers && npm install
	cd vendor-sim && npm install
	cd frontend && npm install

start: ## Start all services with Docker Compose
	@echo "Starting all services..."
	docker-compose up -d

start-infra: ## Start only infrastructure (Redpanda)
	@echo "Starting infrastructure..."
	docker-compose up -d redpanda

start-services: ## Start application services (requires infrastructure)
	@echo "Starting application services..."
	docker-compose up -d backend workers vendor-sim frontend

stop: ## Stop all services
	@echo "Stopping all services..."
	docker-compose down

stop-services: ## Stop application services (keep infrastructure)
	@echo "Stopping application services..."
	docker-compose stop backend workers vendor-sim frontend

clean: ## Stop and remove all containers, volumes, and networks
	@echo "Cleaning up..."
	docker-compose down -v --remove-orphans
	docker system prune -f

logs: ## Show logs for all services
	docker-compose logs -f

logs-backend: ## Show backend logs
	docker-compose logs -f backend

logs-workers: ## Show workers logs
	docker-compose logs -f workers

logs-vendor: ## Show vendor simulator logs
	docker-compose logs -f vendor-sim

logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

health: ## Check health of all services
	@echo "Checking service health..."
	@echo "Backend: $$(curl -s http://localhost:3000/health | jq -r '.status' 2>/dev/null || echo 'DOWN')"
	@echo "Vendor Sim: $$(curl -s http://localhost:3001/health | jq -r '.status' 2>/dev/null || echo 'DOWN')"
	@echo "Frontend: $$(curl -s http://localhost:3002 | grep -q 'Mini CRM' && echo 'UP' || echo 'DOWN')"

test: ## Run tests for all services
	@echo "Running tests..."
	cd backend && npm test
	cd workers && npm test
	cd vendor-sim && npm test
	cd frontend && npm test

dev: ## Start development mode (local services without Docker)
	@echo "Starting development mode..."
	@echo "Make sure MongoDB and Redpanda are running first!"
	@echo "MongoDB: Install and start locally (brew install mongodb-community && brew services start mongodb-community)"
	@echo "Redpanda: docker-compose up -d redpanda"
	@echo "Backend: http://localhost:3000"
	@echo "Vendor Sim: http://localhost:3001"
	@echo "Frontend: http://localhost:3002"

setup: install ## Complete setup (install + start)
	@echo "Setup complete! Run 'make start' to start services."

setup-mongodb: ## Setup local MongoDB database
	@echo "Setting up local MongoDB..."
	node scripts/setup-local-mongodb.js

status: ## Show status of all services
	docker-compose ps
