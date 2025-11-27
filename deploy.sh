#!/bin/bash

echo "Checking for processes using ports 3000 and 5000..."

# Function to kill process on a specific port
stop_process_on_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    
    if [ ! -z "$pid" ]; then
        echo "Stopping process on port $port (PID: $pid)..."
        kill -9 $pid 2>/dev/null
        echo "Process on port $port stopped."
    else
        echo "No process found on port $port."
    fi
}

stop_process_on_port 3000
stop_process_on_port 5000

echo "Stopping and removing all containers..."
docker-compose down -v

echo "Removing all project containers..."
docker ps -a --filter "name=mai-school" -q | xargs -r docker rm -f 2>/dev/null

echo "Removing all project images..."
docker images --filter "reference=mai-school*" -q | xargs -r docker rmi -f 2>/dev/null

echo "Removing volumes..."
docker volume rm mai-school_postgres_data -f 2>/dev/null

echo "Cleaning up unused Docker resources..."
docker system prune -f

echo "Building and starting containers from scratch..."
docker-compose up --build -d

echo "Waiting for database to be ready..."
sleep 15

echo ""
echo "============================================"
echo "Deployment complete!"
echo "============================================"
echo "Client: http://localhost:3000"
echo "Server: http://localhost:5000"
echo ""
echo "Default Admin Login:"
echo "  Username: admin"
echo "  Password: admin123"
echo "============================================"
