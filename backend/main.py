from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import uvicorn
import os
import uuid
import json
import base64
import numpy as np
from PIL import Image
import io
from typing import List, Dict, Any, Optional, Tuple, Union
import aiofiles
import httpx
from datetime import datetime, timedelta
import asyncio
import logging
import cv2
import numpy as np
from PIL import Image, ImageDraw
import io
import base64

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="SAM2 Building Painter API",
    description="Complete API for SAM2 image segmentation with session management and building wall painting",
    version="1.0.0"
)

# CORS middleware with increased request size for large file uploads
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
UPLOAD_DIR = "uploads"
MASKS_DIR = "masks"
RESULTS_DIR = "results"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}

# Create directories
for directory in [UPLOAD_DIR, MASKS_DIR, RESULTS_DIR]:
    os.makedirs(directory, exist_ok=True)

# In-memory storage for session data with mask persistence
sessions: Dict[str, Dict[str, Any]] = {}

# Pydantic models for comprehensive API
class Point(BaseModel):
    x: int
    y: int
    label: int  # 1 for foreground, 0 for background

class BoundingBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int

class SegmentationRequest(BaseModel):
    session_id: str
    points: Optional[List[Point]] = None
    boxes: Optional[List[BoundingBox]] = None
    mask: Optional[str] = None  # base64 encoded binary mask

class SegmentationResponse(BaseModel):
    session_id: str
    mask: str  # base64 encoded binary mask
    score: Optional[float] = None
    bbox: Optional[List[int]] = None

class UploadResponse(BaseModel):
    session_id: str
    image_data: str  # base64 encoded image
    width: int
    height: int
    message: str

class SessionResponse(BaseModel):
    session_id: str
    message: str

# New models for comprehensive functionality
class GenerateMasksRequest(BaseModel):
    session_id: str
    points_per_side: Optional[int] = 96  # Increased from 32 for better coverage
    pred_iou_thresh: Optional[float] = 0.7  # Lowered from 0.88 for more masks
    stability_score_thresh: Optional[float] = 0.8  # Lowered from 0.95 for more masks

class MaskInfo(BaseModel):
    id: int
    mask: str
    score: Optional[float] = None
    bbox: Optional[List[float]] = None
    area: Optional[int] = None
    stability_score: Optional[float] = None

class GenerateMasksResponse(BaseModel):
    session_id: str
    masks: List[MaskInfo]
    total_masks: int
    width: int
    height: int

class CombineMasksRequest(BaseModel):
    session_id: str
    mask_ids: List[int]  # IDs of masks to combine

class CombineMasksResponse(BaseModel):
    session_id: str
    combined_mask: str
    width: int
    height: int
    num_masks_combined: int

class GetMaskAtPointRequest(BaseModel):
    session_id: str
    point: List[int]  # [x, y]
    all_masks: List[Dict[str, Any]]  # All pre-generated masks

class GenerateMaskAtPointRequest(BaseModel):
    session_id: str
    point: List[int]  # [x, y]

class PaintMaskRequest(BaseModel):
    session_id: str
    mask_id: Optional[int] = None  # Use stored mask by ID
    mask: Optional[str] = None  # Or provide mask directly
    color: str  # Hex color code
    opacity: Optional[float] = 0.7

class PaintMaskResponse(BaseModel):
    session_id: str
    painted_image: str
    width: int
    height: int

class PaintMultipleMasksRequest(BaseModel):
    session_id: str
    colored_masks: List[Dict[str, Any]]  # List of {mask_id: int, color: str, opacity: float}

class PaintMultipleMasksResponse(BaseModel):
    session_id: str
    painted_image: str
    width: int
    height: int
    num_masks_painted: int

class SessionInfoResponse(BaseModel):
    session_id: str
    filename: str
    width: int
    height: int
    created_at: str
    stored_masks: int
    message: str

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

class DownloadImageRequest(BaseModel):
    session_id: str
    format: str = "PNG"  # PNG or JPG
    quality: Optional[int] = 95  # For JPG quality (1-100)

class DownloadImageResponse(BaseModel):
    session_id: str
    image_url: str
    format: str
    size_bytes: int
    message: str

class DownloadPaintedImageRequest(BaseModel):
    session_id: str
    mask_id: Optional[int] = None
    mask: Optional[str] = None
    color: str = "#FF0000"
    opacity: float = 0.7
    format: str = "PNG"
    quality: Optional[int] = 95

class DownloadPaintedImageResponse(BaseModel):
    session_id: str
    image_url: str
    format: str
    size_bytes: int
    message: str

# Utility functions
def get_file_extension(filename: str) -> str:
    """Get file extension from filename"""
    return os.path.splitext(filename.lower())[1]

def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return get_file_extension(filename) in ALLOWED_EXTENSIONS

def create_session_id() -> str:
    """Generate unique session ID"""
    return str(uuid.uuid4())

