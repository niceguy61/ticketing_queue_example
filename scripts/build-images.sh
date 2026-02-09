#!/bin/bash

# Build Docker Images Script
# This script builds all service Docker images with version tags

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
VERSION=${VERSION:-latest}
REGISTRY=${REGISTRY:-}
BUILD_ARGS=${BUILD_ARGS:-}

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to build a service image
build_service() {
    local service_name=$1
    local build_context=$2
    local dockerfile=$3
    local image_name="${REGISTRY:+$REGISTRY/}$service_name"
    
    print_info "Building $service_name..."
    
    if [ ! -f "$dockerfile" ]; then
        print_error "Dockerfile not found at $dockerfile"
        return 1
    fi
    
    # Build the image
    docker build \
        -t "$image_name:$VERSION" \
        -t "$image_name:latest" \
        -f "$dockerfile" \
        $BUILD_ARGS \
        "$build_context"
    
    if [ $? -eq 0 ]; then
        print_info "Successfully built $image_name:$VERSION"
    else
        print_error "Failed to build $service_name"
        return 1
    fi
}

# Main script
main() {
    print_info "Starting Docker image build process..."
    print_info "Version: $VERSION"
    
    if [ -n "$REGISTRY" ]; then
        print_info "Registry: $REGISTRY"
    fi
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Build all services
    local services=(
        "queue-service:backend:backend/services/queue-service/Dockerfile"
        "ticket-service:backend:backend/services/ticket-service/Dockerfile"
        "user-service:backend:backend/services/user-service/Dockerfile"
        "frontend:frontend:frontend/Dockerfile"
    )
    
    local failed_services=()
    
    for service in "${services[@]}"; do
        IFS=':' read -r name context dockerfile <<< "$service"
        
        if ! build_service "$name" "$context" "$dockerfile"; then
            failed_services+=("$name")
        fi
        
        echo ""  # Add spacing between builds
    done
    
    # Summary
    echo ""
    print_info "========================================="
    print_info "Build Summary"
    print_info "========================================="
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        print_info "All images built successfully!"
        print_info ""
        print_info "Built images:"
        for service in "${services[@]}"; do
            IFS=':' read -r name context dockerfile <<< "$service"
            image_name="${REGISTRY:+$REGISTRY/}$name"
            echo "  - $image_name:$VERSION"
        done
    else
        print_error "Some images failed to build:"
        for service in "${failed_services[@]}"; do
            echo "  - $service"
        done
        exit 1
    fi
    
    echo ""
    print_info "To load images into k3d cluster, use:"
    print_info "  k3d image import -c ticketing-cluster \\"
    print_info "    queue-service:latest ticket-service:latest \\"
    print_info "    user-service:latest frontend:latest"
}

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -v, --version VERSION    Set image version tag (default: latest)"
    echo "  -r, --registry REGISTRY  Set Docker registry prefix"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Build with 'latest' tag"
    echo "  $0 -v 1.0.0                          # Build with version '1.0.0'"
    echo "  $0 -r myregistry.com -v 1.0.0        # Build with registry prefix"
    echo "  VERSION=1.0.0 $0                     # Build using environment variable"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
# Resolve project root relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

main
