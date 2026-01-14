# Domain Setup Guide for LinkHub SaaS

## Step 1: Buy Your Domain

### Recommended Domain Names
- `linkhub.io` - Premium tech domain
- `yourname.link` - Perfect for link-in-bio service
- `biolinks.co` - Descriptive and brandable
- `linkme.to` - Short and memorable

### Where to Buy
1. **Namecheap** (recommended) - Great prices, reliable
2. **Google Domains** - Easy GCP integration
3. **Cloudflare** - Advanced features, competitive pricing

## Step 2: Configure Domain After Deployment

### For GCP Cloud Run

1. **Deploy your app first**
   ```bash
   ./deploy-scripts/gcp-deploy.sh your-project-id
   ```

2. **Map your domain**
   ```bash
   gcloud run domain-mappings create \
     --service=linkhub-saas \
     --domain=yourdomain.com \
     --region=us-central1
   ```

3. **Update DNS records**
   - GCP will provide DNS records to add
   - Add them to your domain registrar
   - SSL certificate is automatic

### For AWS App Runner

1. **Deploy your app first**
   ```bash
   ./deploy-scripts/aws-deploy.sh
   ```

2. **Configure custom domain in AWS Console**
   - Go to App Runner service
   - Add custom domain
   - Follow DNS verification steps

## Step 3: DNS Configuration

### DNS Records to Add
```
Type: CNAME
Name: www
Value: ghs.googlehosted.com (for GCP)

Type: A
Name: @
Value: [IP provided by cloud provider]
```

### Cloudflare Setup (Recommended)
1. Transfer DNS to Cloudflare (free)
2. Enable proxy (orange cloud)
3. Get free SSL and CDN
4. Better performance and security

## Step 4: Update Application Configuration

### Environment Variables
```bash
# Update your app with the new domain
FRONTEND_URL=https://yourdomain.com
STRIPE_WEBHOOK_URL=https://yourdomain.com/api/webhooks/stripe
```

### Stripe Webhook Configuration
1. Go to Stripe Dashboard
2. Update webhook URL to: `https://yourdomain.com/api/webhooks/stripe`
3. Test webhook delivery

## Step 5: Test Everything

### Checklist
- [ ] Domain resolves to your app
- [ ] HTTPS works automatically
- [ ] Bio pages work: `yourdomain.com/username`
- [ ] Dashboard works: `yourdomain.com`
- [ ] API endpoints work
- [ ] Stripe webhooks work

## Domain Costs

### Annual Costs
- `.com` domain: $10-15/year
- `.io` domain: $35-50/year
- `.app` domain: $15-20/year
- `.link` domain: $25-35/year

### Additional Services (Optional)
- **Cloudflare Pro**: $20/month (advanced features)
- **Email hosting**: $5-10/month
- **Domain privacy**: Usually included

## SEO Benefits

### With Custom Domain
- Better search engine ranking
- Professional appearance
- Easier to remember and share
- Brand building

### Bio Page URLs
- Before: `app-xyz.run.app/username`
- After: `yourdomain.com/username`

## Email Setup (Optional)

### Professional Email
- `hello@yourdomain.com`
- `support@yourdomain.com`
- Use Google Workspace or similar

### Email Configuration
```bash
# Update email settings
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=hello@yourdomain.com
EMAIL_FROM=LinkHub <hello@yourdomain.com>
```

## Subdomain Strategy

### Recommended Structure
- `yourdomain.com` - Main app
- `app.yourdomain.com` - Dashboard (optional)
- `api.yourdomain.com` - API (optional)
- `blog.yourdomain.com` - Marketing blog

### Simple Structure (Recommended)
- `yourdomain.com` - Everything
- `yourdomain.com/username` - Bio pages
- `yourdomain.com/dashboard` - User dashboard

## Marketing Benefits

### Professional Branding
- Custom domain builds trust
- Essential for paid subscriptions
- Better conversion rates
- Easier to market

### Social Media
- Easier to share and remember
- Better for influencer partnerships
- Professional appearance

## Timeline

### Immediate (0-1 hours)
1. Buy domain
2. Deploy app
3. Configure domain mapping

### Within 24 hours
- DNS propagation complete
- SSL certificate active
- All features working

### Within 1 week
- SEO indexing begins
- Email setup complete
- Marketing materials updated

## Troubleshooting

### Common Issues
1. **DNS not propagating**: Wait 24-48 hours
2. **SSL certificate issues**: Check domain verification
3. **Webhook failures**: Update Stripe configuration

### Debug Commands
```bash
# Check DNS propagation
dig yourdomain.com
nslookup yourdomain.com

# Test SSL
curl -I https://yourdomain.com

# Check domain mapping (GCP)
gcloud run domain-mappings list
```

## Cost-Benefit Analysis

### Without Custom Domain
- **Cost**: $0
- **Professional appearance**: ❌
- **User trust**: ❌
- **Marketing effectiveness**: ❌

### With Custom Domain
- **Cost**: $10-50/year
- **Professional appearance**: ✅
- **User trust**: ✅
- **Marketing effectiveness**: ✅
- **ROI**: Pays for itself with 1-2 customers

## Recommendation

**Yes, get a custom domain!** It's essential for:
- Professional credibility
- User trust and conversions
- Marketing and SEO
- Building a real business

The cost ($10-50/year) is minimal compared to the benefits and will pay for itself quickly with your SaaS revenue.