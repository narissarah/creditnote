# 🚀 Deploy CreditNote to Vercel

## Quick Deploy (Recommended)

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com
   - Sign in with your GitHub account

2. **Import GitHub Repository**
   - Click "Add New..." → "Project"
   - Import `narissarah/creditnote` repository
   - Select the repository and click "Import"

3. **Configure Project**
   - Framework Preset: **Remix**
   - Root Directory: `./` (leave as is)
   - Build Command: `npm run vercel-build`
   - Output Directory: `build/client`
   - Install Command: `npm install`

4. **Add Environment Variables**
   - Click "Environment Variables"
   - Add each variable from `.env.vercel.example`
   - **IMPORTANT**: Update `SHOPIFY_APP_URL` with your Vercel URL after first deployment

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete (3-5 minutes)

### Option 2: Deploy via CLI

1. **Run the deployment script**:
   ```bash
   ./deploy-to-vercel.sh
   ```

2. **Follow the prompts**:
   - Set up and deploy: **Yes**
   - Select scope: **Your account**
   - Link to existing project: **No**
   - Project name: **creditnote** (or press enter)
   - Directory: **./** (current directory)

3. **Add environment variables** in Vercel Dashboard

## 📝 Environment Variables

Copy all variables from `.env.vercel.example` to your Vercel project:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon database connection (pooled) |
| `DIRECT_DATABASE_URL` | Neon database direct connection |
| `SHOPIFY_API_KEY` | Your Shopify app API key |
| `SHOPIFY_API_SECRET` | Your Shopify app secret |
| `SHOPIFY_APP_URL` | Your Vercel deployment URL |
| `SESSION_SECRET` | Session encryption key |
| `QR_SECRET_KEY` | QR code security key |
| `SCOPES` | Shopify API scopes |

## 🔄 After Deployment

1. **Get your Vercel URL**
   - It will be something like: `https://creditnote.vercel.app`
   - Or: `https://creditnote-username.vercel.app`

2. **Update Shopify App Settings**
   - Go to Shopify Partners Dashboard
   - Update App URL to your Vercel URL
   - Update Redirect URLs:
     - `https://your-app.vercel.app/api/auth`
     - `https://your-app.vercel.app/auth/callback`
     - `https://your-app.vercel.app/auth`

3. **Update Environment Variable**
   - In Vercel Dashboard → Settings → Environment Variables
   - Update `SHOPIFY_APP_URL` with your actual Vercel URL
   - Redeploy to apply changes

4. **Update local `.env`**
   - Update `SHOPIFY_APP_URL` in your local `.env` file
   - Update `shopify.app.toml` with the new URL

## 🧪 Test Your Deployment

1. Visit your Vercel URL
2. Install the app in your development store
3. Test credit note creation and QR scanning
4. Check POS extension functionality

## 🔧 Troubleshooting

### 500 Error
- Check all environment variables are set correctly
- Verify database connection (Neon is accessible)
- Check Vercel function logs

### Authentication Issues
- Ensure `SHOPIFY_APP_URL` matches your Vercel deployment
- Clear browser cookies and cache
- Reinstall the app in your store

### Database Issues
- Verify Neon database is active
- Check connection strings are correct
- Run migrations if needed

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Shopify App Development](https://shopify.dev/docs/apps)
- [Remix on Vercel](https://vercel.com/guides/deploying-remix-with-vercel)

## 🆘 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Review environment variables
3. Ensure GitHub repository is up to date
4. Verify Shopify app settings match Vercel URL