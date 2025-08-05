# SAM2 Building Painter Backend

A comprehensive FastAPI backend for SAM2 image segmentation with advanced session management, caching, and building wall painting capabilities.

## 🏗️ Architecture

This backend consists of two main components:

1. **Local FastAPI Server** (`main.py`) - Handles file uploads, session management, caching, and provides a unified API
2. **Modal SAM2 Service** (`modal_sam2.py`) - Deploys SAM2 model on Modal with A100 GPU acceleration

## ✨ Features

### ✅ Complete Requirements Satisfaction

- **Image Processing**: Handles base64 encoded images and file uploads
- **SAM2 Integration**: Well-integrated with Modal deployment using A100 GPU
- **Point-based Segmentation**: Click-based mask generation with instant caching
- **Automatic Mask Generation**: Creates all possible masks for an image with configurable parameters
- **Mask Combination**: Merges multiple masks into one for larger areas
- **Color Application**: Paints masks with custom colors and opacity control
- **Advanced Caching**: Intelligent caching system for embeddings and masks
- **CORS Configuration**: Properly set up for frontend integration
- **Error Handling**: Comprehensive error responses and logging
- **Image Download Support**: Returns base64 encoded final images and file downloads
- **File Upload Handling**: Complete file upload with validation and size limits
- **Session Management**: Full session lifecycle management with automatic cleanup
- **Mask Persistence**: Stores and retrieves masks between requests
- **Advanced Image Download**: Direct file downloads with format support (PNG/JPG)
- **Download Management**: File listing and management capabilities
- **Health Monitoring**: Comprehensive health checks and status monitoring

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Deploy Modal SAM2 Service

```bash
# Install Modal CLI
pip install modal

# Authenticate with Modal
modal token new

# Deploy the SAM2 service
python modal_sam2.py
```

### 3. Start Local Backend

```bash
# Set environment variables
export MODAL_BASE_URL="https://your-modal-deployment.modal.run"

# Run the server
python main.py
```

### 4. Test the Backend

```bash
python test_backend.py
```

## 📋 API Endpoints

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload` | POST | Upload an image and create a session |
| `/segment` | POST | Segment image with points/boxes/mask prompts |
| `/generate-masks` | POST | Generate all possible masks for an image |
| `/generate-masks-advanced` | POST | Advanced mask generation with caching |
| `/combine-masks` | POST | Combine multiple masks from session storage |
| `/paint-mask` | POST | Paint a single mask on an image |
| `/paint-multiple-masks` | POST | Paint multiple masks on an image |
| `/download-image` | POST | Download original image in specified format |
| `/download-painted-image` | POST | Download painted image in specified format |
| `/download-file/{filename}` | GET | Download specific file from server |
| `/list-downloads` | GET | List all available downloads |
| `/session/{session_id}` | GET | Get session information |
| `/session/{session_id}` | DELETE | Delete session and files |
| `/health` | GET | Health check |
| `/` | GET | API documentation |

### Advanced Caching Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/get-embedding` | POST | Get image embedding for caching |
| `/generate-masks-cached` | POST | Generate masks with intelligent caching |
| `/get-mask-at-point-instant` | POST | Instant mask selection from cached masks |
| `/generate-mask-at-point-cached` | POST | Generate mask at point with caching |
| `/clear-cache` | POST | Clear all cached data |
| `/cache-status` | GET | Get cache status and statistics |

## 🔧 Configuration

### Environment Variables

```env
MODAL_BASE_URL=https://your-modal-deployment.modal.run
UPLOAD_DIR=uploads
MASKS_DIR=masks
RESULTS_DIR=results
MAX_FILE_SIZE=52428800
```

### File Limits

- **Maximum file size**: 50MB
- **Supported formats**: JPG, JPEG, PNG, BMP, TIFF
- **Download formats**: PNG, JPG (with quality control)

## 📝 Usage Examples

### 1. Upload Image

```python
import httpx

async with httpx.AsyncClient() as client:
    with open("building.jpg", "rb") as f:
        files = {"file": ("building.jpg", f, "image/jpeg")}
        response = await client.post("http://localhost:8000/upload", files=files)
    
    data = response.json()
    session_id = data["session_id"]
```

### 2. Segment with Points

```python
payload = {
    "session_id": session_id,
    "points": [
        {"x": 500, "y": 300, "label": 1}  # Foreground point
    ]
}

response = await client.post("http://localhost:8000/segment", json=payload)
```

