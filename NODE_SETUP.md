Node / npm Setup (macOS)

This project requires Node.js (LTS) and npm to run tests and development scripts.

Recommended methods (choose one):

1) Homebrew (quick)

  Install Homebrew (if missing):

    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  Then install Node:

    brew update
    brew install node

2) nvm (best for multiple Node versions)

  Install nvm:

    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash

  Then add nvm to your shell session (example for zsh):

    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  Install and use LTS:

    nvm install --lts
    nvm use --lts

3) Official Node installer

  Download the macOS LTS installer from https://nodejs.org and run it.

Verification

  node -v
  npm -v
  which npm

Quick run once Node is installed

  cd /Users/hacxmr/Documents/GitHub/Autofill-Graph
  npm install
  npm test

If you prefer, run the bundled checker script first:

  bash scripts/check-node.sh

If you want, I can add an automated nvm bootstrap to your shell profile or update the repository README with these steps—tell me which you prefer.