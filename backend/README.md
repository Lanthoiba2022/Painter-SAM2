# SAM2 Building Painter Backend

A unified backend API for SAM2 image segmentation with session management and building wall painting capabilities.

## 🏗️ Architecture

This backend consists of two main components:

1. **Local FastAPI Server** (`main.py`) - Handles file uploads, session management, and provides a unified API
2. **Modal SAM2 Service** (`modal_sam2.py`) - Deploys SAM2 model on Modal with GPU acceleration

## ✨ Features

### ✅ Complete Requirements Satisfaction

- **Image Processing**: Handles base64 encoded images properly
- **SAM2 Integration**: Well-integrated with Modal deployment
- **Point-based Segmentation**: Click-based mask generation
- **Automatic Mask Generation**: Creates all possible masks for an image
- **Mask Combination**: Merges multiple masks into one
- **Color Application**: Paints masks with custom colors and opacity
- **CORS Configuration**: Properly set up for frontend integration
- **Error Handling**: Comprehensive error responses and logging
- **Image Download Support**: Returns base64 encoded final images
- **File Upload Handling**: Complete file upload with validation
- **Session Management**: Full session lifecycle management
- **Mask Persistence**: Stores and retrieves masks between requests
- **Advanced Image Download**: Direct file downloads with format support (PNG/JPG)
- **Download Management**: File listing and management capabilities

## 🚀 Quick Start

### 1. Install Dependencies

```bash
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

## 🔧 Configuration

### Environment Variables

```env
MODAL_BASE_URL=https://your-modal-deployment.modal.run
MODAL_HEALTH_URL=https://your-modal-deployment.modal.run
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

### 4. Paint Mask

```python
payload = {
    "session_id": session_id,
    "mask_id": 5,
    "color": "#FF0000",
    "opacity": 0.7
}

response = await client.post("http://localhost:8000/paint-mask", json=payload)
```

### 5. Download Original Image

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

### 6. Download Painted Image

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

### 7. List Available Downloads

```python
response = await client.get("http://localhost:8000/list-downloads")
data = response.json()

for download in data['downloads']:
    print(f"File: {download['filename']}, Size: {download['size_bytes']} bytes")
    print(f"Download URL: {download['download_url']}")
```

## 🗂️ Session Management

### Session Lifecycle

1. **Creation**: Upload an image to create a session
2. **Storage**: Session stores image data and generated masks
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
  "image_data": "base64-encoded-image"
}
```

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
  "sessions_count": 5
}
```

### Logging

The application uses structured logging:
- **INFO**: Normal operations
- **ERROR**: Error conditions
- **WARNING**: Potential issues

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

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📊 Performance

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

This will test all major endpoints and functionality including the new download features.

## 📁 Project Structure

```
backend/
├── main.py                 # Unified FastAPI backend
├── modal_sam2.py          # Modal SAM2 deployment
├── requirements.txt        # Python dependencies
├── test_backend.py        # Comprehensive test suite
├── DEPLOYMENT_GUIDE.md    # Detailed deployment guide
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
5. Check the deployment guide 