### 3. Generate All Masks

```python
payload = {
    "session_id": session_id,
    "points_per_side": 32,
    "pred_iou_thresh": 0.88,
    "stability_score_thresh": 0.95
}

response = await client.post("http://localhost:8000/generate-masks", json=payload)
```

### 4. Generate Masks with Caching

```python
payload = {
    "session_id": session_id,
    "image_hash": "abc123",  # Optional for caching
    "points_per_side": 32,
    "pred_iou_thresh": 0.88,
    "stability_score_thresh": 0.95
}

response = await client.post("http://localhost:8000/generate-masks-cached", json=payload)
```

### 5. Get Instant Mask at Point

```python
payload = {
    "session_id": session_id,
    "point": [500, 300],
    "image_hash": "abc123",
    "all_masks": [...]  # Pre-generated masks
}

response = await client.post("http://localhost:8000/get-mask-at-point-instant", json=payload)
```

### 6. Paint Mask

```python
payload = {
    "session_id": session_id,
    "mask_id": 5,
    "color": "#FF0000",
    "opacity": 0.7
}

response = await client.post("http://localhost:8000/paint-mask", json=payload)
```

### 7. Download Original Image

```python
# Download as PNG
payload = {
    "session_id": session_id,
    "format": "PNG"
}

response = await client.post("http://localhost:8000/download-image", json=payload)
data = response.json()
download_url = f"http://localhost:8000{data['image_url']}"

# Download the file
file_response = await client.get(download_url)
with open("downloaded_image.png", "wb") as f:
    f.write(file_response.content)
```

### 8. Download Painted Image

```python
# Download painted image as JPG
payload = {
    "session_id": session_id,
    "mask_id": 5,
    "color": "#FF0000",
    "opacity": 0.7,
    "format": "JPG",
    "quality": 90
}

response = await client.post("http://localhost:8000/download-painted-image", json=payload)
data = response.json()
download_url = f"http://localhost:8000{data['image_url']}"

# Download the file
file_response = await client.get(download_url)
with open("painted_image.jpg", "wb") as f:
    f.write(file_response.content)
```

### 9. List Available Downloads

```python
response = await client.get("http://localhost:8000/list-downloads")
data = response.json()

for download in data['downloads']:
    print(f"File: {download['filename']}, Size: {download['size_bytes']} bytes")
    print(f"Download URL: {download['download_url']}")
```

### 10. Cache Management

```python
# Get cache status
response = await client.get("http://localhost:8000/cache-status")
data = response.json()
print(f"Total sessions: {data['total_sessions']}")
print(f"Cached sessions: {data['sessions_with_cache']}")

# Clear cache
response = await client.post("http://localhost:8000/clear-cache")
```

## 🗂️ Session Management

### Session Lifecycle

1. **Creation**: Upload an image to create a session
2. **Storage**: Session stores image data, generated masks, and cached embeddings
3. **Retrieval**: Use session_id to access stored data
4. **Cleanup**: Automatic cleanup after 1 hour or manual deletion

### Session Data Structure

```json
{
  "session_id": "uuid",
  "file_path": "uploads/uuid_filename.jpg",
  "filename": "original_filename.jpg",
  "width": 1920,
  "height": 1080,
  "created_at": "2024-01-01T12:00:00",
  "stored_masks": {
    "0": {"mask": "base64", "score": 0.95, "bbox": [x1, y1, x2, y2]},
    "1": {"mask": "base64", "score": 0.88, "bbox": [x1, y1, x2, y2]}
  },
  "image_data": "base64-encoded-image",
  "embedding_cache": "base64-encoded-embedding"
}
```

## 🔄 Advanced Caching System

### Caching Features

- **Embedding Caching**: Stores image embeddings for faster processing
- **Mask Caching**: Caches generated masks for instant retrieval
- **Hash-based Lookup**: Uses image hash for efficient cache management
- **Automatic Cleanup**: Removes old cache entries automatically
- **Cache Statistics**: Provides detailed cache usage information

### Cache Benefits

- **Instant Mask Selection**: Pre-generated masks for immediate point selection
- **Faster Processing**: Reuses embeddings for multiple operations
- **Reduced GPU Usage**: Minimizes redundant computations
- **Better User Experience**: Responsive interface with cached results

## 📥 Advanced Download Features

### Download Formats

