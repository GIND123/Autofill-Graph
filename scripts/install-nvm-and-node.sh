#!/usr/bin/env bash

# Safe installer to bootstrap nvm and Node LTS for zsh users.
# Run: bash scripts/install-nvm-and-node.sh

set -euo pipefail

# Detect shell rc file for zsh
RCFILE="$HOME/.zshrc"

echo "This script will install nvm and Node LTS and add nvm bootstrap to $RCFILE"
read -p "Proceed? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted by user."
  exit 0
fi

# Install nvm
if command -v nvm >/dev/null 2>&1; then
  echo "nvm already installed"
else
  echo "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.6/install.sh | bash
fi

# Add bootstrap to RCFILE if missing
BOOTSTRAP='\n# nvm bootstrap added by Autofill-Graph installer\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm\n[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion\n'

if ! grep -q "nvm.sh" "$RCFILE" 2>/dev/null; then
  echo "Adding nvm bootstrap to $RCFILE"
  printf "%s" "$BOOTSTRAP" >> "$RCFILE"
else
  echo "nvm bootstrap already present in $RCFILE"
fi

# Source rc file for this session
# shellcheck source=/dev/null
if [ -s "$RCFILE" ]; then
  # Use a subshell so we don't pollute caller environment
  source "$RCFILE"
fi

# Install Node LTS
echo "Installing Node LTS via nvm..."
nvm install --lts
nvm use --lts

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"

echo "Done. Please restart your terminal or run 'source $RCFILE' to ensure nvm is loaded in future sessions." 
