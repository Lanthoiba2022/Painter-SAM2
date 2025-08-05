# SAM2 Building Painter 🏠🎨

A modern web application for segmenting and coloring buildings using Meta AI's Segment Anything Model 2 (SAM2). This application provides interactive building segmentation with real-time painting capabilities.

![SAM2 Building Painter](https://img.shields.io/badge/SAM2-Building%20Painter-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green)
![Modal](https://img.shields.io/badge/Modal-GPU%20Cloud-purple)

## ✨ Features

- **🎯 AI-Powered Segmentation**: Generate precise masks for walls and architectural elements using SAM2
- **🎨 Interactive Painting**: Apply beautiful colors to building areas with customizable opacity
- **🖱️ Point-and-Click Selection**: Click anywhere on the image to select corresponding areas
- **🔗 Multi-Selection**: Shift+click to combine multiple areas for larger wall sections
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **⚡ Real-time Preview**: See your painted results instantly
- **💾 Download Results**: Save your colored building visualizations
- **🚀 Cloud Deployment**: GPU-powered processing via Modal
- **🔄 Advanced Caching**: Intelligent caching for faster mask generation and instant point selection
- **🎯 Instant Mask Selection**: Hover over areas to see mask previews instantly

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Modal GPU     │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   (SAM2 Model)  │
│                 │    │                 │    │                 │
│ • Upload UI     │    │ • Session Mgmt  │    │ • Segmentation  │
│ • Canvas        │    │ • File Handling │    │ • Masks Gen     │
│ • Color Palette │    │ • API Gateway   │    │ • Single Pt Gen │
│ • Painting      │    │ • Error Handling│    │ • GPU Processing│
│ • Download      │    │ • Caching Layer │    │ • A100 GPU      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **npm**
- **Python 3.10+** and **pip / conda**
- **Modal account** (for GPU processing)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd SAM2_IndieVerse
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
# Create .env file with:
MODAL_BASE_URL=https://your-username--sam2-building-painter-fastapi-app-modal.modal.run
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Set up environment variables
# Create .env.local file with:
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Deploy Modal Backend

```bash
# Navigate back to backend directory
cd ../backend

# Install Modal CLI
pip install modal

# Authenticate with Modal
modal token new

# Deploy SAM2 model to Modal
modal deploy modal_sam2.py
```

### 5. Start Development Servers

```bash
# Start backend (in backend directory)
python main.py

# Start frontend (in frontend directory, new terminal)
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the application!

## 📖 Usage Guide

### 1. Upload an Image
- Drag and drop an image file or click to browse
- Supported formats: JPG, PNG, BMP, TIFF (max 50MB)
- The image will be processed and displayed in the canvas

### 2. Generate Masks
- Click "Generate Masks" to create segmentation masks
- This process uses SAM2 AI model and may take a few minutes
- Once complete, you'll see the number of generated masks

### 3. Select Areas
- **Click anywhere** on the image to select the corresponding area
- **left click** to add areas to your selection
- **right click** to remove areas from your selection
- **Hover over areas** to see instant mask previews
- **Toggle "Show All Masks"** to see all available segmentation areas
- Selected areas will be highlighted

### 4. Choose Colors
- Use the color palette to select your desired color
- Colors are optimized for building visualization
- The selected color is displayed in the preview

### 5. Paint Areas
- Click "Paint Selected Areas" to apply the color to your selection
- The painted result can be seen on Image Preview as well as bottom of page

### 6. Download Results
- Click "Download Result" to save your painted building image
- Images are saved in PNG format with high quality

## 🛠️ Development

### Project Structure

```
SAM2_IndieVerse/
├── backend/                 # FastAPI backend
│   ├── main.py             # Main API server with session management
│   ├── modal_sam2.py       # Modal deployment for SAM2
│   ├── requirements.txt    # Python dependencies
│   └── README.md          # Backend documentation
├── frontend/               # Next.js frontend
│   ├── app/               # Next.js App Router
│   ├── components/        # React components
│   ├── lib/              # Utilities and API client
│   ├── store/            # Zustand state management
│   ├── types/            # TypeScript types
│   └── package.json      # Node.js dependencies
├── SAM2/                  # Original SAM2 repository
└── README.md             # This file
```

### Available Scripts

```bash
# Backend
cd backend
python main.py                    # Start backend server
modal deploy modal_sam2.py             # Deploy Modal backend

# Frontend
cd frontend
npm run dev                      # Start development server
npm run build                    # Build for production
npm run start                    # Start production server
npm run lint                     # Run ESLint
npm run type-check              # Run TypeScript type checking
```

### API Endpoints

The backend provides these key endpoints:

- `POST /upload` - Upload image and create session
- `POST /generate-masks` - Generate segmentation masks
- `POST /get-mask-at-point` - Get mask at specific point
- `POST /paint-multiple-masks` - Paint selected areas
- `POST /download-painted-image` - Download result
- `GET /health` - Health check
- `POST /get-embedding` - Get image embedding for caching
- `POST /generate-masks-cached` - Generate masks with caching
- `POST /get-mask-at-point-instant` - Instant mask selection

## 🚀 Deployment

### Production Deployment

1. **Deploy Modal Backend**:
   ```bash
   cd backend
   modal deploy modal_sam2.py
   ```

2. **Deploy Frontend to Vercel**:
   - Connect GitHub repository to Vercel
   - Set environment variables
   - Deploy automatically

3. **Configure Environment**:
   - Update `NEXT_PUBLIC_API_URL` with your Modal URL
   - Set up CORS for your domain

### Alternative Deployments

- **Frontend**: Vercel, Netlify, Railway, AWS Amplify
- **Backend**: Railway, Render, Heroku, DigitalOcean
- **GPU Processing**: Modal (recommended), AWS SageMaker, Google Colab, RunPod, Beam Cloud, Vast ai

## 🔧 Configuration

### Backend Configuration

```env
# Modal Configuration
MODAL_BASE_URL=https://your-modal-deployment.modal.run

# Server Configuration
HOST=0.0.0.0
PORT=8000

# File Upload Configuration
MAX_FILE_SIZE=52428800  # 50MB
UPLOAD_DIR=uploads
MASKS_DIR=masks
RESULTS_DIR=results

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

### Frontend Configuration

```env
# API Configuration
NEXT_PUBLIC_API_URL=https://your-backend-url.com

# Optional: Analytics
NEXT_PUBLIC_GA_ID=your-google-analytics-id

# Optional: Feature Flags
NEXT_PUBLIC_ENABLE_DEBUG_MODE=false
```

## 🎨 Customization

### Adding New Colors

Edit `frontend/components/ColorPalette.tsx`:

```typescript
const defaultColors = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  // Add your custom colors here
  '#YOUR_COLOR', // Your color
];
```

### Modifying SAM2 Parameters

Edit `backend/modal_sam2.py`:

```python
self.mask_generator = SAM2AutomaticMaskGenerator(
    self.sam2_model,
    points_per_side=32,        # Adjust for more/fewer masks
    pred_iou_thresh=0.88,      # Adjust mask quality
    stability_score_thresh=0.95, # Adjust mask stability
    # ... other parameters
)
```

## 🔍 Troubleshooting

### Common Issues

1. **Modal Deployment Fails**:
   - Check Modal account status
   - Verify Python dependencies
   - Check GPU availability

2. **Frontend Build Fails**:
   - Check Node.js version (18+)
   - Verify all dependencies are installed
   - Check TypeScript errors

3. **API Connection Issues**:
   - Verify CORS configuration
   - Check environment variables
   - Test API endpoints directly

4. **Image Upload Issues**:
   - Check file size limits (50MB)
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

## 📊 Performance

### Optimization Tips

- **Image Size**: Resize large images before upload
- **Mask Generation**: Adjust parameters for faster processing
- **Caching**: Enable browser caching for static assets
- **CDN**: Use CDN for image delivery

### Monitoring

- Monitor API response times
- Check GPU usage in Modal
- Monitor frontend bundle size
- Track user interactions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use meaningful commit messages
- Add tests for new features
- Update documentation


## 🙏 Acknowledgments

- **Meta AI** for the amazing SAM2 model
- **Modal** for GPU cloud infrastructure
- **Next.js** team for the excellent framework
- **FastAPI** for backend functionality
- **All open-source contributors**

## Support

For support and questions:

- 📧 Create an issue in the repository
- 📖 Check the [backend documentation](backend/README.md)
- 🔧 Review the [frontend documentation](frontend/README.md)


---
