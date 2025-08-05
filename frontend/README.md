# SAM2 Building Painter Frontend

A modern, interactive web application for building segmentation and coloring using Meta AI's Segment Anything Model 2 (SAM2). Built with Next.js 14, TypeScript, and advanced caching for optimal performance.

## Features

- **Image Upload**: Drag-and-drop or click to upload images of buildings and houses
- **AI Segmentation**: Generate precise masks for walls and architectural elements using SAM2
- **Interactive Selection**: Click on areas to select masks, shift+click for multi-selection
- **Hover Preview**: Hover over areas to see instant mask previews
- **Color Painting**: Apply beautiful colors to selected building areas with customizable opacity
- **Real-time Preview**: See your painted results instantly
- **Download Results**: Save your colored building visualizations
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Advanced Caching**: Intelligent caching for faster mask generation and instant point selection
- **Session Management**: Persistent sessions with automatic cleanup

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Canvas**: HTML5 Canvas with custom rendering
- **State Management**: Zustand with persistence
- **UI Components**: Custom components with Framer Motion animations
- **API Client**: Axios with comprehensive error handling
- **Notifications**: React Hot Toast
- **Color Picker**: React Colorful
- **File Upload**: React Dropzone

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend API running (see backend setup)

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the frontend directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Guide

### 1. Upload an Image
- Drag and drop an image file onto the upload zone, or click to browse
- Supported formats: JPG, PNG, BMP, TIFF (max 50MB)
- The image will be processed and displayed in the canvas

### 2. Generate Masks
- Click the "Generate Masks" button to create segmentation masks
- This process uses SAM2 AI model and may take a few minutes
- Once complete, you'll see the number of generated masks
- Masks are cached for faster subsequent operations

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
- Multiple colors can be applied to different areas

### 6. Download Results
- Click "Download Result" to save your painted building image
- Images are saved in PNG format with high quality
- Multiple download formats supported

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page component
├── components/            # React components
│   ├── UploadZone.tsx     # Image upload component
│   ├── InteractiveCanvas.tsx # Canvas with custom rendering
│   ├── ColorPalette.tsx   # Color selection
│   ├── Toolbar.tsx        # Action buttons
│   ├── MaskGallery.tsx    # Mask display and management
│   ├── ClientOnly.tsx     # Client-side only wrapper
│   └── HelpModal.tsx      # Help and instructions
├── lib/                   # Utilities
│   └── api.ts            # API client with caching
├── store/                 # State management
│   └── useAppStore.ts    # Zustand store with persistence
├── types/                 # TypeScript types
│   └── index.ts          # Type definitions
├── public/               # Static assets
└── package.json          # Dependencies
```

## API Integration

The frontend communicates with the SAM2 backend API through the following endpoints:

### Core Endpoints
- `POST /upload` - Upload image and create session
- `POST /generate-masks` - Generate segmentation masks
- `POST /get-mask-at-point` - Get mask at specific point
- `POST /paint-multiple-masks` - Paint selected areas
- `POST /download-painted-image` - Download result
- `GET /health` - Health check

### Advanced Caching Endpoints
- `POST /get-embedding` - Get image embedding for caching
- `POST /generate-masks-cached` - Generate masks with intelligent caching
- `POST /get-mask-at-point-instant` - Instant mask selection from cached masks
- `POST /generate-mask-at-point-cached` - Generate mask at point with caching
- `POST /clear-cache` - Clear all cached data
- `GET /cache-status` - Get cache status and statistics

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Tailwind CSS for styling

### State Management

The application uses Zustand for state management with the following key states:

- `sessionId` - Current session identifier
- `imageData` - Uploaded image data
- `masks` - Generated segmentation masks
- `selectedMasks` - Currently selected mask IDs
- `coloredMasks` - Masks with applied colors
- `paintedImage` - Final painted result
- `currentColor` - Currently selected color
- `currentOpacity` - Current opacity setting
- `showAllMasks` - Toggle for showing all masks
- `hoveredMaskId` - Currently hovered mask ID
- `isClickToGenerateMode` - Click-to-generate mode toggle

### Advanced Caching State

- `embeddingCache` - Cached image embeddings
- `maskCache` - Cached generated masks
- `currentImageHash` - Current image hash for caching
- `isEmbeddingCached` - Whether embedding is cached
- `isMaskCached` - Whether masks are cached

### Key Components

#### InteractiveCanvas
- Custom HTML5 Canvas implementation
- Real-time mask rendering and selection
- Hover effects for instant mask preview
- Multi-selection with shift+click
- Responsive design with proper aspect ratio

#### ColorPalette
- Predefined color palette for building visualization
- Custom color picker integration
- Opacity control slider
- Color preview and selection

#### UploadZone
- Drag-and-drop file upload
- File validation and size limits
- Progress indicators
- Error handling and user feedback

#### Toolbar
- Action buttons for all major operations
- Loading states and progress indicators
- Help and instructions modal
- Download functionality

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   ```env
   NEXT_PUBLIC_API_URL=https://your-backend-api.com
   ```
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

### Environment Variables

Set the following environment variables in production:

```env
NEXT_PUBLIC_API_URL=https://your-backend-api.com
```

## Performance Optimization

- **Image Optimization**: Large images are automatically resized
- **Lazy Loading**: Components load only when needed
- **Caching**: API responses are cached where appropriate
- **Bundle Splitting**: Code is split for optimal loading
- **Canvas Optimization**: Efficient rendering with requestAnimationFrame
- **Memory Management**: Proper cleanup of canvas contexts and event listeners

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Check the backend documentation
- Review the API documentation

## Acknowledgments

- Meta AI for SAM2
- Next.js team for the amazing framework
- Zustand for state management
- All open-source contributors 