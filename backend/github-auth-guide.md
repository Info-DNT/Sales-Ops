# GitHub Authentication Guide

## Issue
Push to `Info-DNT/Sales-Ops` failed with 403 error because `TusharChauhan04` account doesn't have write access.

## Solution Options

### Option 1: Personal Access Token (Recommended)

1. **Generate PAT on GitHub:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Name: `Sales-Ops Push`
   - Scopes: ✅ `repo` (full control of private repositories)
   - Click "Generate token"
   - **COPY THE TOKEN** (shown only once!)

2. **Update Git remote URL:**
   ```powershell
   git remote set-url origin https://YOUR_TOKEN@github.com/Info-DNT/Sales-Ops.git
   ```

3. **Push again:**
   ```powershell
   git push origin master
   ```

### Option 2: GitHub CLI Authentication

If you have GitHub CLI (`gh`) installed:
```powershell
gh auth login
```
Follow the prompts to authenticate via browser.

### Option 3: SSH Key Setup

1. Generate SSH key:
   ```powershell
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. Add to GitHub:
   - Copy public key: `cat ~/.ssh/id_ed25519.pub`
   - GitHub → Settings → SSH Keys → New SSH key
   - Change remote URL: `git remote set-url origin git@github.com:Info-DNT/Sales-Ops.git`

## Current Status

**Commit created:** ✅ (commit hash: 490ba85)
- 37 files changed
- 5244 insertions
- All Supabase integration code committed

**Needs:** GitHub authentication to push
