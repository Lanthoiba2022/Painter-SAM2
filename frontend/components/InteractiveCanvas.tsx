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

  // Debug function to toggle hover
  const toggleHover = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHoverEnabled(!isHoverEnabled);
    console.log(`Hover ${isHoverEnabled ? 'disabled' : 'enabled'}`);
  }, [isHoverEnabled]);

  // Load image and calculate canvas size
  useEffect(() => {
    if (imageData) {
      const img = new Image();
      // Only set crossOrigin for remote URLs; data URLs don't need it and may trigger CORS issues
      if (/^https?:\/\//i.test(imageData)) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        setImageElement(img);
        updateCanvasSize(img);
      };
      img.src = imageData;
    }
  }, [imageData]);

  // FIXED: Update canvas size to match image exactly (no scaling)
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
    
    // CRITICAL FIX: Make programmatic canvas size match the image display size exactly
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

  // FIXED: More precise coordinate conversion with subpixel accuracy
  const canvasToImageCoords = useCallback((canvasX: number, canvasY: number) => {
    if (!imageElement || !canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    
    // Convert from screen coordinates to canvas coordinates with high precision
    const scaleX = canvasSize.width / canvasRect.width;
    const scaleY = canvasSize.height / canvasRect.height;
    
    const canvasLocalX = canvasX * scaleX;
    const canvasLocalY = canvasY * scaleY;
    
    // Since canvas size now matches display size, direct mapping to image
    const imageX = (canvasLocalX / canvasSize.width) * imageElement.width;
    const imageY = (canvasLocalY / canvasSize.height) * imageElement.height;
    
    // Use floor instead of round for more precise pixel targeting
    const coords = {
      x: Math.floor(Math.max(0, Math.min(imageElement.width - 1, imageX))),
      y: Math.floor(Math.max(0, Math.min(imageElement.height - 1, imageY)))
    };
    
    // Debug logging with more detail
    if (Math.random() < 0.01) { // Log 1% of the time to avoid spam
      console.log('Coordinate conversion:', {
        screen: { x: canvasX, y: canvasY },
        canvas: { x: canvasLocalX, y: canvasLocalY },
        image: coords,
        scales: { scaleX, scaleY },
        sizes: { 
          canvas: canvasSize, 
          rendered: { w: canvasRect.width, h: canvasRect.height },
          image: { w: imageElement.width, h: imageElement.height }
        }
      });
    }
    
    return coords;
  }, [imageElement, canvasSize]);

  // Enhanced mask pixel caching with area calculation for better prioritization
  const buildMaskPixelCache = useCallback((maskId: number, maskData: ImageData) => {
    const pixelSet = new Set<string>();
    const { width, height, data } = maskData;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];
        
        // Check if pixel is part of mask (more strict threshold for better precision)
        if (red > 128 || green > 128 || blue > 128) {
          pixelSet.add(`${x},${y}`);
        }
      }
    }
    
    return pixelSet;
  }, []);

  // Ultra-fast point-in-mask detection with improved threshold
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
      const red = maskData.data[pixelIndex];
      const green = maskData.data[pixelIndex + 1];
      const blue = maskData.data[pixelIndex + 2];
      
      // Use higher threshold for better precision
      return red > 128 || green > 128 || blue > 128;
    } catch (error) {
      console.error(`Error checking point in mask ${maskId}:`, error);
      return false;
    }
  }, [imageElement, maskDataCache, maskPixelCache]);

  // Pre-load mask images with enhanced caching for instant hover
  useEffect(() => {
    if (masks.length > 0 && imageElement) {
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

  // FIXED: Smart mask lookup that prioritizes smaller, more specific masks
  const maskAtPoint = useMemo(() => {
    if (!imageElement || masks.length === 0) return null;
    
    return (x: number, y: number) => {
      const matchingMasks = [];
      
      // Find all masks that contain this point
      for (const mask of masks) {
        if (isPointInMask(mask.id, x, y)) {
          matchingMasks.push(mask);
        }
      }
      
      if (matchingMasks.length === 0) return null;
      if (matchingMasks.length === 1) return matchingMasks[0];
      
      // Multiple masks found - prioritize the smallest/most specific one
      // Calculate approximate area for each mask by counting pixels
      const maskAreas = matchingMasks.map(mask => {
        const pixelSet = maskPixelCache[mask.id];
        return {
          mask,
          area: pixelSet ? pixelSet.size : 0
        };
      });
      
      // Sort by area (ascending) - smallest area first
      maskAreas.sort((a, b) => a.area - b.area);
      
      // Return the smallest mask
      return maskAreas[0].mask;
    };
  }, [masks, isPointInMask, imageElement, maskPixelCache]);

  // FIXED: Simplified draw function to match coordinate system
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // CRITICAL FIX: Draw image to fill entire canvas (no centering/scaling)
    // Since canvasSize now matches display size exactly, just fill the canvas
    ctx.drawImage(imageElement, 0, 0, canvasSize.width, canvasSize.height);

    // Function to draw a single mask with given color and opacity
    const drawMask = (mask: any, fillColor: string, opacity: number) => {
      const maskImg = loadedMaskImages[mask.id];
      if (!maskImg) return;

      // Create a temporary canvas for mask compositing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      tempCanvas.width = canvasSize.width;
      tempCanvas.height = canvasSize.height;
      
      // Draw the mask scaled to canvas size
      tempCtx.drawImage(maskImg, 0, 0, canvasSize.width, canvasSize.height);
      
      // Get mask data
      const maskData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Create colored overlay
      const coloredOverlay = document.createElement('canvas');
      const overlayCtx = coloredOverlay.getContext('2d');
      if (!overlayCtx) return;
      
      coloredOverlay.width = canvasSize.width;
      coloredOverlay.height = canvasSize.height;
      
      // Fill with color
      overlayCtx.fillStyle = fillColor;
      overlayCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      
      // Apply mask to color overlay
      const overlayData = overlayCtx.getImageData(0, 0, canvasSize.width, canvasSize.height);
      for (let i = 0; i < maskData.data.length; i += 4) {
        const red = maskData.data[i];
        const green = maskData.data[i + 1];
        const blue = maskData.data[i + 2];
        
        const maskValue = Math.max(red, green, blue);
        const alpha = maskValue / 255 * opacity;
        overlayData.data[i + 3] = Math.round(overlayData.data[i + 3] * alpha);
      }
      
      overlayCtx.putImageData(overlayData, 0, 0);
      
      // Draw the colored overlay
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(coloredOverlay, 0, 0);
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
  
  // Force redraw when hover state changes
  useEffect(() => {
    if (hoveredMaskId !== null) {
      drawCanvas();
    }
  }, [hoveredMaskId, drawCanvas]);

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

  // FIXED: Multi-point sampling for more accurate hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isHoverEnabled || !imageElement || !maskAtPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Simple bounds checking
    const isOverCanvas = x >= 0 && x < rect.width && y >= 0 && y < rect.height;
    
    if (isOverCanvas) {
      // Multi-point sampling for better accuracy
      const samplePoints = [
        { x, y }, // Center point
        { x: x - 1, y }, // Left
        { x: x + 1, y }, // Right
        { x, y: y - 1 }, // Up
        { x, y: y + 1 }, // Down
      ];
      
      let bestMask = null;
      let smallestArea = Infinity;
      
      // Check each sample point
      for (const point of samplePoints) {
        if (point.x >= 0 && point.x < rect.width && point.y >= 0 && point.y < rect.height) {
          const imageCoords = canvasToImageCoords(point.x, point.y);
          const maskAtCurrentPoint = maskAtPoint(imageCoords.x, imageCoords.y);
          
          if (maskAtCurrentPoint) {
            // Get mask area from pixel cache
            const pixelSet = maskPixelCache[maskAtCurrentPoint.id];
            const area = pixelSet ? pixelSet.size : Infinity;
            
            // Prefer smaller masks (more specific)
            if (area < smallestArea) {
              bestMask = maskAtCurrentPoint;
              smallestArea = area;
            }
          }
        }
      }
      
      // Update hover state
      if (bestMask) {
        if (hoveredMaskId !== bestMask.id) {
          setHoveredMaskId(bestMask.id);
        }
      } else {
        if (hoveredMaskId !== null) {
          setHoveredMaskId(null);
        }
      }
    } else {
      if (hoveredMaskId !== null) {
        setHoveredMaskId(null);
      }
    }
  }, [imageElement, maskAtPoint, canvasToImageCoords, setHoveredMaskId, isHoverEnabled, hoveredMaskId, maskPixelCache]);

  // Handle mouse leave to clear hover
  const handleMouseLeave = useCallback(() => {
    setHoveredMaskId(null);
  }, [setHoveredMaskId]);

  // FIXED: Simplified canvas click handler
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!imageElement) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Simple bounds checking
      const isOverCanvas = x >= 0 && x < rect.width && y >= 0 && y < rect.height;
      
      if (isOverCanvas) {
        const imageCoords = canvasToImageCoords(x, y);
        
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

  // FIXED: Simplified context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (!imageElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const isOverCanvas = x >= 0 && x < rect.width && y >= 0 && y < rect.height;
    
    if (isOverCanvas) {
      const imageCoords = canvasToImageCoords(x, y);
      
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
        className={`w-full h-full transition-all duration-300 ${
          isClickToGenerateMode 
            ? 'cursor-crosshair' 
            : 'cursor-pointer'
        }`}
        style={{
          // CRITICAL FIX: Ensure exact pixel mapping
          imageRendering: 'pixelated',
          objectFit: 'fill'
        }}
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Cache Status Indicator */}
      {(isEmbeddingCached || isMaskCached) && (
        <div className="absolute top-6 right-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-xl shadow-xl backdrop-blur-sm border border-blue-400/20 z-10">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {isEmbeddingCached && isMaskCached ? 'Cached' : isEmbeddingCached ? 'Embedding Cached' : 'Masks Cached'}
            </span>
          </div>
        </div>
      )}
      
      {/* Debug Hover Toggle */}
      <div 
        className="absolute top-6 left-6 bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-4 py-2 rounded-xl shadow-xl backdrop-blur-sm border border-yellow-400/20 z-10 cursor-pointer select-none"
        onClick={toggleHover}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleHover(e as any);
          }
        }}
      >
        <span className="text-sm font-medium">
          Hover: {isHoverEnabled ? 'ON' : 'OFF'}
        </span>
      </div>
      
      {/* Click Mode Indicator */}
      {isClickToGenerateMode && (
        <div className="absolute top-6 left-32 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-3 rounded-xl shadow-xl backdrop-blur-sm border border-green-400/20 z-10">
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
              <span>left click to add to selection</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>right click to remove</span>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default InteractiveCanvas;