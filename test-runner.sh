#!/bin/bash

# Test Runner Script for Privacy Graph Autofill
# Provides quick access to common testing workflows

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm not found. Please install Node.js and npm."
    exit 1
fi

# Default action
ACTION=${1:-"help"}

case $ACTION in
    "install")
        print_header "Installing Dependencies"
        npm install
        print_success "Dependencies installed"
        ;;

    "test")
        print_header "Running All Tests"
        npm test
        ;;

    "test:watch")
        print_header "Running Tests in Watch Mode"
        npm run test:watch
        ;;

    "test:coverage")
        print_header "Running Tests with Coverage Report"
        npm run test:coverage
        ;;

    "test:debug")
        print_header "Running Tests in Debug Mode"
        print_warning "DevTools will open - set breakpoints and run tests"
        npm run test:debug
        ;;

    "test:graph")
        print_header "Testing GraphStorage Module"
        npm test -- graphStorage.example.test.js
        ;;

    "test:single")
        if [ -z "$2" ]; then
            echo "Usage: ./test-runner.sh test:single <test-file>"
            echo "Example: ./test-runner.sh test:single graphStorage.example.test.js"
            exit 1
        fi
        print_header "Testing: $2"
        npm test -- "$2"
        ;;

    "clean")
        print_header "Cleaning Test Artifacts"
        rm -rf coverage/
        rm -rf .jest
        print_success "Test artifacts cleaned"
        ;;

    "help")
        cat << 'EOF'
Privacy Graph Autofill - Test Runner

Usage: ./test-runner.sh [command] [options]

Commands:
  install           Install dependencies (run first time)
  test              Run all tests
  test:watch        Run tests in watch mode (re-run on changes)
  test:coverage     Run tests with coverage report
  test:debug        Run tests in debug mode with DevTools
  test:graph        Run only GraphStorage tests
  test:single FILE  Run a specific test file
  clean             Remove test artifacts
  help              Show this help message

Examples:
  ./test-runner.sh install
  ./test-runner.sh test
  ./test-runner.sh test:watch
  ./test-runner.sh test:coverage
  ./test-runner.sh test:single graphStorage.example.test.js

For more details, see TESTING_QUICK_START.md and TESTING_GUIDE.md
EOF
        ;;

    *)
        echo "Unknown command: $ACTION"
        echo "Run './test-runner.sh help' for usage information"
        exit 1
        ;;
esac
