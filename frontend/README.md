# SAM2 Building Painter Frontend

A modern, interactive web application for AI-powered building segmentation and coloring using Meta AI's Segment Anything Model 2 (SAM2).

## Features

- **Image Upload**: Drag-and-drop or click to upload images of Indian houses and buildings
- **AI Segmentation**: Generate precise masks for walls and architectural elements using SAM2
- **Interactive Selection**: Click on areas to select masks, shift+click for multi-selection
- **Color Painting**: Apply beautiful colors to selected building areas with customizable opacity
- **Real-time Preview**: See your painted results instantly
- **Download Results**: Save your colored building visualizations
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Canvas**: React Konva for interactive image manipulation
- **State Management**: Zustand
- **UI Components**: Custom components with Framer Motion animations
- **API Client**: Axios with comprehensive error handling
- **Notifications**: React Hot Toast

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

### 3. Select Areas
- **Click anywhere** on the image to select the corresponding area
- **Shift+click** to add or remove areas from your selection
- **Toggle "Show All Masks"** to see all available segmentation areas
- Selected areas will be highlighted

### 4. Choose Colors
- Use the color palette to select your desired color
- Colors are optimized for building visualization
- The selected color is displayed in the preview

### 5. Paint Areas
- Click "Paint Selected Areas" to apply the color to your selection
- Adjust opacity if needed (default: 70%)
- The painted result will appear below the canvas

### 6. Download Results
- Click "Download Result" to save your painted building image
- Images are saved in PNG format with high quality

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page component
├── components/            # React components
│   ├── UploadZone.tsx     # Image upload component
│   ├── InteractiveCanvas.tsx # Canvas with Konva
│   ├── ColorPalette.tsx   # Color selection
│   └── Toolbar.tsx        # Action buttons
├── lib/                   # Utilities
│   └── api.ts            # API client
├── store/                 # State management
│   └── useAppStore.ts    # Zustand store
├── types/                 # TypeScript types
│   └── index.ts          # Type definitions
├── public/               # Static assets
└── package.json          # Dependencies
```

## API Integration

The frontend communicates with the SAM2 backend API through the following endpoints:

- `POST /upload` - Upload image
- `POST /generate-masks` - Generate segmentation masks
- `POST /get-mask-at-point` - Get mask at specific point
- `POST /paint-multiple-masks` - Paint selected areas
- `POST /download-painted-image` - Download result
- `GET /health` - Health check

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

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
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
- React Konva for canvas functionality
- All open-source contributors 