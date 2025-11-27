# deploy.ps1

Write-Host "Checking for processes using ports 3000 and 5000..."

# Function to kill process on a specific port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($process) {
        Write-Host "Stopping process on port $Port (PID: $process)..."
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Write-Host "Process on port $Port stopped."
    } else {
        Write-Host "No process found on port $Port."
    }
}

Stop-ProcessOnPort -Port 3000
Stop-ProcessOnPort -Port 5000

Write-Host "Stopping and removing all containers..."
docker-compose down -v

Write-Host "Removing all project containers..."
docker ps -a --filter "name=mai-school" -q | ForEach-Object { docker rm -f $_ 2>$null }

Write-Host "Removing all project images..."
docker images --filter "reference=mai-school*" -q | ForEach-Object { docker rmi -f $_ 2>$null }

Write-Host "Removing volumes..."
docker volume rm mai-school_postgres_data -f 2>$null

Write-Host "Cleaning up unused Docker resources..."
docker system prune -f

Write-Host "Building and starting containers from scratch..."
docker-compose up --build -d

Write-Host "Waiting for database to be ready..."
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "============================================"
Write-Host "Deployment complete!"
Write-Host "============================================"
Write-Host "Client: http://localhost:3000"
Write-Host "Server: http://localhost:5000"
Write-Host ""
Write-Host "Default Admin Login:"
Write-Host "  Username: admin"
Write-Host "  Password: admin123"
Write-Host "============================================"
