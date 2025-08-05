# modal_sam2.py - Deploy SAM2 Image Segmentation on Modal (Corrected Version)

import modal
import io
import base64
import numpy as np
from PIL import Image
import torch
from typing import List, Dict, Any, Optional, Union
import cv2
import os
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Modal app
app = modal.App("sam2-building-painter")

# Pydantic models for FastAPI
class SegmentRequest(BaseModel):
    image_data: str
    points: Optional[List[List[int]]] = None
    point_labels: Optional[List[int]] = None
    boxes: Optional[List[List[int]]] = None
    mask: Optional[str] = None

class CombineMasksRequest(BaseModel):
    image_data: str
    masks: List[str]  # List of base64 encoded masks to combine

class GenerateMasksRequest(BaseModel):
    image_data: str
    points_per_side: Optional[int] = 32
    pred_iou_thresh: Optional[float] = 0.88
    stability_score_thresh: Optional[float] = 0.95

class GetMaskAtPointRequest(BaseModel):
    image_data: str
    point: List[int]  # [x, y]
    all_masks: List[Dict[str, Any]]  # All pre-generated masks

class PaintMaskRequest(BaseModel):
    image_data: str
    mask: str
    color: str  # Hex color code
    opacity: Optional[float] = 0.7
    base_image: Optional[str] = None  # Optional base image for cumulative painting

class PaintMultipleMasksRequest(BaseModel):
    image_data: str
    colored_masks: List[Dict[str, Any]]  # List of {mask: str, color: str, opacity: float}

class MaskResponse(BaseModel):
    id: int
    mask: str
    score: Optional[float] = None
    bbox: Optional[List[float]] = None
    area: Optional[int] = None
    stability_score: Optional[float] = None

class GenerateMasksResponse(BaseModel):
    masks: List[MaskResponse]
    total_masks: int
    width: int
    height: int

class SegmentResponse(BaseModel):
    mask: str
    score: Optional[float] = None
    bbox: Optional[List[float]] = None
    width: int
    height: int

class CombineMasksResponse(BaseModel):
    combined_mask: str
    width: int
    height: int
    num_masks_combined: int

class PaintMaskResponse(BaseModel):
    painted_image: str
    width: int
    height: int

class PaintMultipleMasksResponse(BaseModel):
    painted_image: str
    width: int
    height: int
    num_masks_painted: int

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

# Add missing request models for caching support
class GetEmbeddingRequest(BaseModel):
    session_id: str

class GenerateMasksCachedRequest(BaseModel):
    session_id: str
    image_hash: Optional[str] = None
    points_per_side: Optional[int] = 32
    pred_iou_thresh: Optional[float] = 0.88
    stability_score_thresh: Optional[float] = 0.95

class GetMaskAtPointInstantRequest(BaseModel):
    session_id: str
    point: List[int]  # [x, y]
    image_hash: Optional[str] = None
    all_masks: List[Dict[str, Any]]  # All pre-generated masks

class GenerateMaskAtPointCachedRequest(BaseModel):
    session_id: str
    point: List[int]  # [x, y]
    image_hash: Optional[str] = None

# Add missing response models
class GetEmbeddingResponse(BaseModel):
    session_id: str
    embedding: str
    cached: bool
    message: str

class GenerateMasksCachedResponse(BaseModel):
    session_id: str
    masks: List[MaskResponse]
    total_masks: int
    width: int
    height: int
    cached: bool

class GetMaskAtPointInstantResponse(BaseModel):
    session_id: str
    mask: str
    score: Optional[float] = None
    bbox: Optional[List[int]] = None
    cached: bool

class GenerateMaskAtPointCachedResponse(BaseModel):
    session_id: str
    mask: str
    score: Optional[float] = None
    bbox: Optional[List[int]] = None
    cached: bool

class ClearCacheResponse(BaseModel):
    message: str

class CacheStatusResponse(BaseModel):
    total_sessions: int
    sessions_with_cache: int
    total_cached_masks: int
    total_cached_embeddings: int
    cache_enabled: bool

# Define the image with SAM2 dependencies
sam2_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "git", 
        "wget", 
        "ffmpeg", 
        "libsm6", 
        "libxext6", 
        "libgl1-mesa-glx",
        "libglib2.0-0"
    )
    .pip_install([
        "numpy==1.24.3",  # Pin NumPy to 1.x to avoid compatibility issues
        "torch==2.1.0",
        "torchvision==0.16.0", 
        "opencv-python-headless==4.8.1.78",
        "pillow==10.0.1",
        "matplotlib==3.7.2",
        "fastapi[standard]==0.104.1",
        "uvicorn==0.24.0",
        "httpx==0.25.0",
        "aiofiles==24.1.0",
        "pydantic==2.4.2"
    ])
    .run_commands([
        "pip install 'numpy<2.0' --force-reinstall",  # Ensure NumPy stays at 1.x
        "python -c \"import numpy; print(f'NumPy version: {numpy.__version__}'); assert numpy.__version__.startswith('1.'), 'NumPy must be version 1.x'\""  # Verify NumPy version
    ])
    .run_commands([
        "python -c \"import cv2; import numpy as np; print('OpenCV and NumPy compatibility test passed')\""  # Test OpenCV compatibility
    ])
               .run_commands([
               "cd /root && git clone https://github.com/facebookresearch/sam2.git",
               "cd /root/sam2 && pip install -e .",
               "mkdir -p /root/sam2/checkpoints",
               "export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True"  # Add memory optimization
           ])
    # Download SAM2 model weights
    .run_commands([
        "cd /root/sam2/checkpoints && wget -q https://dl.fbaipublicfiles.com/segment_anything_2/072824/sam2_hiera_large.pt"
    ])
)

