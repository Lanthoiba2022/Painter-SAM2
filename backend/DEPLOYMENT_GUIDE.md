# SAM2 Building Painter - Deployment Guide

This guide covers deploying both the backend API and frontend application for the SAM2 Building Painter system.

## Architecture Overview

The application consists of two main components:

1. **Backend API** (FastAPI + Modal): Handles SAM2 model inference and image processing
2. **Frontend** (Next.js): Provides the user interface for image upload, mask generation, and painting

## Backend Deployment (Modal)

### Prerequisites

1. **Modal Account**: Sign up at [modal.com](https://modal.com)
2. **Python 3.10+**: For local development
3. **Git**: For version control

### Step 1: Install Modal CLI

```bash
pip install modal
```

### Step 2: Authenticate with Modal

```bash
modal token new
```

### Step 3: Deploy the Backend

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Deploy the Modal app**:
   ```bash
   python modal_sam2.py
   ```

3. **Note the deployment URL**: The deployment will output a URL like:
   ```
   https://your-username--sam2-building-painter-fastapi-app-modal.modal.run
   ```

### Step 4: Update Environment Variables

Update the `main.py` file with your Modal deployment URL:

```python
# In main.py, update the SAM2Service class
self.modal_base_url = "https://your-username--sam2-building-painter-fastapi-app-modal.modal.run"
```

### Step 5: Deploy Backend API (Optional - Local/Cloud)

If you want to deploy the FastAPI backend separately:

#### Option A: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Option B: Render
1. Connect your GitHub repository
2. Create a new Web Service
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

#### Option C: Heroku
```bash
# Create Procfile
echo "web: uvicorn main:app --host=0.0.0.0 --port=\$PORT" > Procfile

# Deploy
heroku create your-app-name
git push heroku main
```

## Frontend Deployment

### Prerequisites

1. **Node.js 18+**: For building the frontend
2. **Git**: For version control

### Step 1: Build the Frontend

```bash
cd frontend
npm install
npm run build
```

### Step 2: Deploy to Vercel (Recommended)

1. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Connect your GitHub repository
   - Import the project

2. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.com
   ```

3. **Deploy**:
   - Vercel will automatically deploy on push to main branch
   - Or manually deploy from the dashboard

### Step 3: Alternative Deployments

#### Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=out
```

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

## Environment Configuration

### Backend Environment Variables

Create a `.env` file in the backend directory:

```env
# Modal Configuration
MODAL_BASE_URL=https://your-username--sam2-building-painter-fastapi-app-modal.modal.run
MODAL_HEALTH_URL=https://your-username--sam2-building-painter-fastapi-app-modal.modal.run/health

# Server Configuration
HOST=0.0.0.0
PORT=8000

# File Upload Configuration
MAX_FILE_SIZE=52428800  # 50MB in bytes
UPLOAD_DIR=uploads
MASKS_DIR=masks
RESULTS_DIR=results

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
```

### Frontend Environment Variables

Create a `.env.local` file in the frontend directory:

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://your-backend-url.com

# Optional: Analytics
NEXT_PUBLIC_GA_ID=your-google-analytics-id

# Optional: Feature Flags
NEXT_PUBLIC_ENABLE_DEBUG_MODE=false
```

## Production Checklist

### Backend
- [ ] Modal deployment is working
- [ ] Health check endpoint responds
- [ ] CORS is properly configured
- [ ] File upload limits are set
- [ ] Error handling is in place
- [ ] Logging is configured
- [ ] Rate limiting is implemented (if needed)

### Frontend
- [ ] Build completes successfully
- [ ] Environment variables are set
- [ ] API endpoints are accessible
- [ ] Error handling works
- [ ] Loading states are implemented
- [ ] Responsive design works
- [ ] Performance is optimized

### Security
- [ ] HTTPS is enabled
- [ ] CORS is properly configured
- [ ] File upload validation is in place
- [ ] API rate limiting is implemented
- [ ] Environment variables are secure

## Monitoring and Maintenance

### Health Checks

Monitor these endpoints:

- Backend: `GET /health`
- Modal: `GET /health` (from Modal deployment)

### Logs

- **Backend**: Check Modal logs in the dashboard
- **Frontend**: Check Vercel/Netlify logs

### Performance Monitoring

- Monitor API response times
- Check GPU usage in Modal
- Monitor frontend bundle size
- Track user interactions

## Troubleshooting

### Common Issues

1. **Modal Deployment Fails**
   - Check Modal account status
   - Verify Python dependencies
   - Check GPU availability

2. **Frontend Build Fails**
   - Check Node.js version
   - Verify all dependencies are installed
   - Check TypeScript errors

3. **API Connection Issues**
   - Verify CORS configuration
   - Check environment variables
   - Test API endpoints directly

4. **Image Upload Issues**
   - Check file size limits
   - Verify file type validation
   - Check storage permissions

### Debug Mode

Enable debug mode for troubleshooting:

```env
# Backend
DEBUG=true
LOG_LEVEL=DEBUG

# Frontend
NEXT_PUBLIC_ENABLE_DEBUG_MODE=true
```

## Scaling Considerations

### Backend Scaling

- **Modal**: Automatically scales based on demand
- **Alternative**: Use multiple GPU instances for high load

### Frontend Scaling

- **Vercel/Netlify**: Automatically scales
- **CDN**: Consider using a CDN for static assets

### Database (Future)

- Consider adding a database for user sessions
- Implement user authentication
- Add project saving functionality

## Cost Optimization

### Modal Costs

- Monitor GPU usage
- Use appropriate GPU types
- Implement request batching

### Frontend Costs

- Optimize bundle size
- Use image optimization
- Implement caching strategies

## Security Best Practices

1. **API Security**
   - Implement authentication
   - Use HTTPS only
   - Validate all inputs
   - Rate limit requests

2. **Frontend Security**
   - Sanitize user inputs
   - Use Content Security Policy
   - Implement proper error handling

3. **Data Protection**
   - Encrypt sensitive data
   - Implement proper session management
   - Regular security audits

## Support and Maintenance

### Regular Tasks

- Monitor application health
- Update dependencies
- Review security patches
- Optimize performance
- Backup data (if applicable)

### Emergency Procedures

1. **Service Down**
   - Check health endpoints
   - Review recent deployments
   - Rollback if necessary

2. **Performance Issues**
   - Monitor resource usage
   - Check for bottlenecks
   - Scale resources if needed

## Conclusion

This deployment guide provides a comprehensive approach to deploying the SAM2 Building Painter application. The combination of Modal for GPU-intensive AI operations and Vercel for the frontend provides a scalable, cost-effective solution.

For additional support:
- Check the Modal documentation
- Review the Next.js deployment guide
- Monitor application logs
- Test thoroughly before production deployment 