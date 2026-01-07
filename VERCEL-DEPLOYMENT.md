# 🚀 Deploying PakFolio to Vercel

This guide shows you how to deploy the PakFolio web app to Vercel for free hosting.

## Prerequisites

- GitHub account
- Vercel account (sign up at https://vercel.com)
- Git installed on your computer

## Method 1: Deploy via Vercel CLI (Fastest)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

Navigate to your project directory and run:

```bash
cd psx-tax-calculator
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Choose your account
- Link to existing project? **N**
- Project name? **pakfolio** (or your preferred name)
- In which directory is your code located? **mobile**
- Want to override settings? **N**

Your app will be deployed! You'll get a URL like: `https://pakfolio.vercel.app`

### Step 4: Production Deployment

For production deployment:

```bash
vercel --prod
```

## Method 2: Deploy via GitHub (Recommended for Continuous Deployment)

### Step 1: Initialize Git Repository

```bash
cd psx-tax-calculator
git init
git add .
git commit -m "Initial commit - PakFolio web app"
```

### Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `pakfolio`
3. Don't initialize with README (you already have files)

### Step 3: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/pakfolio.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy on Vercel

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your `pakfolio` repository
4. Configure project:
   - **Framework Preset:** Other
   - **Root Directory:** `mobile`
   - **Build Command:** (leave empty)
   - **Output Directory:** (leave empty)
   - **Install Command:** (leave empty)
5. Click "Deploy"

Your app will be live at: `https://pakfolio.vercel.app` (or similar)

## Method 3: Deploy via Vercel Dashboard (Drag & Drop)

### Step 1: Prepare Deployment Folder

1. Copy the `mobile/` folder to a temporary location
2. Rename it to `pakfolio-deploy`

### Step 2: Upload to Vercel

1. Go to https://vercel.com/new
2. Drag and drop the `pakfolio-deploy` folder
3. Vercel will automatically deploy it

## Configuration

The project includes a `vercel.json` configuration file with:
- Static file serving from `mobile/` directory
- Clean URLs enabled
- Proper routing for the app

## Custom Domain (Optional)

### Add Your Own Domain

1. In Vercel dashboard, go to your project
2. Click **Settings** > **Domains**
3. Add your custom domain (e.g., `pakfolio.com`)
4. Follow DNS configuration instructions

## Environment Variables (If Needed)

Currently, PakFolio doesn't require environment variables as it runs entirely client-side with localStorage.

If you add backend features later:

1. Go to **Settings** > **Environment Variables**
2. Add variables for Production, Preview, and Development
3. Redeploy for changes to take effect

## Automatic Deployments

With GitHub integration:
- Every push to `main` branch triggers a production deployment
- Pull requests create preview deployments
- You get a unique URL for each deployment

## What Gets Deployed

The Vercel deployment includes:
- ✅ Mobile web app from `mobile/` folder
- ✅ All HTML, CSS, and JavaScript files
- ✅ Shared JavaScript modules (FIFO engine, tax calculator, storage)
- ❌ Android project files (excluded via `.vercelignore`)
- ❌ Node modules and build files
- ❌ Documentation files (optional exclusion)

## Post-Deployment Checklist

After deployment:

1. **Test the app**: Open the Vercel URL and test all features
2. **Check localStorage**: Verify data persistence works
3. **Test on mobile**: Open on your phone to test responsiveness
4. **Test PDF generation**: Ensure PDF reports generate correctly
5. **Share the URL**: Your app is now accessible worldwide!

## URLs You'll Get

- **Preview URL**: `https://pakfolio-git-main-yourusername.vercel.app`
- **Production URL**: `https://pakfolio.vercel.app`
- **Deployment-specific URL**: `https://pakfolio-abc123.vercel.app`

## Updating Your Deployment

### Method 1: Via GitHub (Auto-deploy)
```bash
git add .
git commit -m "Update: description of changes"
git push
```
Vercel automatically deploys the changes.

### Method 2: Via CLI
```bash
vercel --prod
```

## Rollback to Previous Version

1. Go to Vercel dashboard
2. Click **Deployments**
3. Find a previous successful deployment
4. Click **⋯** > **Promote to Production**

## Performance Optimization

Vercel automatically provides:
- ✅ Global CDN
- ✅ HTTP/2 and compression
- ✅ Automatic HTTPS
- ✅ Edge caching
- ✅ DDoS protection

## Monitoring

View deployment stats:
1. Go to your project dashboard
2. Click **Analytics** to see:
   - Page views
   - Visitor locations
   - Performance metrics
   - Popular pages

## Troubleshooting

### Issue: 404 errors
**Solution**: Ensure `vercel.json` routing is configured correctly

### Issue: JavaScript not loading
**Solution**: Check that all script paths in HTML are relative (starting with `../` or `./`)

### Issue: localStorage not working
**Solution**: Ensure your app is served over HTTPS (Vercel does this automatically)

### Issue: Large bundle size warning
**Solution**: Your app is client-side only, so this is expected. No action needed.

## Free Tier Limits

Vercel Free tier includes:
- 100 GB bandwidth/month
- Unlimited deployments
- Automatic HTTPS
- Global CDN
- Perfect for PakFolio!

## Cost

- **Hobby (Free)**: $0/month - Perfect for personal projects
- **Pro**: $20/month - For commercial use with custom domains
- **Enterprise**: Custom pricing

For PakFolio, the **Free tier is sufficient** unless you expect high traffic.

## Security

- All deployments are served over HTTPS
- No backend = minimal attack surface
- Client-side storage only
- No sensitive data transmitted

## Next Steps After Deployment

1. **Share your app**: Send the Vercel URL to users
2. **Add to home screen**: Your app is PWA-ready for mobile
3. **Monitor usage**: Check Vercel analytics
4. **Iterate**: Push updates via Git for instant deployment

## Additional Resources

- Vercel Documentation: https://vercel.com/docs
- Vercel CLI Reference: https://vercel.com/docs/cli
- Custom Domains Guide: https://vercel.com/docs/custom-domains

---

**Your PakFolio web app is now ready for global deployment! 🚀**

Generated: January 7, 2026