async def save_uploaded_file(file: UploadFile, filepath: str) -> None:
    """Save uploaded file to disk"""
    async with aiofiles.open(filepath, 'wb') as f:
        content = await file.read()
        await f.write(content)

def image_to_base64(image: Image.Image) -> str:
    """Convert PIL image to base64 string with optimization for large images"""
    buffer = io.BytesIO()
    
    # Use JPEG for large images to reduce size
    if image.width * image.height > 2000 * 2000:  # 4MP threshold
        # Convert to RGB if necessary for JPEG
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        image.save(buffer, format='JPEG', quality=85, optimize=True)
    else:
        image.save(buffer, format='PNG', optimize=True)
    
    return base64.b64encode(buffer.getvalue()).decode()

def base64_to_image(base64_str: str) -> Image.Image:
    """Convert base64 string to PIL image"""
    image_data = base64.b64decode(base64_str)
    return Image.open(io.BytesIO(image_data))

def mask_to_base64(mask_array: np.ndarray) -> str:
    """Convert numpy mask array to base64 string"""
    # Ensure mask is binary (0 or 1)
    mask_binary = (mask_array > 0).astype(np.uint8) * 255
    mask_image = Image.fromarray(mask_binary, mode='L')
    buffer = io.BytesIO()
    mask_image.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode()

def base64_to_mask(base64_str: str) -> np.ndarray:
    """Convert base64 string to numpy mask array"""
    mask_data = base64.b64decode(base64_str)
    mask_image = Image.open(io.BytesIO(mask_data)).convert('L')
    return np.array(mask_image) > 0

def save_image_to_disk(image_data: str, filename: str, format: str = "PNG", quality: int = 95) -> str:
    """Save base64 image to disk and return file path"""
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Create results directory if it doesn't exist
        os.makedirs(RESULTS_DIR, exist_ok=True)
        
        # Generate file path
        file_path = os.path.join(RESULTS_DIR, filename)
        
        # Save with specified format and quality
        if format.upper() == "JPG" or format.upper() == "JPEG":
            # Convert to RGB if needed for JPG
            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB')
            image.save(file_path, format='JPEG', quality=quality, optimize=True)
        else:
            # PNG format
            image.save(file_path, format='PNG', optimize=True)
        
        return file_path
        
    except Exception as e:
        logger.error(f"Error saving image to disk: {str(e)}")
        raise ValueError(f"Failed to save image: {str(e)}")

def get_file_size(file_path: str) -> int:
    """Get file size in bytes"""
    try:
        return os.path.getsize(file_path)
    except Exception:
        return 0