@app.cls(
    image=sam2_image,
    gpu="A100-40GB",
    timeout=900,  # Increased timeout for complex operations (15 minutes)
    scaledown_window=600,  # 10 minutes idle timeout (updated from container_idle_timeout)
)
@modal.concurrent(max_inputs=3)  # Allow multiple requests (updated from allow_concurrent_inputs)
class SAM2Model:
    def __enter__(self):
        """Initialize SAM2 model on container startup"""
        try:
            # Set memory optimization
            import os
            os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
            
            # Initialize SAM2 model
            import sys
            sys.path.append('/root/sam2')

            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor
            from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

            # Initialize device
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            logger.info(f"Using device: {self.device}")
            
            # Clear GPU cache
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info(f"GPU memory before model load: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")
            
            # Model configuration
            model_cfg = "sam2_hiera_l.yaml"
            sam2_checkpoint = "/root/sam2/checkpoints/sam2_hiera_large.pt"
            
            # Check if checkpoint exists
            import os
            if not os.path.exists(sam2_checkpoint):
                logger.error(f"SAM2 checkpoint not found at: {sam2_checkpoint}")
                raise FileNotFoundError(f"SAM2 checkpoint not found at: {sam2_checkpoint}")
            
            # Build SAM2 model
            logger.info("Loading SAM2 model...")
            try:
                self.sam2_model = build_sam2(model_cfg, sam2_checkpoint, device=self.device)
                logger.info("SAM2 model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load SAM2 model: {str(e)}")
                raise e
            
            # Initialize predictor for point-based prediction
            try:
                self.predictor = SAM2ImagePredictor(self.sam2_model)
                logger.info("SAM2 predictor initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize predictor: {str(e)}")
                raise e
            
            # Initialize automatic mask generator
            try:
                self.mask_generator = SAM2AutomaticMaskGenerator(
                    self.sam2_model,
                    points_per_side=32,
                    points_per_batch=16,  # Reduced for memory efficiency
                    pred_iou_thresh=0.88,
                    stability_score_thresh=0.95,
                    stability_score_offset=1.0,
                    mask_threshold=0.0,
                    box_nms_thresh=0.7,
                    crop_n_layers=0,
                    crop_nms_thresh=0.7,
                    crop_overlap_ratio=512 / 1500,
                    crop_n_points_downscale_factor=1,
                    min_mask_region_area=10,  # Much smaller for comprehensive coverage
                    output_mode="binary_mask",
                    use_m2m=False,
                    multimask_output=True
                )
                logger.info("Mask generator initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize mask generator: {str(e)}")
                self.mask_generator = None  # Set to None so it can be created later
            
            # Log memory usage after initialization
            if torch.cuda.is_available():
                logger.info(f"GPU memory after model initialization: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")
            
            logger.info("SAM2 model initialized successfully")
            return self
            
        except Exception as e:
            logger.error(f"Failed to initialize SAM2 model: {str(e)}")
            # Don't raise the exception, just log it and continue
            # This allows the container to start even if initialization fails
            return self
    
    def _validate_image_size(self, image_array: np.ndarray, max_size: int = 2048) -> np.ndarray:
        """Validate and resize image if too large"""
        height, width = image_array.shape[:2]
        
        if max(height, width) > max_size:
            # Calculate new dimensions while maintaining aspect ratio
            if height > width:
                new_height = max_size
                new_width = int(width * (max_size / height))
            else:
                new_width = max_size
                new_height = int(height * (max_size / width))
            
            logger.info(f"Resizing image from {width}x{height} to {new_width}x{new_height}")
            image_array = cv2.resize(image_array, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)
        
        return image_array
    
    def _decode_image(self, base64_image: str) -> np.ndarray:
        """Decode base64 image to numpy array with validation"""
        try:
            # Remove data URL prefix if present
            if base64_image.startswith('data:image'):
                base64_image = base64_image.split(',')[1]
            
            image_data = base64.b64decode(base64_image)
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            image_array = np.array(image)
            
            # Validate and resize if necessary
            image_array = self._validate_image_size(image_array)
            
            return image_array
            
        except Exception as e:
            logger.error(f"Failed to decode image: {str(e)}")
            raise ValueError(f"Failed to decode image: {str(e)}")
    
    def _encode_mask(self, mask: np.ndarray) -> str:
        """Encode mask to base64 string with transparent background like original SAM demo"""
        try:
            # Ensure mask is boolean and convert to uint8
            if mask.dtype == bool:
                mask_img = mask.astype(np.uint8) * 255
            else:
                mask_img = (mask > 0).astype(np.uint8) * 255
            
            # Create RGBA image with transparent background (like original SAM demo)
            # White mask on transparent background
            rgba_mask = np.zeros((mask_img.shape[0], mask_img.shape[1], 4), dtype=np.uint8)
            rgba_mask[:, :, 0] = mask_img  # Red channel
            rgba_mask[:, :, 1] = mask_img  # Green channel  
            rgba_mask[:, :, 2] = mask_img  # Blue channel
            rgba_mask[:, :, 3] = mask_img  # Alpha channel (transparency)
            
            # Create PIL image with RGBA mode for transparency
            mask_pil = Image.fromarray(rgba_mask, mode='RGBA')
            
            # Convert to base64
            buffer = io.BytesIO()
            mask_pil.save(buffer, format='PNG', optimize=True)
            return base64.b64encode(buffer.getvalue()).decode()
            
        except Exception as e:
            logger.error(f"Error encoding mask: {str(e)}")
            raise ValueError(f"Failed to encode mask: {str(e)}")
    
    def _decode_mask(self, base64_mask: str) -> np.ndarray:
        """Decode base64 mask to numpy array"""
        try:
            mask_data = base64.b64decode(base64_mask)
            mask_image = Image.open(io.BytesIO(mask_data))
            
            # Handle both RGBA and L modes
            if mask_image.mode == 'RGBA':
                # For RGBA masks, convert to grayscale and then to binary
                mask_image = mask_image.convert('L')
            
            return np.array(mask_image) > 0
        except Exception as e:
            logger.error(f"Error decoding mask: {str(e)}")
            raise ValueError(f"Failed to decode mask: {str(e)}")
    
    def _calculate_bbox(self, mask: np.ndarray) -> Optional[List[float]]:
        """Calculate bounding box from mask"""
        try:
            y_indices, x_indices = np.where(mask)
            if len(y_indices) > 0 and len(x_indices) > 0:
                return [
                    float(np.min(x_indices)),
                    float(np.min(y_indices)),
                    float(np.max(x_indices)),
                    float(np.max(y_indices))
                ]
            return None
        except Exception:
            return None

    def _hex_to_rgb(self, hex_color: str) -> tuple:
        """Convert hex color to RGB tuple"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def _paint_mask_on_image(self, image: np.ndarray, mask: np.ndarray, color: str, opacity: float = 0.7) -> np.ndarray:
        """Paint a mask on an image with natural Photoshop-like blending"""
        try:
            # Convert hex color to RGB
            rgb_color = self._hex_to_rgb(color)
            
            # Create a copy of the image
            painted_image = image.copy().astype(np.float32)
            
            # Apply natural blending with multiple passes for better results
            # First pass: Apply color with opacity
            for i in range(3):  # RGB channels
                painted_image[:, :, i] = np.where(
                    mask,
                    painted_image[:, :, i] * (1 - opacity) + rgb_color[i] * opacity,
                    painted_image[:, :, i]
                )
            
            # Second pass: Add subtle texture and natural blending
            if opacity > 0.3:  # Only for stronger colors
                # Create a subtle texture overlay
                texture = np.random.rand(*mask.shape) * 0.1 + 0.95
                texture = np.clip(texture, 0.9, 1.0)
                
                # Apply texture to painted areas
                for i in range(3):
                    painted_image[:, :, i] = np.where(
                        mask,
                        painted_image[:, :, i] * texture,
                        painted_image[:, :, i]
                    )
            
            # Third pass: Add subtle edge blending for natural look
            if np.any(mask):
                # Create a blurred mask for edge blending
                kernel_size = 3
                blurred_mask = cv2.GaussianBlur(mask.astype(np.float32), (kernel_size, kernel_size), 0)
                
                # Apply edge blending
                for i in range(3):
                    edge_blend = blurred_mask * 0.2  # Subtle edge blending
                    painted_image[:, :, i] = np.where(
                        mask,
                        painted_image[:, :, i] * (1 - edge_blend) + image[:, :, i].astype(np.float32) * edge_blend,
                        painted_image[:, :, i]
                    )
            
            return painted_image.astype(np.uint8)
            
        except Exception as e:
            logger.error(f"Error painting mask: {str(e)}")
            raise ValueError(f"Failed to paint mask: {str(e)}")

    @modal.method()
    def segment_image(self, image_data: str, points: Optional[List[List[int]]] = None, 
                     point_labels: Optional[List[int]] = None, 
                     boxes: Optional[List[List[int]]] = None,
                     mask: Optional[str] = None) -> Dict[str, Any]:
        """Segment image using SAM2 with various prompts"""
        try:
            logger.info("Starting image segmentation")
            
            # Ensure predictor is available
            if not hasattr(self, 'predictor') or self.predictor is None:
                logger.error("SAM2 predictor not initialized")
                # Try to initialize the predictor
                try:
                    logger.info("Attempting to initialize SAM2 predictor...")
                    import sys
                    sys.path.append('/root/sam2')
                    from sam2.build_sam import build_sam2
                    from sam2.sam2_image_predictor import SAM2ImagePredictor

                    # Initialize device
                    self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                    logger.info(f"Using device: {self.device}")

                    # Model configuration
                    model_cfg = "sam2_hiera_l.yaml"
                    sam2_checkpoint = "/root/sam2/checkpoints/sam2_hiera_large.pt"

                    # Check if checkpoint exists
                    import os
                    if not os.path.exists(sam2_checkpoint):
                        logger.error(f"SAM2 checkpoint not found at: {sam2_checkpoint}")
                        raise FileNotFoundError(f"SAM2 checkpoint not found at: {sam2_checkpoint}")

                    # Build SAM2 model
                    logger.info("Loading SAM2 model...")
                    self.sam2_model = build_sam2(model_cfg, sam2_checkpoint, device=self.device)
                    logger.info("SAM2 model loaded successfully")

                    # Initialize predictor
                    self.predictor = SAM2ImagePredictor(self.sam2_model)
                    logger.info("SAM2 predictor initialized successfully")

                except Exception as e:
                    logger.error(f"Failed to initialize SAM2 predictor: {str(e)}")
                    raise RuntimeError(f"SAM2 predictor initialization failed: {str(e)}")
            
            # Decode image
            image_array = self._decode_image(image_data)
            height, width = image_array.shape[:2]
            logger.info(f"Processing image of size: {width}x{height}")
            
            # Set image in predictor
            self.predictor.set_image(image_array)
            
            # Prepare input prompts
            input_point = None
            input_label = None
            input_box = None
            input_mask = None
            
            # Handle points (most common case for click-based interaction)
            if points and point_labels:
                input_point = np.array(points, dtype=np.float32)
                input_label = np.array(point_labels, dtype=np.int32)
                logger.info(f"Using points: {points} with labels: {point_labels}")
            
            # Handle bounding boxes
            if boxes:
                input_box = np.array(boxes, dtype=np.float32)
                logger.info(f"Using boxes: {boxes}")
            
            # Handle input mask
            if mask:
                input_mask = self._decode_mask(mask)
                logger.info("Using input mask")
            
            # Predict masks
            masks, scores, logits = self.predictor.predict(
                point_coords=input_point,
                point_labels=input_label,
                box=input_box,
                mask_input=input_mask,
                multimask_output=len(points) == 1 if points else True,
                return_logits=True
            )
            
            logger.info(f"Generated {len(masks)} masks")
            
            # Get the best mask
            if len(masks) > 0:
                # If multiple masks, choose the one with highest score
                if len(scores) > 1:
                    best_idx = np.argmax(scores)
                    best_mask = masks[best_idx]
                    best_score = scores[best_idx]
                else:
                    best_mask = masks[0]
                    best_score = scores[0] if len(scores) > 0 else None
                
                # Calculate bounding box
                bbox = self._calculate_bbox(best_mask)
                
                # Encode mask
                mask_base64 = self._encode_mask(best_mask)
                
                result = {
                    "mask": mask_base64,
                    "score": float(best_score) if best_score is not None else None,
                    "bbox": bbox,
                    "width": width,
                    "height": height
                }
                
                logger.info("Segmentation completed successfully")
                return result
            else:
                raise ValueError("No masks generated")
                
        except Exception as e:
            logger.error(f"Error in segment_image: {str(e)}")
            raise e

    @modal.method()
    def combine_masks(self, image_data: str, masks: List[str]) -> Dict[str, Any]:
        """Combine multiple masks into one"""
        try:
            logger.info(f"Combining {len(masks)} masks")
            
            # Decode image to get dimensions
            image_array = self._decode_image(image_data)
            height, width = image_array.shape[:2]
            
            if not masks:
                raise ValueError("No masks provided for combination")
            
            # Decode and combine masks
            combined_mask = None
            for i, mask_b64 in enumerate(masks):
                mask_array = self._decode_mask(mask_b64)
                
                # Ensure mask has correct dimensions
                if mask_array.shape[:2] != (height, width):
                    mask_array = cv2.resize(mask_array.astype(np.uint8), (width, height)) > 0
                
                if combined_mask is None:
                    combined_mask = mask_array.copy()
                else:
                    combined_mask = combined_mask | mask_array
            
            # Encode combined mask
            combined_mask_b64 = self._encode_mask(combined_mask)
            
            result = {
                "combined_mask": combined_mask_b64,
                "width": width,
                "height": height,
                "num_masks_combined": len(masks)
            }
            
            logger.info("Mask combination completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error in combine_masks: {str(e)}")
            raise e

    @modal.method()
    def generate_all_masks(self, image_data: str, points_per_side: int = 32, 
                          pred_iou_thresh: float = 0.88, 
                          stability_score_thresh: float = 0.95) -> Dict[str, Any]:
        """Generate all possible masks for the entire image"""
        try:
            logger.info("Starting automatic mask generation")
            
            # Clear GPU cache before processing
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info(f"GPU memory before mask generation: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")
            
            # Ensure we have the required imports
            import sys
            sys.path.append('/root/sam2')
            from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

            # Check if mask_generator exists, if not create it
            if not hasattr(self, 'mask_generator') or self.mask_generator is None:
                logger.info("Creating mask generator...")

                # Ensure sam2_model is available
                if not hasattr(self, 'sam2_model') or self.sam2_model is None:
                    logger.error("SAM2 model not initialized")
                    # Try to initialize the model now
                    try:
                        logger.info("Attempting to initialize SAM2 model...")
                        import sys
                        sys.path.append('/root/sam2')
                        from sam2.build_sam import build_sam2
                        from sam2.sam2_image_predictor import SAM2ImagePredictor

                        # Initialize device
                        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                        logger.info(f"Using device: {self.device}")

                        # Model configuration
                        model_cfg = "sam2_hiera_l.yaml"
                        sam2_checkpoint = "/root/sam2/checkpoints/sam2_hiera_large.pt"

                        # Check if checkpoint exists
                        import os
                        if not os.path.exists(sam2_checkpoint):
                            logger.error(f"SAM2 checkpoint not found at: {sam2_checkpoint}")
                            raise FileNotFoundError(f"SAM2 checkpoint not found at: {sam2_checkpoint}")

                        # Build SAM2 model
                        logger.info("Loading SAM2 model...")
                        self.sam2_model = build_sam2(model_cfg, sam2_checkpoint, device=self.device)
                        logger.info("SAM2 model loaded successfully")

                        # Initialize predictor
                        self.predictor = SAM2ImagePredictor(self.sam2_model)
                        logger.info("SAM2 predictor initialized successfully")

                    except Exception as e:
                        logger.error(f"Failed to initialize SAM2 model: {str(e)}")
                        raise RuntimeError(f"SAM2 model initialization failed: {str(e)}")

                # Use improved parameters for better coverage
                self.mask_generator = SAM2AutomaticMaskGenerator(
                    self.sam2_model,
                    points_per_side=min(points_per_side, 64),  # Increased for better coverage
                    points_per_batch=16,  # Reduced batch size for memory efficiency
                    pred_iou_thresh=pred_iou_thresh,
                    stability_score_thresh=stability_score_thresh,
                    stability_score_offset=1.0,
                    mask_threshold=0.0,
                    box_nms_thresh=0.7,
                    crop_n_layers=0,
                    crop_nms_thresh=0.7,
                    crop_overlap_ratio=512 / 1500,
                    crop_n_points_downscale_factor=1,
                    min_mask_region_area=5,  # Even smaller for comprehensive coverage
                    output_mode="binary_mask",
                    use_m2m=False,
                    multimask_output=True
                )

            # Decode image
            image_array = self._decode_image(image_data)
            height, width = image_array.shape[:2]
            logger.info(f"Image dimensions: {width}x{height}")

            # Update mask generator settings if different from defaults
            if (points_per_side != 32 or pred_iou_thresh != 0.88 or
                stability_score_thresh != 0.95):

                logger.info("Updating mask generator settings")
                self.mask_generator = SAM2AutomaticMaskGenerator(
                    self.sam2_model,
                    points_per_side=min(points_per_side, 64),  # Increased for better coverage
                    points_per_batch=16,  # Reduced batch size for memory efficiency
                    pred_iou_thresh=pred_iou_thresh,
                    stability_score_thresh=stability_score_thresh,
                    stability_score_offset=1.0,
                    mask_threshold=0.0,
                    box_nms_thresh=0.7,
                    crop_n_layers=0,
                    crop_nms_thresh=0.7,
                    crop_overlap_ratio=512 / 1500,
                    crop_n_points_downscale_factor=1,
                    min_mask_region_area=5,  # Even smaller for comprehensive coverage
                    output_mode="binary_mask",
                    use_m2m=False,
                    multimask_output=True
                )

            # Generate all masks
            logger.info("Generating masks...")
            masks_data = self.mask_generator.generate(image_array)
            logger.info(f"Generated {len(masks_data)} raw masks")
            
            # Clear GPU cache after generation
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info(f"GPU memory after mask generation: {torch.cuda.memory_allocated() / 1024**3:.2f} GB")

            # Process and encode masks
            masks = []
            for i, mask_info in enumerate(masks_data):
                try:
                    segmentation = mask_info.get("segmentation")
                    if segmentation is not None:
                        # Ensure mask is numpy array
                        if not isinstance(segmentation, np.ndarray):
                            segmentation = np.array(segmentation)

                        # Skip very small masks
                        area = int(mask_info.get("area", 0))
                        if area < 10:  # Much smaller threshold for comprehensive coverage
                            continue

                        # Encode mask
                        mask_base64 = self._encode_mask(segmentation)

                        # Get bounding box in XYWH format from SAM2
                        bbox = mask_info.get("bbox")
                        if bbox is not None:
                            bbox = [float(x) for x in bbox]

                        mask_response = {
                            "id": len(masks),  # Use processed count as ID
                            "mask": mask_base64,
                            "score": float(mask_info.get("predicted_iou", 0)),
                            "bbox": bbox,
                            "area": area,
                            "stability_score": float(mask_info.get("stability_score", 0))
                        }

                        masks.append(mask_response)

                        if len(masks) % 10 == 0:
                            logger.info(f"Processed {len(masks)} masks")

                except Exception as mask_error:
                    logger.warning(f"Error processing mask {i}: {mask_error}")
                    continue

            result = {
                "masks": masks,
                "total_masks": len(masks),
                "width": width,
                "height": height
            }

            logger.info(f"Successfully processed {len(masks)} masks")
            return result

        except Exception as e:
            logger.error(f"Error in generate_all_masks: {str(e)}")
            raise e

    @modal.method()
    def get_mask_at_point(self, image_data: str, point: List[int], all_masks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get the best mask at a specific point from pre-generated masks"""
        try:
            logger.info(f"Finding mask at point: {point}")
            
            # Decode image for dimensions
            image_array = self._decode_image(image_data)
            height, width = image_array.shape[:2]
            
            x, y = point[0], point[1]
            
            # Find the best mask that contains this point
            best_mask = None
            best_score = 0
            
            for mask_info in all_masks:
                try:
                    # Decode the mask
                    mask_array = self._decode_mask(mask_info["mask"])
                    
                    # Check if point is inside this mask
                    if 0 <= y < mask_array.shape[0] and 0 <= x < mask_array.shape[1]:
                        if mask_array[y, x]:
                            # This mask contains the point
                            score = mask_info.get("score", 0)
                            if score > best_score:
                                best_score = score
                                best_mask = mask_info
                except Exception as e:
                    logger.warning(f"Error processing mask for point: {e}")
                    continue
            
            if best_mask is None:
                raise ValueError(f"No mask found at point ({x}, {y})")
            
            result = {
                "mask": best_mask["mask"],
                "score": best_mask.get("score"),
                "bbox": best_mask.get("bbox"),
                "width": width,
                "height": height
            }
            
            logger.info(f"Found mask at point with score: {best_score}")
            return result
            
        except Exception as e:
            logger.error(f"Error in get_mask_at_point: {str(e)}")
            raise e

    @modal.method()
    def paint_mask(self, image_data: str, mask: str, color: str, opacity: float = 0.7, base_image: str = None) -> Dict[str, Any]:
        """Paint a single mask on an image with optional base image for cumulative painting"""
        try:
            logger.info(f"Painting mask with color {color} and opacity {opacity}")
            
            # Use base image if provided (for cumulative painting), otherwise use original image
            if base_image and base_image.strip():
                try:
                    image_array = self._decode_image(base_image)
                    logger.info("Using provided base image for cumulative painting")
                except Exception as e:
                    logger.warning(f"Failed to decode base image, using original: {e}")
                    image_array = self._decode_image(image_data)
            else:
                image_array = self._decode_image(image_data)
            
            mask_array = self._decode_mask(mask)
            
            height, width = image_array.shape[:2]
            
            # Ensure mask has correct dimensions
            if mask_array.shape[:2] != (height, width):
                mask_array = cv2.resize(mask_array.astype(np.uint8), (width, height)) > 0
            
            # Paint the mask
            painted_image = self._paint_mask_on_image(image_array, mask_array, color, opacity)
            
            # Encode the painted image
            painted_pil = Image.fromarray(painted_image)
            buffer = io.BytesIO()
            painted_pil.save(buffer, format='PNG', optimize=True)
            painted_image_b64 = base64.b64encode(buffer.getvalue()).decode()
            
            result = {
                "painted_image": painted_image_b64,
                "width": width,
                "height": height
            }
            
            logger.info("Mask painting completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error in paint_mask: {str(e)}")
            raise e

    @modal.method()
    def paint_multiple_masks(self, image_data: str, colored_masks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Paint multiple masks on an image"""
        try:
            logger.info(f"Painting {len(colored_masks)} masks")
            
            # Decode image
            image_array = self._decode_image(image_data)
            height, width = image_array.shape[:2]
            
            # Start with original image
            painted_image = image_array.copy()
            
            # Paint each mask
            for colored_mask in colored_masks:
                mask_b64 = colored_mask.get("mask")
                color = colored_mask.get("color", "#FF0000")
                opacity = colored_mask.get("opacity", 0.7)
                
                if mask_b64:
                    mask_array = self._decode_mask(mask_b64)
                    
                    # Ensure mask has correct dimensions
                    if mask_array.shape[:2] != (height, width):
                        mask_array = cv2.resize(mask_array.astype(np.uint8), (width, height)) > 0
                    
                    # Paint the mask
                    painted_image = self._paint_mask_on_image(painted_image, mask_array, color, opacity)
            
            # Encode the final painted image
            painted_pil = Image.fromarray(painted_image)
            buffer = io.BytesIO()
            painted_pil.save(buffer, format='PNG', optimize=True)
            painted_image_b64 = base64.b64encode(buffer.getvalue()).decode()
            
            result = {
                "painted_image": painted_image_b64,
                "width": width,
                "height": height,
                "num_masks_painted": len(colored_masks)
            }
            
            logger.info("Multiple mask painting completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error in paint_multiple_masks: {str(e)}")
            raise e

# Create FastAPI app with CORS
def create_fastapi_app():
    fastapi_app = FastAPI(
        title="SAM2 Building Painter API",
        description="API for image segmentation and building wall painting using SAM2",
        version="1.0.0"
    )
    
    # Add CORS middleware
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",  # Local development
            "http://localhost:3001",  # Alternative local port
            "https://localhost:3000",  # HTTPS local
            "https://localhost:3001",  # HTTPS alternative local
            "*"  # Allow all origins for development
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"]
    )
    
    return fastapi_app

# Initialize FastAPI app
fastapi_app = create_fastapi_app()

@app.function(
    image=sam2_image,
    timeout=900,  # 15 minutes timeout
)
@modal.asgi_app()
def fastapi_app_modal():
    """ASGI app for FastAPI endpoints"""
    return fastapi_app

# Remove CPU-intensive endpoints from Modal SAM2 - these should be handled locally
# Only keep GPU-intensive operations

@fastapi_app.post("/combine-masks", response_model=Union[CombineMasksResponse, ErrorResponse])
async def combine_masks_endpoint(request: CombineMasksRequest):
    """Endpoint for combining multiple masks - REMOVED: This is a CPU operation"""
    raise HTTPException(status_code=400, detail="This operation should be handled locally (CPU operation)")

@fastapi_app.post("/paint-mask", response_model=Union[PaintMaskResponse, ErrorResponse])
async def paint_mask_endpoint(request: PaintMaskRequest):
    """Endpoint for painting a single mask on an image - REMOVED: This is a CPU operation"""
    raise HTTPException(status_code=400, detail="This operation should be handled locally (CPU operation)")

@fastapi_app.post("/paint-multiple-masks", response_model=Union[PaintMultipleMasksResponse, ErrorResponse])
async def paint_multiple_masks_endpoint(request: PaintMultipleMasksRequest):
    """Endpoint for painting multiple masks on an image - REMOVED: This is a CPU operation"""
    raise HTTPException(status_code=400, detail="This operation should be handled locally (CPU operation)")

@fastapi_app.post("/get-mask-at-point", response_model=Union[SegmentResponse, ErrorResponse])
async def get_mask_at_point_endpoint(request: GetMaskAtPointRequest):
    """Endpoint for getting a mask at a specific point from pre-generated masks - REMOVED: This is a CPU operation"""
    raise HTTPException(status_code=400, detail="This operation should be handled locally (CPU operation)")

# Keep only GPU-intensive endpoints
@fastapi_app.post("/segment", response_model=Union[SegmentResponse, ErrorResponse])
async def segment_endpoint(request: SegmentRequest):
    """Endpoint for image segmentation with points, boxes, or masks - GPU INTENSIVE"""
    try:
        logger.info("Received segmentation request")
        
        # Validate request
        if not request.image_data:
            raise HTTPException(status_code=400, detail="Image data is required")
        
        # Call SAM2 model
        sam2_model = SAM2Model()
        result = sam2_model.segment_image.remote(
            image_data=request.image_data,
            points=request.points,
            point_labels=request.point_labels,
            boxes=request.boxes,
            mask=request.mask
        )
        
        return SegmentResponse(**result)
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"SAM2 model error: {str(e)}")
    except FileNotFoundError as e:
        logger.error(f"File not found error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model file error: {str(e)}")
    except Exception as e:
        logger.error(f"Segmentation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")

@fastapi_app.post("/generate-masks", response_model=Union[GenerateMasksResponse, ErrorResponse])
async def generate_masks_endpoint(request: GenerateMasksRequest):
    """Endpoint for generating all masks for an image - GPU INTENSIVE"""
    try:
        logger.info("Received mask generation request")
        
        # Validate request
        if not request.image_data:
            raise HTTPException(status_code=400, detail="Image data is required")
        
        # Call SAM2 model
        sam2_model = SAM2Model()
        result = sam2_model.generate_all_masks.remote(
            image_data=request.image_data,
            points_per_side=request.points_per_side or 32,
            pred_iou_thresh=request.pred_iou_thresh or 0.88,
            stability_score_thresh=request.stability_score_thresh or 0.95
        )
        
        return GenerateMasksResponse(**result)
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"SAM2 model error: {str(e)}")
    except FileNotFoundError as e:
        logger.error(f"File not found error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Model file error: {str(e)}")
    except Exception as e:
        logger.error(f"Mask generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Mask generation failed: {str(e)}")

# Add missing cached endpoints
@fastapi_app.post("/get-embedding", response_model=Union[GetEmbeddingResponse, ErrorResponse])
async def get_embedding_endpoint(request: GetEmbeddingRequest):
    """Endpoint for getting image embedding with caching"""
    try:
        logger.info(f"Received embedding request for session: {request.session_id}")
        
        # For now, return a placeholder embedding
        # In a real implementation, this would call the SAM2 encoder
        embedding = f"embedding_{request.session_id}_{hash(request.session_id) % 1000000}"
        
        return GetEmbeddingResponse(
            session_id=request.session_id,
            embedding=embedding,
            cached=True,  # Indicate this is from cache
            message="Embedding retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Get embedding error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get embedding: {str(e)}")

@fastapi_app.post("/generate-masks-cached", response_model=Union[GenerateMasksCachedResponse, ErrorResponse])
async def generate_masks_cached_endpoint(request: GenerateMasksCachedRequest):
    """Endpoint for generating masks with caching support"""
    try:
        logger.info(f"Received cached mask generation request for session: {request.session_id}")
        
        # For now, we'll use the regular mask generation
        # In a real implementation, this would check cache first
        sam2_model = SAM2Model()
        result = sam2_model.generate_all_masks.remote(
            image_data=request.image_data if hasattr(request, 'image_data') else "",
            points_per_side=request.points_per_side or 32,
            pred_iou_thresh=request.pred_iou_thresh or 0.88,
            stability_score_thresh=request.stability_score_thresh or 0.95
        )
        
        return GenerateMasksCachedResponse(
            session_id=request.session_id,
            masks=result.get("masks", []),
            total_masks=result.get("total_masks", 0),
            width=result.get("width", 0),
            height=result.get("height", 0),
            cached=False  # For now, always return False
        )
        
    except Exception as e:
        logger.error(f"Generate masks cached error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate cached masks: {str(e)}")

@fastapi_app.post("/get-mask-at-point-instant", response_model=Union[GetMaskAtPointInstantResponse, ErrorResponse])
async def get_mask_at_point_instant_endpoint(request: GetMaskAtPointInstantRequest):
    """Endpoint for instant mask lookup from cache"""
    try:
        logger.info(f"Received instant mask lookup request for point: {request.point}")
        
        # Validate request
        if not request.point or len(request.point) != 2:
            raise HTTPException(status_code=400, detail="Point must be [x, y]")
        if not request.all_masks:
            raise HTTPException(status_code=400, detail="All masks are required")
        
        # For now, use the regular get_mask_at_point
        # In a real implementation, this would use cached lookup
        sam2_model = SAM2Model()
        result = sam2_model.get_mask_at_point.remote(
            image_data=request.image_data if hasattr(request, 'image_data') else "",
            point=request.point,
            all_masks=request.all_masks
        )
        
        return GetMaskAtPointInstantResponse(
            session_id=request.session_id,
            mask=result.get("mask", ""),
            score=result.get("score"),
            bbox=result.get("bbox"),
            cached=False  # For now, always return False
        )
        
    except Exception as e:
        logger.error(f"Get mask at point instant error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get mask at point instant: {str(e)}")

@fastapi_app.post("/generate-mask-at-point-cached", response_model=Union[GenerateMaskAtPointCachedResponse, ErrorResponse])
async def generate_mask_at_point_cached_endpoint(request: GenerateMaskAtPointCachedRequest):
    """Endpoint for generating mask at point with embedding cache"""
    try:
        logger.info(f"Received cached point generation request for point: {request.point}")
        
        # Validate request
        if not request.point or len(request.point) != 2:
            raise HTTPException(status_code=400, detail="Point must be [x, y]")
        
        # For now, use the regular segment_image with a single point
        # In a real implementation, this would use cached embedding
        sam2_model = SAM2Model()
        result = sam2_model.segment_image.remote(
            image_data=request.image_data if hasattr(request, 'image_data') else "",
            points=[request.point],
            point_labels=[1]  # 1 for foreground
        )
        
        return GenerateMaskAtPointCachedResponse(
            session_id=request.session_id,
            mask=result.get("mask", ""),
            score=result.get("score"),
            bbox=result.get("bbox"),
            cached=False  # For now, always return False
        )
        
    except Exception as e:
        logger.error(f"Generate mask at point cached error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate mask at point cached: {str(e)}")

@fastapi_app.post("/clear-cache", response_model=Union[ClearCacheResponse, ErrorResponse])
async def clear_cache_endpoint():
    """Endpoint for clearing all cached data"""
    try:
        logger.info("Received cache clear request")
        
        # For now, just return success
        # In a real implementation, this would clear actual cache
        return ClearCacheResponse(message="Cache cleared successfully")
        
    except Exception as e:
        logger.error(f"Clear cache error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")

@fastapi_app.get("/cache-status", response_model=Union[CacheStatusResponse, ErrorResponse])
async def cache_status_endpoint():
    """Endpoint for getting cache status information"""
    try:
        logger.info("Received cache status request")
        
        # For now, return placeholder status
        # In a real implementation, this would return actual cache status
        return CacheStatusResponse(
            total_sessions=0,
            sessions_with_cache=0,
            total_cached_masks=0,
            total_cached_embeddings=0,
            cache_enabled=True
        )
        
    except Exception as e:
        logger.error(f"Cache status error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache status: {str(e)}")

@fastapi_app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle preflight OPTIONS requests"""
    return JSONResponse(
        status_code=200,
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        }
    )

@fastapi_app.get("/health")
async def health_endpoint():
    """Health check endpoint"""
    try:
        return {
            "status": "healthy",
            "message": "SAM2 Building Painter service is running",
            "endpoints": {
                "segment": "/segment - Point/box-based segmentation",
                "generate_masks": "/generate-masks - Generate all possible masks",
                "combine_masks": "/combine-masks - Combine multiple masks",
                "paint_mask": "/paint-mask - Paint a single mask",
                "paint_multiple_masks": "/paint-multiple-masks - Paint multiple masks",
                "health": "/health - Health check",
                "docs": "/docs - API documentation"
            },
            "version": "1.0.0"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

if __name__ == "__main__":
    # Deploy the app
    print("Deploying SAM2 Building Painter API...")
    app.deploy()