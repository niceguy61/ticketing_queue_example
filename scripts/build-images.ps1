# Build Docker Images Script (PowerShell)
# This script builds all service Docker images with version tags

param(
    [string]$Version = "latest",
    [string]$Registry = "",
    [string]$BuildArgs = ""
)

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Function to build a service image
function Build-Service {
    param(
        [string]$ServiceName,
        [string]$ServicePath
    )
    
    $imageName = if ($Registry) { "$Registry/$ServiceName" } else { $ServiceName }
    
    Write-Info "Building $ServiceName..."
    
    if (-not (Test-Path "$ServicePath/Dockerfile")) {
        Write-Error-Custom "Dockerfile not found at $ServicePath/Dockerfile"
        return $false
    }
    
    # Build the image
    $buildCmd = "docker build -t ${imageName}:$Version -t ${imageName}:latest"
    if ($BuildArgs) {
        $buildCmd += " $BuildArgs"
    }
    $buildCmd += " $ServicePath"
    
    try {
        Invoke-Expression $buildCmd
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Successfully built ${imageName}:$Version"
            return $true
        } else {
            Write-Error-Custom "Failed to build $ServiceName"
            return $false
        }
    } catch {
        Write-Error-Custom "Failed to build $ServiceName: $_"
        return $false
    }
}

# Main script
function Main {
    Write-Info "Starting Docker image build process..."
    Write-Info "Version: $Version"
    
    if ($Registry) {
        Write-Info "Registry: $Registry"
    }
    
    # Check if Docker is running
    try {
        docker info | Out-Null
    } catch {
        Write-Error-Custom "Docker is not running. Please start Docker and try again."
        exit 1
    }
    
    # Build all services
    $services = @(
        @{Name="queue-service"; Path="services/queue-service"},
        @{Name="ticket-service"; Path="services/ticket-service"},
        @{Name="user-service"; Path="services/user-service"},
        @{Name="frontend"; Path="frontend"}
    )
    
    $failedServices = @()
    
    foreach ($service in $services) {
        if (-not (Build-Service -ServiceName $service.Name -ServicePath $service.Path)) {
            $failedServices += $service.Name
        }
        Write-Host ""  # Add spacing between builds
    }
    
    # Summary
    Write-Host ""
    Write-Info "========================================="
    Write-Info "Build Summary"
    Write-Info "========================================="
    
    if ($failedServices.Count -eq 0) {
        Write-Info "All images built successfully!"
        Write-Info ""
        Write-Info "Built images:"
        foreach ($service in $services) {
            $imageName = if ($Registry) { "$Registry/$($service.Name)" } else { $service.Name }
            Write-Host "  - ${imageName}:$Version"
        }
    } else {
        Write-Error-Custom "Some images failed to build:"
        foreach ($serviceName in $failedServices) {
            Write-Host "  - $serviceName"
        }
        exit 1
    }
    
    Write-Host ""
    Write-Info "To run the images locally, use:"
    Write-Info "  docker-compose up"
    Write-Host ""
    Write-Info "To push images to registry, use:"
    Write-Info "  .\scripts\push-to-ecr.ps1"
}

# Show usage
function Show-Usage {
    Write-Host "Usage: .\build-images.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Version VERSION      Set image version tag (default: latest)"
    Write-Host "  -Registry REGISTRY    Set Docker registry prefix"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\build-images.ps1                                    # Build with 'latest' tag"
    Write-Host "  .\build-images.ps1 -Version 1.0.0                    # Build with version '1.0.0'"
    Write-Host "  .\build-images.ps1 -Registry myregistry.com -Version 1.0.0  # Build with registry prefix"
}

# Run main function
Main