def paint_multiple_masks_local(image_data: str, colored_masks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Local fallback for painting multiple masks without Modal"""
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        image_array = np.array(image)
        
        # Convert to RGB if needed
        if len(image_array.shape) == 3 and image_array.shape[2] == 4:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGBA2RGB)
        
        painted_image = image_array.copy()
        
        for colored_mask in colored_masks:
            mask_data = colored_mask.get('mask')
            color = colored_mask.get('color', '#FF0000')
            opacity = colored_mask.get('opacity', 0.7)
            
            if not mask_data:
                continue
                
            # Decode mask
            mask_bytes = base64.b64decode(mask_data)
            mask_image = Image.open(io.BytesIO(mask_bytes))
            mask_array = np.array(mask_image)
            
            # Convert mask to binary (0 or 255)
            if len(mask_array.shape) == 3:
                mask_array = mask_array[:, :, 0]  # Take first channel
            mask_binary = (mask_array > 128).astype(np.uint8) * 255
            
            # Convert hex color to RGB
            color_rgb = tuple(int(color[i:i+2], 16) for i in (1, 3, 5))  # Skip '#'
            
            # Create colored overlay
            colored_overlay = np.zeros_like(painted_image)
            colored_overlay[mask_binary > 0] = color_rgb
            
            # Blend with original image
            mask_normalized = mask_binary.astype(np.float32) / 255.0
            mask_normalized = np.expand_dims(mask_normalized, axis=2)
            
            painted_image = (
                painted_image * (1 - mask_normalized * opacity) +
                colored_overlay * mask_normalized * opacity
            ).astype(np.uint8)
        
        # Encode result
        result_image = Image.fromarray(painted_image)
        buffer = io.BytesIO()
        result_image.save(buffer, format='PNG')
        result_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            'painted_image': result_base64,
            'width': painted_image.shape[1],
            'height': painted_image.shape[0],
            'num_masks_painted': len(colored_masks)
        }
        
    except Exception as e:
        logger.error(f"Local paint_multiple_masks error: {str(e)}")
        raise e

class SAM2Service:
    def __init__(self):
        # Modal endpoints - using the deployed Modal app
        self.modal_base_url = os.getenv("MODAL_BASE_URL", "https://internship304--sam2-building-painter-fastapi-app-modal.modal.run")
        self.modal_health_url = os.getenv("MODAL_HEALTH_URL", "https://internship304--sam2-building-painter-fastapi-app-modal.modal.run/health")
        logger.info(f"Initialized SAM2Service with Modal endpoint: {self.modal_base_url}")
        
    async def segment_image(self, image_data: str, points: Optional[List[Point]] = None, 
                           boxes: Optional[List[BoundingBox]] = None, 
                           mask: Optional[str] = None) -> Dict[str, Any]:
        """Segment image using SAM2 with points, boxes, or mask prompts"""
        try:
            # Prepare request payload for Modal
            payload = {"image_data": image_data}
            
            if points:
                payload["points"] = [[p.x, p.y] for p in points]
                payload["point_labels"] = [p.label for p in points]
            
            if boxes:
                payload["boxes"] = [[b.x1, b.y1, b.x2, b.y2] for b in boxes]
            
            if mask:
                payload["mask"] = mask
            
            # Call Modal endpoint
            async with httpx.AsyncClient() as client:
                logger.info(f"Calling Modal segment endpoint: {self.modal_base_url}/segment")
                response = await client.post(
                    f"{self.modal_base_url}/segment",
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                result = response.json()
                
                # Check if Modal returned an error
                if "error" in result:
                    raise Exception(f"Modal error: {result['error']}")
                
                return result
                    
        except Exception as e:
            logger.error(f"Error segmenting image: {str(e)}")
            raise e
    
    async def generate_all_masks(self, image_data: str, points_per_side: int = 96,
                                pred_iou_thresh: float = 0.7, 
                                stability_score_thresh: float = 0.8) -> Dict[str, Any]:
        """Generate all possible masks for the entire image"""
        try:
            payload = {
                "image_data": image_data,
                "points_per_side": points_per_side,
                "pred_iou_thresh": pred_iou_thresh,
                "stability_score_thresh": stability_score_thresh
            }
            
            async with httpx.AsyncClient() as client:
                logger.info(f"Calling Modal generate-masks endpoint: {self.modal_base_url}/generate-masks")
                response = await client.post(
                    f"{self.modal_base_url}/generate-masks",
                    json=payload,
                    timeout=120.0
                )
                response.raise_for_status()
                result = response.json()
                
                if "error" in result:
                    raise Exception(f"Modal error: {result['error']}")
                
                return result
                    
        except Exception as e:
            logger.error(f"Error generating masks: {str(e)}")
            raise e
    
    async def combine_masks(self, image_data: str, masks: List[str]) -> Dict[str, Any]:
        """Combine multiple masks into one"""
        try:
            payload = {
                "image_data": image_data,
                "masks": masks
            }
            
            async with httpx.AsyncClient() as client:
                logger.info(f"Calling Modal combine-masks endpoint: {self.modal_base_url}/combine-masks")
                response = await client.post(
                    f"{self.modal_base_url}/combine-masks",
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                result = response.json()
                
                if "error" in result:
                    raise Exception(f"Modal error: {result['error']}")
                
                return result
                    
        except Exception as e:
            logger.error(f"Error combining masks: {str(e)}")
            raise e
    
    async def paint_mask(self, image_data: str, mask: str, color: str, opacity: float = 0.7) -> Dict[str, Any]:
        """Paint a single mask on an image"""
        try:
            payload = {
                "image_data": image_data,
                "mask": mask,
                "color": color,
                "opacity": opacity
            }
            
            async with httpx.AsyncClient() as client:
                logger.info(f"Calling Modal paint-mask endpoint: {self.modal_base_url}/paint-mask")
                response = await client.post(
                    f"{self.modal_base_url}/paint-mask",
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                result = response.json()
                
                if "error" in result:
                    raise Exception(f"Modal error: {result['error']}")
                
                logger.info(f"Successfully painted mask with color {color} and opacity {opacity}")
                return result
                    
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error painting mask: {e}")
            raise e
        except Exception as e:
            logger.error(f"Error painting mask: {str(e)}")
            raise e
    
    async def paint_multiple_masks(self, image_data: str, colored_masks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Paint multiple masks on an image"""
        try:
            # Try Modal first
            payload = {
                "image_data": image_data,
                "colored_masks": colored_masks
            }
            
            async with httpx.AsyncClient() as client:
                logger.info(f"Calling Modal paint-multiple-masks endpoint: {self.modal_base_url}/paint-multiple-masks")
                response = await client.post(
                    f"{self.modal_base_url}/paint-multiple-masks",
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                result = response.json()
                
                if "error" in result:
                    raise Exception(f"Modal error: {result['error']}")
                
                return result
                    
        except Exception as e:
            logger.warning(f"Modal paint_multiple_masks failed, using local fallback: {str(e)}")
            # Use local fallback
            return paint_multiple_masks_local(image_data, colored_masks)

    async def get_mask_at_point(self, image_data: str, point: List[int], all_masks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get the best mask at a specific point from pre-generated masks"""
        try:
            payload = {
                "image_data": image_data,
                "point": point,
                "all_masks": all_masks
            }
            
            async with httpx.AsyncClient() as client:
                logger.info(f"Calling Modal get-mask-at-point endpoint: {self.modal_base_url}/get-mask-at-point")
                response = await client.post(
                    f"{self.modal_base_url}/get-mask-at-point",
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                result = response.json()
                
                if "error" in result:
                    raise Exception(f"Modal error: {result['error']}")
                
                return result
                    
        except Exception as e:
            logger.error(f"Error getting mask at point: {str(e)}")
            raise e
    
    async def generate_mask_at_point(self, image_data: str, point: List[int]) -> Dict[str, Any]:
        """Generate a mask for a specific point without generating all masks"""
        try:
            # Use the segment endpoint with a single point as foreground
            payload = {
                "image_data": image_data,
                "points": [point],  # Single point as foreground
                "point_labels": [1]  # 1 for foreground
            }
            
            async with httpx.AsyncClient() as client:
                logger.info(f"Calling Modal segment endpoint for point generation: {self.modal_base_url}/segment")
                response = await client.post(
                    f"{self.modal_base_url}/segment",
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                result = response.json()
                
                if "error" in result:
                    raise Exception(f"Modal error: {result['error']}")
                
                return result
                    
        except Exception as e:
            logger.error(f"Error generating mask at point: {str(e)}")
            raise e
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Modal endpoint health"""
        try:
            async with httpx.AsyncClient() as client:
                logger.info(f"Checking Modal health at: {self.modal_health_url}")
                response = await client.get(self.modal_health_url, timeout=10.0)
                response.raise_for_status()
                result = response.json()
                logger.info(f"Modal health check result: {result}")
                return result
        except Exception as e:
            logger.error(f"Modal health check failed: {str(e)}")
            return {"status": "error", "message": str(e)}



# Initialize SAM2 service
sam2_service = SAM2Service()

async def cleanup_old_sessions():
    """Clean up old sessions (older than 1 hour)"""
    current_time = datetime.now()
    sessions_to_remove = []
    
    for session_id, session_data in sessions.items():
        if 'created_at' in session_data:
            created_at = session_data['created_at']
            if current_time - created_at > timedelta(hours=1):
                sessions_to_remove.append(session_id)
    
    for session_id in sessions_to_remove:
        try:
            # Remove session files
            if 'file_path' in sessions[session_id]:
                os.remove(sessions[session_id]['file_path'])
            del sessions[session_id]
            logger.info(f"Cleaned up old session: {session_id}")
        except Exception as e:
            logger.error(f"Error cleaning up session {session_id}: {e}")

# API Endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "SAM2 Building Painter API",
        "version": "1.0.0",
        "endpoints": {
            "upload": "POST /upload - Upload an image",
            "segment": "POST /segment - Segment image with points/boxes/mask",
            "generate_masks": "POST /generate-masks - Generate all possible masks",
            "generate_mask_at_point": "POST /get-mask-at-point - Generate mask for specific point",
            "combine_masks": "POST /combine-masks - Combine multiple masks",
            "get_mask_at_point": "POST /get-mask-at-point - Get mask at specific point",
            "paint_mask": "POST /paint-mask - Paint a single mask",
            "paint_multiple_masks": "POST /paint-multiple-masks - Paint multiple masks",
            "download_image": "POST /download-image - Download original image",
            "download_painted_image": "POST /download-painted-image - Download painted image",
            "download_file": "GET /download-file/{filename} - Download specific file",
            "list_downloads": "GET /list-downloads - List all downloads",
            "session_info": "GET /session/{session_id} - Get session information",
            "health": "GET /health - Health check",
            "delete_session": "DELETE /session/{session_id} - Delete session"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        modal_health = await sam2_service.health_check()
        return {
            "status": "healthy",
            "modal_status": modal_health,
            "modal_endpoint": sam2_service.modal_base_url,
            "timestamp": datetime.now().isoformat(),
            "sessions_count": len(sessions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.post("/upload", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """Upload an image for segmentation"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if not is_allowed_file(file.filename):
            raise HTTPException(
                status_code=400, 
                detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        
        # Check if we already have a recent session for this file
        file_hash = f"{file.filename}"
        for session_id_existing, session_data in sessions.items():
            if session_data.get('filename') == file.filename:
                # Check if session is recent (within last 5 minutes)
                if (datetime.now() - session_data['created_at']).total_seconds() < 300:
                    logger.info(f"Returning existing session for file: {file.filename}")
                    return UploadResponse(
                        session_id=session_id_existing,
                        image_data=session_data['image_data'],
                        width=session_data['width'],
                        height=session_data['height'],
                        message="Image already uploaded, returning existing session"
                    )
        
        # Create session first
        session_id = create_session_id()
        
        # Save file with streaming to avoid memory issues
        filename = f"{session_id}_{file.filename}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # Stream file to disk to avoid memory issues with large files
        file_size = 0
        async with aiofiles.open(filepath, 'wb') as f:
            while chunk := await file.read(8192):  # 8KB chunks
                await f.write(chunk)
                file_size += len(chunk)
                if file_size > MAX_FILE_SIZE:
                    # Clean up partial file
                    await f.close()
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    raise HTTPException(
                        status_code=400, 
                        detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
                    )
        
        # Load image to get dimensions and validate
        try:
            image = Image.open(filepath)
            width, height = image.size
            
            # Check if image is too large (prevent memory issues)
            if width * height > 10000 * 10000:  # 100MP limit
                os.remove(filepath)
                raise HTTPException(
                    status_code=400,
                    detail="Image dimensions too large. Maximum: 10000x10000 pixels"
                )
            
            # Convert to base64 for frontend (with compression for large images)
            if width * height > 5000 * 5000:  # Compress large images
                # Resize large images to prevent memory issues
                max_dimension = 5000
                if width > max_dimension or height > max_dimension:
                    ratio = min(max_dimension / width, max_dimension / height)
                    new_width = int(width * ratio)
                    new_height = int(height * ratio)
                    image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    width, height = new_width, new_height
            
            image_data = image_to_base64(image)
            
        except Exception as img_error:
            # Clean up file if image processing fails
            if os.path.exists(filepath):
                os.remove(filepath)
            logger.error(f"Failed to process image: {str(img_error)}")
            raise HTTPException(status_code=400, detail="Invalid image file")
        
        # Store session data with mask storage
        sessions[session_id] = {
            'file_path': filepath,
            'filename': file.filename,
            'width': width,
            'height': height,
            'created_at': datetime.now(),
            'stored_masks': {},  # Dictionary to store masks by ID
            'image_data': image_data  # Store base64 image data
        }
        
        logger.info(f"Created new session: {session_id} for file: {file.filename} ({width}x{height})")
        
        return UploadResponse(
            session_id=session_id,
            image_data=image_data,
            width=width,
            height=height,
            message="Image uploaded successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@app.post("/segment", response_model=SegmentationResponse)
async def segment_image(request: SegmentationRequest):
    """Segment image with points, boxes, or mask prompts"""
    try:
        session_id = request.session_id
        
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        # Validate that at least one prompt is provided
        if not request.points and not request.boxes and not request.mask:
            raise HTTPException(
                status_code=400, 
                detail="At least one prompt (points, boxes, or mask) must be provided"
            )
        
        # Call SAM2 service
        result = await sam2_service.segment_image(
            session_data['image_data'],
            points=request.points,
            boxes=request.boxes,
            mask=request.mask
        )
        
        return SegmentationResponse(
            session_id=session_id,
            mask=result['mask'],
            score=result.get('score'),
            bbox=result.get('bbox')
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to segment image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to segment image: {str(e)}")

# In the /generate-masks endpoint, set higher points_per_side and lower thresholds by default
@app.post("/generate-masks", response_model=GenerateMasksResponse)
async def generate_masks(request: GenerateMasksRequest):
    """Generate all possible masks for an image with improved parameters for better coverage"""
    try:
        session_id = request.session_id
        # Improved default parameters for better mask generation
        points_per_side = request.points_per_side or 96  # Increased from 32 for more coverage
        pred_iou_thresh = request.pred_iou_thresh or 0.7  # Lowered from 0.88 for more masks
        stability_score_thresh = request.stability_score_thresh or 0.8  # Lowered from 0.95 for more masks
        
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        # Call SAM2 service with improved parameters for better mask generation
        result = await sam2_service.generate_all_masks(
            session_data['image_data'],
            points_per_side=points_per_side,
            pred_iou_thresh=pred_iou_thresh,
            stability_score_thresh=stability_score_thresh
        )
        
        # Store masks in session for later use
        stored_masks = {}
        for mask_info in result['masks']:
            mask_id = mask_info['id']
            stored_masks[mask_id] = {
                'mask': mask_info['mask'],
                'score': mask_info.get('score'),
                'bbox': mask_info.get('bbox'),
                'area': mask_info.get('area'),
                'stability_score': mask_info.get('stability_score')
            }
        
        # Update session with stored masks
        sessions[session_id]['stored_masks'] = stored_masks
        
        return GenerateMasksResponse(
            session_id=session_id,
            masks=[MaskInfo(**mask_info) for mask_info in result['masks']],
            total_masks=result['total_masks'],
            width=result['width'],
            height=result['height']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate masks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate masks: {str(e)}")

@app.post("/generate-masks-advanced", response_model=GenerateMasksResponse)
async def generate_masks_advanced(request: GenerateMasksRequest):
    """Generate masks with advanced parameters for maximum coverage"""
    try:
        session_id = request.session_id
        # Use even more aggressive parameters for maximum coverage
        points_per_side = request.points_per_side or 128  # Maximum density
        pred_iou_thresh = request.pred_iou_thresh or 0.6  # Very low threshold for maximum masks
        stability_score_thresh = request.stability_score_thresh or 0.7  # Lower threshold for more masks
        
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        # Call SAM2 service with maximum coverage parameters
        result = await sam2_service.generate_all_masks(
            session_data['image_data'],
            points_per_side=points_per_side,
            pred_iou_thresh=pred_iou_thresh,
            stability_score_thresh=stability_score_thresh
        )
        
        # Store masks in session for later use
        stored_masks = {}
        for mask_info in result['masks']:
            mask_id = mask_info['id']
            stored_masks[mask_id] = {
                'mask': mask_info['mask'],
                'score': mask_info.get('score'),
                'bbox': mask_info.get('bbox'),
                'area': mask_info.get('area'),
                'stability_score': mask_info.get('stability_score')
            }
        
        # Update session with stored masks
        sessions[session_id]['stored_masks'] = stored_masks
        
        return GenerateMasksResponse(
            session_id=session_id,
            masks=[MaskInfo(**mask_info) for mask_info in result['masks']],
            total_masks=result['total_masks'],
            width=result['width'],
            height=result['height']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate advanced masks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate advanced masks: {str(e)}")

@app.post("/combine-masks", response_model=CombineMasksResponse)
async def combine_masks(request: CombineMasksRequest):
    """Combine multiple masks from session storage"""
    try:
        session_id = request.session_id
        
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        stored_masks = session_data.get('stored_masks', {})
        
        if not request.mask_ids:
            raise HTTPException(status_code=400, detail="No mask IDs provided")
        
        # Get masks from storage
        masks_to_combine = []
        for mask_id in request.mask_ids:
            if mask_id not in stored_masks:
                raise HTTPException(status_code=404, detail=f"Mask ID {mask_id} not found in session")
            masks_to_combine.append(stored_masks[mask_id]['mask'])
        
        # Call SAM2 service
        result = await sam2_service.combine_masks(
            session_data['image_data'],
            masks_to_combine
        )
        
        return CombineMasksResponse(
            session_id=session_id,
            combined_mask=result['combined_mask'],
            width=result['width'],
            height=result['height'],
            num_masks_combined=result['num_masks_combined']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to combine masks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to combine masks: {str(e)}")

@app.post("/get-mask-at-point", response_model=SegmentationResponse)
async def get_mask_at_point(request: GetMaskAtPointRequest):
    """Get the best mask at a specific point from pre-generated masks"""
    try:
        logger.info(f"Getting mask at point {request.point} for session: {request.session_id}")
        logger.info(f"Number of masks provided: {len(request.all_masks)}")
        
        # Validate session
        if request.session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[request.session_id]
        image_data = session_data.get("image_data")
        
        if not image_data:
            raise HTTPException(status_code=400, detail="No image data found in session")
        
        # Validate point coordinates
        if len(request.point) != 2:
            raise HTTPException(status_code=400, detail="Point must be [x, y]")
        
        x, y = request.point[0], request.point[1]
        if x < 0 or y < 0:
            raise HTTPException(status_code=400, detail="Point coordinates must be positive")
        
        logger.info(f"Image data length: {len(image_data)} characters")
        logger.info(f"Point coordinates: ({x}, {y})")
        logger.info(f"First mask structure: {request.all_masks[0] if request.all_masks else 'No masks'}")
        
        # Call Modal service with image data
        result = await sam2_service.get_mask_at_point(image_data, request.point, request.all_masks)
        
        logger.info(f"Modal service returned mask with length: {len(result.get('mask', ''))}")
        
        return SegmentationResponse(
            session_id=request.session_id,
            mask=result["mask"],
            score=result.get("score"),
            bbox=result.get("bbox")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mask at point: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get mask at point: {str(e)}")

@app.post("/generate-mask-at-point", response_model=SegmentationResponse)
async def generate_mask_at_point(request: GenerateMaskAtPointRequest):
    """Generate a mask for a specific point without generating all masks"""
    try:
        logger.info(f"Generating mask at point {request.point} for session: {request.session_id}")
        
        # Validate session
        if request.session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[request.session_id]
        image_data = session_data.get("image_data")
        
        if not image_data:
            raise HTTPException(status_code=400, detail="No image data found in session")
        
        # Create a point with label 1 (foreground)
        point = Point(x=request.point[0], y=request.point[1], label=1)
        
        # Use the existing segment endpoint
        result = await sam2_service.segment_image(
            image_data,
            points=[point]
        )
        
        return SegmentationResponse(
            session_id=request.session_id,
            mask=result["mask"],
            score=result.get("score"),
            bbox=result.get("bbox")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating mask at point: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate mask at point: {str(e)}")

@app.post("/paint-mask", response_model=PaintMaskResponse)
async def paint_mask(request: PaintMaskRequest):
    """Paint a single mask on an image"""
    try:
        session_id = request.session_id
        
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        # Get mask either from storage or direct input
        mask_data = None
        if request.mask_id is not None:
            stored_masks = session_data.get('stored_masks', {})
            if request.mask_id not in stored_masks:
                raise HTTPException(status_code=404, detail=f"Mask ID {request.mask_id} not found in session")
            mask_data = stored_masks[request.mask_id]['mask']
        elif request.mask:
            mask_data = request.mask
        else:
            raise HTTPException(status_code=400, detail="Either mask_id or mask must be provided")
        
        # Call SAM2 service with improved error handling
        try:
            result = await sam2_service.paint_mask(
                session_data['image_data'],
                mask_data,
                request.color,
                request.opacity or 0.7
            )
        except Exception as e:
            logger.error(f"Error painting mask: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to paint mask: {str(e)}")
        
        return PaintMaskResponse(
            session_id=session_id,
            painted_image=result['painted_image'],
            width=result['width'],
            height=result['height']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to paint mask: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to paint mask: {str(e)}")

@app.post("/paint-multiple-masks", response_model=PaintMultipleMasksResponse)
async def paint_multiple_masks(request: PaintMultipleMasksRequest):
    """Paint multiple masks on an image"""
    try:
        session_id = request.session_id
        
        # Get image data from session or use provided image data
        image_data = None
        stored_masks = {}
        
        if session_id in sessions:
            session_data = sessions[session_id]
            image_data = session_data.get('image_data')
            stored_masks = session_data.get('stored_masks', {})
        else:
            # Session doesn't exist, this might be a direct painting request
            # We'll need image_data to be provided in the request
            logger.warning(f"Session {session_id} not found, using direct painting")
        
        if not request.colored_masks:
            raise HTTPException(status_code=400, detail="No colored masks provided")
        
        # Prepare colored masks for Modal/local processing
        colored_masks_for_processing = []
        for colored_mask in request.colored_masks:
            mask_id = colored_mask.get('mask_id')
            mask_data = colored_mask.get('mask')  # Direct mask data
            
            if mask_data:
                # Use direct mask data
                colored_masks_for_processing.append({
                    'mask': mask_data,
                    'color': colored_mask.get('color', '#FF0000'),
                    'opacity': colored_mask.get('opacity', 0.7)
                })
            elif mask_id and mask_id in stored_masks:
                # Use stored mask
                colored_masks_for_processing.append({
                    'mask': stored_masks[mask_id]['mask'],
                    'color': colored_mask.get('color', '#FF0000'),
                    'opacity': colored_mask.get('opacity', 0.7)
                })
            else:
                raise HTTPException(status_code=400, detail=f"Invalid mask data for mask_id {mask_id}")
        
        # If we don't have image_data from session, we need it in the request
        if not image_data:
            raise HTTPException(status_code=400, detail="Image data required for painting")
        
        # Call SAM2 service
        result = await sam2_service.paint_multiple_masks(
            image_data,
            colored_masks_for_processing
        )
        
        return PaintMultipleMasksResponse(
            session_id=session_id,
            painted_image=result['painted_image'],
            width=result['width'],
            height=result['height'],
            num_masks_painted=result['num_masks_painted']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to paint multiple masks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to paint multiple masks: {str(e)}")

@app.post("/download-image", response_model=DownloadImageResponse)
async def download_image(request: DownloadImageRequest):
    """Download the original image in specified format"""
    try:
        session_id = request.session_id
        
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        image_data = session_data['image_data']
        
        # Validate format
        format_upper = request.format.upper()
        if format_upper not in ['PNG', 'JPG', 'JPEG']:
            raise HTTPException(status_code=400, detail="Format must be PNG or JPG")
        
        # Generate filename
        base_filename = os.path.splitext(session_data['filename'])[0]
        extension = 'jpg' if format_upper in ['JPG', 'JPEG'] else 'png'
        filename = f"{session_id}_{base_filename}.{extension}"
        
        # Save image to disk
        file_path = save_image_to_disk(
            image_data, 
            filename, 
            format=format_upper,
            quality=request.quality or 95
        )
        
        # Get file size
        size_bytes = get_file_size(file_path)
        
        # Generate download URL (relative to server)
        image_url = f"/download-file/{filename}"
        
        logger.info(f"Image download prepared: {filename}, size: {size_bytes} bytes")
        
        return DownloadImageResponse(
            session_id=session_id,
            image_url=image_url,
            format=format_upper,
            size_bytes=size_bytes,
            message="Image download ready"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to prepare image download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to prepare image download: {str(e)}")

@app.post("/download-painted-image", response_model=DownloadPaintedImageResponse)
async def download_painted_image(request: DownloadPaintedImageRequest):
    """Download a painted image in specified format"""
    try:
        session_id = request.session_id
        
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        # Get mask data
        mask_data = None
        if request.mask_id is not None:
            stored_masks = session_data.get('stored_masks', {})
            if request.mask_id not in stored_masks:
                raise HTTPException(status_code=404, detail=f"Mask ID {request.mask_id} not found in session")
            mask_data = stored_masks[request.mask_id]['mask']
        elif request.mask:
            mask_data = request.mask
        else:
            raise HTTPException(status_code=400, detail="Either mask_id or mask must be provided")
        
        # Paint the mask using SAM2 service
        result = await sam2_service.paint_mask(
            session_data['image_data'],
            mask_data,
            request.color,
            request.opacity
        )
        
        # Validate format
        format_upper = request.format.upper()
        if format_upper not in ['PNG', 'JPG', 'JPEG']:
            raise HTTPException(status_code=400, detail="Format must be PNG or JPG")
        
        # Generate filename
        base_filename = os.path.splitext(session_data['filename'])[0]
        extension = 'jpg' if format_upper in ['JPG', 'JPEG'] else 'png'
        filename = f"{session_id}_{base_filename}_painted.{extension}"
        
        # Save painted image to disk
        file_path = save_image_to_disk(
            result['painted_image'], 
            filename, 
            format=format_upper,
            quality=request.quality or 95
        )
        
        # Get file size
        size_bytes = get_file_size(file_path)
        
        # Generate download URL
        image_url = f"/download-file/{filename}"
        
        logger.info(f"Painted image download prepared: {filename}, size: {size_bytes} bytes")
        
        return DownloadPaintedImageResponse(
            session_id=session_id,
            image_url=image_url,
            format=format_upper,
            size_bytes=size_bytes,
            message="Painted image download ready"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to prepare painted image download: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to prepare painted image download: {str(e)}")

@app.get("/download-file/{filename}")
async def download_file(filename: str):
    """Download a file from the results directory"""
    try:
        # Validate filename for security
        if not filename or '..' in filename or '/' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        file_path = os.path.join(RESULTS_DIR, filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Determine content type based on file extension
        ext = os.path.splitext(filename)[1].lower()
        if ext in ['.jpg', '.jpeg']:
            content_type = "image/jpeg"
        elif ext == '.png':
            content_type = "image/png"
        else:
            content_type = "application/octet-stream"
        
        # Return file as streaming response
        return StreamingResponse(
            open(file_path, 'rb'),
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-cache"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to download file {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")

@app.get("/list-downloads")
async def list_downloads():
    """List all available downloads for the server"""
    try:
        if not os.path.exists(RESULTS_DIR):
            return {"downloads": [], "message": "No downloads available"}
        
        downloads = []
        for filename in os.listdir(RESULTS_DIR):
            if filename.endswith(('.png', '.jpg', '.jpeg')):
                file_path = os.path.join(RESULTS_DIR, filename)
                size_bytes = get_file_size(file_path)
                downloads.append({
                    "filename": filename,
                    "size_bytes": size_bytes,
                    "download_url": f"/download-file/{filename}"
                })
        
        return {
            "downloads": downloads,
            "total_files": len(downloads),
            "message": f"Found {len(downloads)} downloadable files"
        }
        
    except Exception as e:
        logger.error(f"Failed to list downloads: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list downloads: {str(e)}")

@app.get("/session/{session_id}", response_model=SessionInfoResponse)
async def get_session_info(session_id: str):
    """Get session information"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        return SessionInfoResponse(
            session_id=session_id,
            filename=session_data['filename'],
            width=session_data['width'],
            height=session_data['height'],
            created_at=session_data['created_at'].isoformat(),
            stored_masks=len(session_data.get('stored_masks', {})),
            message="Session information retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get session info: {str(e)}")

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its files"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        # Remove session files
        if 'file_path' in session_data:
            try:
                os.remove(session_data['file_path'])
                logger.info(f"Deleted file: {session_data['file_path']}")
            except FileNotFoundError:
                pass  # File already deleted
        
        # Remove session data
        del sessions[session_id]
        logger.info(f"Deleted session: {session_id}")
        
        return {"message": "Session deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Startup event"""
    logger.info("🚀 SAM2 Building Painter API starting...")

async def periodic_cleanup():
    """Periodic cleanup of old sessions"""
    while True:
        await asyncio.sleep(3600)  # Run every hour
        await cleanup_old_sessions()

# Start periodic cleanup
@app.on_event("startup")
async def start_cleanup():
    asyncio.create_task(periodic_cleanup())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)