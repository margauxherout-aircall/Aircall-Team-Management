# Team Manager — Setup Guide

This guide walks you through deploying Team Manager on Railway. No technical background required.

---

## What you need

- A [Railway](https://railway.app) account (free tier works)
- Your Aircall **API ID** and **API Token** (found in Aircall → Integrations → API keys)
- This codebase (as a zip or GitHub repo)

---

## Step 1 — Create a new project on Railway

1. Log in to [railway.app](https://railway.app)
2. Click **New Project**
3. Choose **Deploy from GitHub repo** (recommended) or **Deploy from local** if you have the zip

If deploying from GitHub:
- Push this folder to a new GitHub repository
- Connect Railway to that repo

---

## Step 2 — Add a Volume (persistent storage)

The app stores all configuration and user accounts in files on disk. You need to attach a Railway Volume so this data survives restarts.

1. In your Railway project, click your service
2. Go to **Volumes** tab → **New Volume**
3. Set the **Mount Path** to `/data`
4. Click **Create**

---

## Step 3 — Set environment variables

In your Railway service, go to **Variables** and add:

| Variable | Value |
|---|---|
| `SESSION_SECRET` | A long random string (e.g. 40+ random characters — use a password generator) |
| `NODE_ENV` | `production` |
| `DATA_PATH` | `/data` |

> **Important:** `SESSION_SECRET` must be kept private. It protects user sessions.

---

## Step 4 — Deploy

Railway will automatically build and deploy the app when you push to your repo (or after the initial deploy).

Once deployed, click the generated URL (e.g. `https://your-app.railway.app`).

---

## Step 5 — First-time setup

On first visit, you'll land on the **Setup page**:

1. **Enter your Aircall API ID and Token** → click **Test connection**
   - You'll see a confirmation showing your Aircall account name
2. **Create your admin account** — enter your name, email, and a password
3. Click **Save and continue**

You'll be taken to the Admin panel automatically.

---

## Step 6 — Add users

In the Admin panel:

1. Click **+ Add user**
2. Enter the user's name, email, and a password (you'll share this with them separately)
3. Set their **Access** level:
   - **View only** — can see teams and members, cannot make changes
   - **View & edit** — can add and remove team members
4. Set their **Scope**:
   - **All teams** — sees all Aircall teams
   - **Own teams only** — sees only teams they belong to in Aircall (matched by email)
   - **Specific teams** — you select exactly which teams they can access
5. Click **Save**

Repeat for each user. Share their email + password with them directly.

---

## Updating Aircall credentials

Go to **Admin → Aircall connection → Edit** at any time to update your API ID or Token.

---

## Changing the app URL

Railway generates a URL automatically. You can add a custom domain in Railway under your service's **Settings → Domains**.

---

## Troubleshooting

**"Couldn't connect" on setup**
→ Double-check your API ID and Token in Aircall (Integrations → API keys → v1 keys).

**Users can't log in**
→ Confirm the email matches exactly what you entered in the Admin panel (not case-sensitive).

**Data lost after redeploy**
→ Make sure your Volume is attached and `DATA_PATH=/data` is set in environment variables.

**App is slow to start**
→ Railway free tier may sleep after inactivity. The first request after sleep takes ~5 seconds.
