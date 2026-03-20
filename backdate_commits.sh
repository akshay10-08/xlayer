#!/bin/bash

# ==========================================
# Git Contribution Spreader
# This script creates a new repo with commits
# spread over the last 4 days.
# ==========================================

# --- CONFIGURATION ---
# IMPORTANT: Change these to match your GitHub profile
GIT_NAME="akshay10-08"
GIT_EMAIL="akshay.gpt0010@gmail.com"
REPO_DIR="xlayer"

# --- EXECUTION ---

# Create and enter the directory
if [ -d "$REPO_DIR" ]; then
    echo "❌ Error: Directory '$REPO_DIR' already exists."
    exit 1
fi

mkdir "$REPO_DIR"
cd "$REPO_DIR" || exit

# Initialize Git
echo "🚀 Initializing new repository in $REPO_DIR..."
git init

# Set local identity for this repo
git config user.name "$GIT_NAME"
git config user.email "$GIT_EMAIL"

# Define the dates (Last 4 days relative to 2026-03-19)
# Format: YYYY-MM-DDTHH:MM:SS+05:30
DATES=(
  "2026-03-16T10:15:00+05:30"
  "2026-03-17T14:30:00+05:30"
  "2026-03-18T11:45:00+05:30"
  "2026-03-19T17:20:00+05:30"
)

MESSAGES=(
  "chore: setup project foundation"
  "feat: implement core functionality"
  "docs: add readme and basic documentation"
  "refactor: final polish and optimizations"
)

FILE_NAMES=(
  "init.md"
  "app.js"
  "README.md"
  "main.css"
)

# Loop through and create backdated commits
for i in "${!DATES[@]}"; do
    DATE="${DATES[$i]}"
    MSG="${MESSAGES[$i]}"
    FILE="${FILE_NAMES[$i]}"
    
    echo "Creating commit for $DATE..."
    
    # Create simple content
    echo "# Content for $MSG created on $DATE" > "$FILE"
    git add "$FILE"
    
    # Commit with backdated environment variables
    GIT_AUTHOR_DATE="$DATE" \
    GIT_COMMITTER_DATE="$DATE" \
    git commit -m "$MSG" --quiet
    
    echo "✅ Created: $MSG"
done

# Ensure main branch
git branch -M main

echo ""
echo "✨ Success! Your backdated repository is ready in the '$REPO_DIR' folder."
echo ""
echo "👉 NEXT STEPS:"
echo "1. Create a NEW empty repository on GitHub (do NOT initialize with README/License)."
echo "2. Copy the remote URL (https://github.com/yourusername/yourrepo.git)."
echo "3. Run these commands inside '$REPO_DIR':"
echo "   git remote add origin YOUR_REMOTE_URL"
echo "   git push -u origin main"
echo ""
echo "💡 Note: GitHub contribution graph can take up to 24 hours to update."
