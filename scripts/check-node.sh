#!/usr/bin/env bash

# Check Node/npm and provide quick install guidance for macOS

set -e

echo "Checking Node and npm..."

if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  echo "Node found: $(node -v)"
  echo "npm found:  $(npm -v)"
  exit 0
fi

echo "\nNode or npm not found on your PATH." 

echo "Choose one of the following install methods (run the commands shown below):\n"

cat <<'EOF'
1) Homebrew (recommended if you use Homebrew):

  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"  # only if Homebrew missing
  brew update
  brew install node

2) nvm (recommended for multiple Node versions):

  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash
  # then restart your shell or run the following in this session:
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \ . "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts

3) Official installer:

  Visit https://nodejs.org and download the LTS macOS installer, then run it.

After installation, verify with:

  node -v
  npm -v
  which npm

Run tests in repository:

  cd /Users/hacxmr/Documents/GitHub/Autofill-Graph
  npm install
  npm test
  # or use helper script
  ./test-runner.sh install
  ./test-runner.sh test
EOF

exit 1
