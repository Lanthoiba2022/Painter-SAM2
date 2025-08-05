'use client';

import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { CanvasProps } from '@/types';
import { api } from '@/lib/api';
import { MousePointer, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const InteractiveCanvas: React.FC<CanvasProps> = ({
  imageData,
  masks,
  selectedMasks,
  coloredMasks,
  showAllMasks,
  hoveredMaskId,
  onMaskSelect,
  onPointClick,
  setHoveredMaskId,
  sessionId,
  isClickToGenerateMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showInstructions, setShowInstructions] = useState(true);
  
  // Enhanced caching state for instant mask highlighting
  const [loadedMaskImages, setLoadedMaskImages] = useState<Record<number, HTMLImageElement>>({});
  const [maskDataCache, setMaskDataCache] = useState<Record<number, ImageData>>({});
  const [maskPixelCache, setMaskPixelCache] = useState<Record<number, Set<string>>>({});
  const [isHoverEnabled, setIsHoverEnabled] = useState(true);
  
  // Get caching state from store
  const currentImageHash = useAppStore((state) => state.currentImageHash);
  const isEmbeddingCached = useAppStore((state) => state.isEmbeddingCached);
  const isMaskCached = useAppStore((state) => state.isMaskCached);
  const setMaskCache = useAppStore((state) => state.setMaskCache);
  const getCachedMasks = useAppStore((state) => state.getCachedMasks);

  // Load image and calculate canvas size
  useEffect(() => {
    if (imageData) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImageElement(img);
        updateCanvasSize(img);
      };
      img.src = imageData;
    }
  }, [imageData]);

  // Update canvas size to fit container with proper aspect ratio
  const updateCanvasSize = useCallback((img: HTMLImageElement) => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate aspect ratios
    const imgAspectRatio = img.width / img.height;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let canvasWidth, canvasHeight;
    
    if (imgAspectRatio > containerAspectRatio) {
      // Image is wider than container - fit to width
      canvasWidth = containerWidth;
      canvasHeight = containerWidth / imgAspectRatio;
    } else {
      // Image is taller than container - fit to height
      canvasHeight = containerHeight;
      canvasWidth = containerHeight * imgAspectRatio;
    }
    
    setCanvasSize({ width: canvasWidth, height: canvasHeight });
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (imageElement) {
        updateCanvasSize(imageElement);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imageElement, updateCanvasSize]);

  // Convert canvas coordinates to image coordinates - improved version
  const canvasToImageCoords = useCallback((canvasX: number, canvasY: number) => {
    if (!imageElement) return { x: 0, y: 0 };
    
    const scale = Math.min(canvasSize.width / imageElement.width, canvasSize.height / imageElement.height);
    const offsetX = (canvasSize.width - imageElement.width * scale) / 2;
    const offsetY = (canvasSize.height - imageElement.height * scale) / 2;
    
    const imageX = (canvasX - offsetX) / scale;
    const imageY = (canvasY - offsetY) / scale;
    
    const coords = {
      x: Math.round(imageX),
      y: Math.round(imageY)
    };
    
    return coords;
  }, [imageElement, canvasSize]);

  // Enhanced mask pixel caching for instant hover detection
  const buildMaskPixelCache = useCallback((maskId: number, maskData: ImageData) => {
    const pixelSet = new Set<string>();
    const { width, height, data } = maskData;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        const alpha = data[pixelIndex + 3];
        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];
        
        // Check if pixel is part of mask
        if (alpha > 0 || red > 0 || green > 0 || blue > 0) {
          pixelSet.add(`${x},${y}`);
        }
      }
    }
    
    return pixelSet;
  }, []);

  // Ultra-fast point-in-mask detection using pixel cache
  const isPointInMask = useCallback((maskId: number, x: number, y: number): boolean => {
    try {
      // Check bounds first
      if (!imageElement || x < 0 || x >= imageElement.width || y < 0 || y >= imageElement.height) {
        return false;
      }
      
      // Use pixel cache for instant detection
      const pixelSet = maskPixelCache[maskId];
      if (pixelSet) {
        return pixelSet.has(`${x},${y}`);
      }
      
      // Fallback to ImageData if pixel cache not available
      const maskData = maskDataCache[maskId];
      if (!maskData) {
        return false;
      }
      
      const pixelIndex = (y * imageElement.width + x) * 4;
      const alpha = maskData.data[pixelIndex + 3];
      const red = maskData.data[pixelIndex];
      const green = maskData.data[pixelIndex + 1];
      const blue = maskData.data[pixelIndex + 2];
      
      return alpha > 0 || red > 0 || green > 0 || blue > 0;
    } catch (error) {
      console.error(`Error checking point in mask ${maskId}:`, error);
      return false;
    }
  }, [imageElement, maskDataCache, maskPixelCache]);

  // Pre-load mask images with enhanced caching for instant hover
  useEffect(() => {
    if (masks.length > 0 && imageElement) {
      console.log(`Loading ${masks.length} mask images with enhanced caching...`);
      const newLoadedImages: Record<number, HTMLImageElement> = {};
      const newMaskDataCache: Record<number, ImageData> = {};
      const newMaskPixelCache: Record<number, Set<string>> = {};
      
      const loadPromises = masks.map((mask) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            newLoadedImages[mask.id] = img;
            
            // Create a temporary canvas to extract ImageData for instant hover detection
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageElement.width;
            tempCanvas.height = imageElement.height;
            const ctx = tempCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const imageData = ctx.getImageData(0, 0, imageElement.width, imageElement.height);
              newMaskDataCache[mask.id] = imageData;
              
              // Build pixel cache for ultra-fast hover detection
              const pixelSet = buildMaskPixelCache(mask.id, imageData);
              newMaskPixelCache[mask.id] = pixelSet;
            }
            
            console.log(`Loaded mask ${mask.id} with pixel cache`);
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load mask ${mask.id}`);
            resolve();
          };
          img.src = `data:image/png;base64,${mask.mask}`;
        });
      });

      Promise.all(loadPromises).then(() => {
        console.log(`Successfully loaded ${Object.keys(newLoadedImages).length} mask images with pixel caching`);
        setLoadedMaskImages(newLoadedImages);
        setMaskDataCache(newMaskDataCache);
        setMaskPixelCache(newMaskPixelCache);
        
        // Cache masks in store for persistence
        if (currentImageHash && masks.length > 0) {
          setMaskCache(currentImageHash, masks, 96, 0.7, 0.8);
        }
      });
    } else {
      // Clear cache when no masks or no image
      setLoadedMaskImages({});
      setMaskDataCache({});
      setMaskPixelCache({});
    }
  }, [masks, imageElement, currentImageHash, setMaskCache, buildMaskPixelCache]);

  // Check for cached masks on image load
  useEffect(() => {
    if (currentImageHash && !masks.length) {
      const cachedMasks = getCachedMasks(currentImageHash);
      if (cachedMasks && cachedMasks.length > 0) {
        console.log(`Loading ${cachedMasks.length} cached masks for image ${currentImageHash}`);
        // The store will handle setting the masks
      }
    }
  }, [currentImageHash, masks.length, getCachedMasks]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      setLoadedMaskImages({});
      setMaskDataCache({});
      setMaskPixelCache({});
    };
  }, []);

  // Memoized mask lookup for instant hover detection
  const maskAtPoint = useMemo(() => {
    if (!imageElement || masks.length === 0) return null;
    
    return (x: number, y: number) => {
      for (const mask of masks) {
        if (isPointInMask(mask.id, x, y)) {
          return mask;
        }
      }
      return null;
    };
  }, [masks, isPointInMask, imageElement]);

  // Draw function with optimized mask rendering
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scale and offset to center the image
    const scale = Math.min(canvasSize.width / imageElement.width, canvasSize.height / imageElement.height);
    const offsetX = (canvasSize.width - imageElement.width * scale) / 2;
    const offsetY = (canvasSize.height - imageElement.height * scale) / 2;

    // Draw background image centered
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(imageElement, 0, 0);
    ctx.restore();

    // Function to draw a single mask with given color and opacity
    const drawMask = (mask: any, fillColor: string, opacity: number) => {
      const maskImg = loadedMaskImages[mask.id];
      if (!maskImg) return;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      
      // Create a temporary canvas for mask compositing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      tempCanvas.width = imageElement.width;
      tempCanvas.height = imageElement.height;
      
      // Draw the mask to temp canvas
      tempCtx.drawImage(maskImg, 0, 0);
      
      // Get mask data
      const maskData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Create colored overlay only where mask is white
      const coloredOverlay = document.createElement('canvas');
      const overlayCtx = coloredOverlay.getContext('2d');
      if (!overlayCtx) return;
      
      coloredOverlay.width = imageElement.width;
      coloredOverlay.height = imageElement.height;
      
      // Fill with color
      overlayCtx.fillStyle = fillColor;
      overlayCtx.fillRect(0, 0, imageElement.width, imageElement.height);
      
      // Apply mask to color overlay
      const overlayData = overlayCtx.getImageData(0, 0, imageElement.width, imageElement.height);
      for (let i = 0; i < maskData.data.length; i += 4) {
        const maskValue = maskData.data[i]; // Use red channel as mask
        const alpha = maskValue / 255 * opacity;
        overlayData.data[i + 3] = Math.round(overlayData.data[i + 3] * alpha); // Set alpha
      }
      
      overlayCtx.putImageData(overlayData, 0, 0);
      
      // Draw the colored overlay
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(coloredOverlay, 0, 0);
      
      ctx.restore();
    };

    // Draw colored masks (persistent) - lowest priority
    coloredMasks.forEach((coloredMask) => {
      const mask = masks.find(m => m.id === coloredMask.mask_id);
      if (mask) {
        drawMask(mask, coloredMask.color || '#FF0000', coloredMask.opacity || 0.7);
      }
    });

    // Draw masks based on state - higher priority than colored masks
    masks.forEach((mask, index) => {
      const isSelected = selectedMasks.has(mask.id);
      const isHovered = hoveredMaskId === mask.id;
      
      // Skip if this mask is already drawn as a colored mask
      const isColoredMask = coloredMasks.some(cm => cm.mask_id === mask.id);
      
      // Draw masks if they are selected, hovered, or if we're showing all masks
      if ((isSelected || isHovered || showAllMasks) && !isColoredMask) {
        let fillColor = '#4ecdc4';
        let opacity = 0.5;
        
        if (isSelected) {
          fillColor = '#ff6b6b';
          opacity = 0.6;
        } else if (isHovered) {
          fillColor = '#4ecdc4';
          opacity = 0.6;
        } else if (showAllMasks) {
          fillColor = getUniqueColor(index);
          opacity = 0.4;
        }
        
        drawMask(mask, fillColor, opacity);
      }
    });
  }, [imageElement, masks, selectedMasks, coloredMasks, hoveredMaskId, canvasSize, showAllMasks, loadedMaskImages]);

  // Redraw when dependencies change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Utility: Generate unique colors for masks
  const getUniqueColor = (index: number): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
      '#F1948A', '#85C1E9', '#FAD7A0', '#D7BDE2', '#A9DFBF', '#F9E79F',
      '#F5B7B1', '#AED6F1', '#ABEBC6', '#FDEBD0', '#E8DAEF', '#D5F4E6'
    ];
    return colors[index % colors.length];
  };

  // Enhanced mouse move handler with instant mask detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isHoverEnabled || !imageElement || !maskAtPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert canvas coordinates to image coordinates
    const imageCoords = canvasToImageCoords(x, y);
    
    // Check if mouse is within image bounds
    if (imageCoords.x >= 0 && imageCoords.x < imageElement.width && 
        imageCoords.y >= 0 && imageCoords.y < imageElement.height) {
      
      // Instant mask detection using pixel cache
      const maskAtCurrentPoint = maskAtPoint(imageCoords.x, imageCoords.y);
      
      if (maskAtCurrentPoint) {
        setHoveredMaskId(maskAtCurrentPoint.id);
      } else {
        setHoveredMaskId(null);
      }
    } else {
      setHoveredMaskId(null);
    }
  }, [imageElement, maskAtPoint, canvasToImageCoords, setHoveredMaskId, isHoverEnabled]);

  // Handle mouse leave to clear hover
  const handleMouseLeave = useCallback(() => {
    setHoveredMaskId(null);
  }, [setHoveredMaskId]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!imageElement) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Convert canvas coordinates to image coordinates
      const imageCoords = canvasToImageCoords(x, y);
      
      // Check if click is within image bounds
      if (imageCoords.x >= 0 && imageCoords.x <= imageElement.width && 
          imageCoords.y >= 0 && imageCoords.y <= imageElement.height) {
        
        if (isClickToGenerateMode) {
          // Click mode is active - always generate a new mask
          if (e.shiftKey) {
            onPointClick(imageCoords.x, imageCoords.y, true, false);
          } else {
            onPointClick(imageCoords.x, imageCoords.y, false, false);
          }
        } else {
          // Click mode is not active - try to select existing masks
          if (masks.length > 0 && hoveredMaskId !== null) {
            // Toggle selection of the hovered mask
            onMaskSelect(hoveredMaskId, !selectedMasks.has(hoveredMaskId));
          }
        }
      }
    },
    [imageElement, canvasToImageCoords, onPointClick, onMaskSelect, masks.length, isClickToGenerateMode, hoveredMaskId, selectedMasks]
  );

  // Handle right click for removing from selection
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (!imageElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert canvas coordinates to image coordinates
    const imageCoords = canvasToImageCoords(x, y);
    
    // Check if click is within image bounds
    if (imageCoords.x >= 0 && imageCoords.x <= imageElement.width && 
        imageCoords.y >= 0 && imageCoords.y <= imageElement.height) {
      
      // Handle shift+right-click for removing from selection
      if (e.shiftKey) {
        onPointClick(imageCoords.x, imageCoords.y, true, true);
      } else {
        onPointClick(imageCoords.x, imageCoords.y, false, true);
      }
    }
  }, [imageElement, canvasToImageCoords, onPointClick]);

  if (!imageElement) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-gray-400 rounded-full animate-pulse"></div>
          </div>
          <p className="text-gray-500 font-medium">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[700px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 overflow-hidden shadow-lg">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className={`w-full h-full object-contain transition-all duration-300 ${
          isClickToGenerateMode 
            ? 'cursor-crosshair' 
            : 'cursor-pointer'
        }`}
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Cache Status Indicator */}
      {(isEmbeddingCached || isMaskCached) && (
        <div className="absolute top-6 right-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-xl shadow-xl backdrop-blur-sm border border-blue-400/20">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {isEmbeddingCached && isMaskCached ? 'Cached' : isEmbeddingCached ? 'Embedding Cached' : 'Masks Cached'}
            </span>
          </div>
        </div>
      )}
      
      {/* Click Mode Indicator */}
      {isClickToGenerateMode && (
        <div className="absolute top-6 left-6 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-xl shadow-xl backdrop-blur-sm border border-green-400/20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MousePointer className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Click Mode Active</p>
              <p className="text-xs opacity-90">Click to generate masks</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Modern Instructions Panel */}
      {showInstructions && (
        <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-xl p-5 shadow-xl max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">How to Use</h3>
            <button
              onClick={() => setShowInstructions(false)}
              className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Hover to preview masks (instant)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Click to select areas</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Shift+click to add to selection</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Shift+right-click to remove</span>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default InteractiveCanvas;