- **PNG**: Lossless format, good for images with transparency
- **JPG**: Compressed format, smaller file sizes, quality control (1-100)

### Download Endpoints

#### Original Image Download
```python
POST /download-image
{
  "session_id": "uuid",
  "format": "PNG",  # or "JPG"
  "quality": 95     # for JPG (1-100)
}
```

#### Painted Image Download
```python
POST /download-painted-image
{
  "session_id": "uuid",
  "mask_id": 5,     # or "mask": "base64"
  "color": "#FF0000",
  "opacity": 0.7,
  "format": "JPG",
  "quality": 90
}
```

#### Direct File Download
```python
GET /download-file/{filename}
# Returns file as streaming response with proper headers
```

#### Download Management
```python
GET /list-downloads
# Returns list of all available downloads with metadata
```

### Download Features

- **Format Support**: PNG and JPG with quality control
- **File Management**: Automatic file organization in results directory
- **Security**: Filename validation to prevent directory traversal
- **Metadata**: File size and format information
- **Streaming**: Efficient file downloads with proper headers
- **Cleanup**: Automatic cleanup of old files

## 🔍 Monitoring

### Health Check

```bash
curl "http://localhost:8000/health"
```

Response:
```json
{
  "status": "healthy",
  "modal_status": {"status": "healthy"},
  "timestamp": "2024-01-01T12:00:00",
  "sessions_count": 5,
  "cache_status": {
    "total_sessions": 10,
    "sessions_with_cache": 3,
    "total_cached_masks": 150,
    "total_cached_embeddings": 3
  }
}
```

### Logging

The application uses structured logging:
- **INFO**: Normal operations
- **ERROR**: Error conditions
- **WARNING**: Potential issues
- **DEBUG**: Detailed debugging information

## 🐛 Troubleshooting

### Common Issues

1. **Modal connection failed**
   - Check Modal deployment status
   - Verify environment variables
   - Check network connectivity

2. **Session not found**
   - Verify session_id is correct
   - Check if session was cleaned up
   - Ensure session was created properly

3. **File upload failed**
   - Check file size limits
   - Verify file format
   - Ensure disk space available

4. **Download failed**
   - Check if file exists in results directory
   - Verify filename format
   - Ensure proper permissions

5. **Cache issues**
   - Check cache status endpoint
   - Clear cache if needed
   - Verify image hash generation

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📊 Performance

### **🚀 GPU-Intensive Operations (Need Modal SAM2):**

1. **SAM2 Model Inference** - Neural network processing
2. **Automatic Mask Generation** - Complex AI processing
3. **Image Segmentation with Points/Boxes** - AI model inference
4. **Mask Generation at Point** - AI model inference

### **💻 CPU-Capable Operations (Can be done locally):**

1. **Image Upload/Processing** - File handling
2. **Mask Combination** - Simple pixel operations
3. **Image Painting** - Pixel manipulation
4. **Cache Management** - Data storage
5. **Session Management** - Data handling
6. **File Downloads** - File operations
7. **Instant Mask Lookup** - Data retrieval

### Timeouts

- **Upload**: 60 seconds
- **Segmentation**: 60 seconds
- **Mask Generation**: 120 seconds
- **Painting**: 60 seconds
- **Download**: 30 seconds

### Memory Management

- **Session cleanup**: Automatic after 1 hour
- **Mask storage**: In-memory with session
- **File storage**: Local disk with cleanup
- **Download files**: Stored in results directory
- **Cache management**: Intelligent cleanup of old cache entries

## 🔒 Security

### CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### File Validation

- File extension validation
- File size limits
- Content type checking
- Filename security validation

## 📚 API Documentation

Once deployed, access the interactive API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🧪 Testing

Run the comprehensive test suite:

```bash
python test_backend.py
```

This will test all major endpoints and functionality including the new caching and download features.

## 📁 Project Structure

```
backend/
├── main.py                 # Unified FastAPI backend with caching
├── modal_sam2.py          # Modal SAM2 deployment with A100 GPU
├── requirements.txt        # Python dependencies
├── test_backend.py        # Comprehensive test suite
├── README.md              # This file
├── uploads/               # Uploaded files
├── masks/                 # Generated masks
└── results/               # Processed results and downloads
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the logs for error details
2. Verify Modal deployment status
3. Test individual endpoints
4. Review session management
5. Check cache status
6. Review the deployment guide 