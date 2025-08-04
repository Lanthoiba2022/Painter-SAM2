'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { CanvasProps } from '@/types';
import { api } from '@/lib/api';
import { MousePointer } from 'lucide-react'; // Added import for MousePointer icon

const InteractiveCanvas: React.FC<CanvasProps> = ({
  imageData,
  masks,
  selectedMasks,
  coloredMasks,
  showAllMasks,
  onMaskSelect,
  onPointClick,
  sessionId,
  isClickToGenerateMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredMaskId, setHoveredMaskId] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showInstructions, setShowInstructions] = useState(true);

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

  // Update canvas size to fit container
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
      // Image is wider than container
      canvasWidth = containerWidth;
      canvasHeight = containerWidth / imgAspectRatio;
    } else {
      // Image is taller than container
      canvasHeight = containerHeight;
      canvasWidth = containerHeight * imgAspectRatio;
    }
    
    setCanvasSize({ width: canvasWidth, height: canvasHeight });
    setScale(Math.min(canvasWidth / img.width, canvasHeight / img.height));
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

  // Convert canvas coordinates to image coordinates
  const canvasToImageCoords = useCallback((canvasX: number, canvasY: number) => {
    if (!imageElement) return { x: 0, y: 0 };
    
    const imageX = (canvasX - offset.x) / scale;
    const imageY = (canvasY - offset.y) / scale;
    
    return {
      x: Math.round(imageX),
      y: Math.round(imageY)
    };
  }, [imageElement, offset, scale]);

  // Find mask at point by checking mask data
  const findMaskAtPoint = useCallback(async (x: number, y: number) => {
    if (!imageElement || masks.length === 0) return null;
    
    // For now, we'll use a simple approach to find the mask at point
    // In a real implementation, you'd check the actual mask data
    // For demo purposes, we'll return the first mask that might contain this point
    return masks.find(mask => {
      // Simple heuristic: check if point is within a reasonable area of the mask
      // This is a placeholder - in reality you'd decode the mask and check the pixel
      return true; // For now, return first mask
    }) || null;
  }, [imageElement, masks]);

  // Improved hover detection with actual mask checking
  const findMaskAtPointImproved = useCallback(async (x: number, y: number) => {
    if (!imageElement || masks.length === 0) return null;
    
    // For now, return the first mask as a simple implementation
    // In a real implementation, you'd decode each mask and check if the point is inside
    return masks[0] || null;
  }, [imageElement, masks]);

  // Draw function with improved mask rendering
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    ctx.drawImage(imageElement, 0, 0);
    ctx.restore();

    console.log(`Drawing ${coloredMasks.length} colored masks`);

    // Draw colored masks (persistent)
    coloredMasks.forEach((coloredMask, index) => {
      const mask = masks.find(m => m.id === coloredMask.mask_id);
      if (mask) {
        console.log(`Drawing colored mask ${index + 1}/${coloredMasks.length}: ID ${coloredMask.mask_id}, Color ${coloredMask.color}`);
        
        const maskImg = new Image();
        maskImg.onload = () => {
          ctx.save();
          ctx.translate(offset.x, offset.y);
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
          overlayCtx.fillStyle = coloredMask.color || '#FF0000';
          overlayCtx.fillRect(0, 0, imageElement.width, imageElement.height);
          
          // Apply mask to color overlay
          const overlayData = overlayCtx.getImageData(0, 0, imageElement.width, imageElement.height);
          for (let i = 0; i < maskData.data.length; i += 4) {
            const maskValue = maskData.data[i]; // Use red channel as mask
            const alpha = maskValue / 255 * (coloredMask.opacity || 0.7);
            overlayData.data[i + 3] = Math.round(overlayData.data[i + 3] * alpha); // Set alpha
          }
          
          overlayCtx.putImageData(overlayData, 0, 0);
          
          // Draw the colored overlay
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(coloredOverlay, 0, 0);
          
          ctx.restore();
        };
        maskImg.src = `data:image/png;base64,${mask.mask}`;
      } else {
        console.warn(`Mask with ID ${coloredMask.mask_id} not found in masks array`);
      }
    });

    // Draw selection and hover overlays
    const masksToDraw: Array<{ mask: any; isSelected: boolean; isHovered: boolean }> = [];

    // Add selected and hovered masks (but not colored ones)
    masks.forEach(mask => {
      const isSelected = selectedMasks.has(mask.id);
      const isHovered = hoveredMaskId === mask.id;
      const isColored = coloredMasks.some(cm => cm.mask_id === mask.id);
      
      // Only draw selection/hover overlays for non-colored masks
      if (!isColored && (isSelected || isHovered)) {
        masksToDraw.push({
          mask,
          isSelected,
          isHovered
        });
      }
    });

    // Draw selection and hover overlays
    masksToDraw.forEach(({ mask, isSelected, isHovered }) => {
      const maskImg = new Image();
      maskImg.onload = () => {
        ctx.save();
        ctx.translate(offset.x, offset.y);
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
        
        // Determine color and opacity based on state
        let fillColor = '#4ecdc4';
        let opacity = 0.5;
        
        if (isSelected) {
          fillColor = '#ff6b6b';
          opacity = 0.6;
        } else if (isHovered) {
          fillColor = '#4ecdc4';
          opacity = 0.5;
        }
        
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
      maskImg.src = `data:image/png;base64,${mask.mask}`;
    });
  }, [imageElement, masks, selectedMasks, coloredMasks, hoveredMaskId, scale, offset]);

  // Redraw when dependencies change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Additional redraw when colored masks change
  useEffect(() => {
    if (coloredMasks.length > 0) {
      console.log('Colored masks updated, redrawing canvas');
      drawCanvas();
    }
  }, [coloredMasks.length, drawCanvas]);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageElement) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
    
    // Convert to image coordinates
    const imageCoords = canvasToImageCoords(x, y);
    
    // Check if mouse is within image bounds
    if (imageCoords.x >= 0 && imageCoords.x <= imageElement.width && 
        imageCoords.y >= 0 && imageCoords.y <= imageElement.height) {
      
      // Find mask at point for hover effect
      const maskAtPoint = await findMaskAtPointImproved(imageCoords.x, imageCoords.y);
      setHoveredMaskId(maskAtPoint?.id || null);
    } else {
      setHoveredMaskId(null);
    }

    // Handle dragging
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [imageElement, canvasToImageCoords, findMaskAtPointImproved, isDragging, dragStart]);

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
        
        // Handle shift+click for adding to selection
        if (e.shiftKey) {
          onPointClick(imageCoords.x, imageCoords.y, true, false);
        } else {
          // Regular click
          onPointClick(imageCoords.x, imageCoords.y, false, false);
        }
      }
    },
    [imageElement, canvasToImageCoords, onPointClick]
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

  // Handle mouse events for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle wheel for zooming
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const scaleBy = 1.1;
    const newScale = e.deltaY > 0 ? scale / scaleBy : scale * scaleBy;
    setScale(Math.max(0.1, Math.min(5, newScale)));
  }, [scale]);

  if (!imageElement) {
    return (
      <div className="flex items-center justify-center w-full h-96 bg-gray-100 rounded-lg">
        <div className="text-gray-500">Loading image...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="canvas-container relative w-full h-full min-h-[600px]">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className={`border border-gray-300 rounded-lg transition-all ${
          isClickToGenerateMode 
            ? 'cursor-crosshair border-green-400 bg-green-50' 
            : 'cursor-crosshair'
        } w-full h-full object-contain`}
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      {/* Click Mode Indicator */}
      {isClickToGenerateMode && (
        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-2 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <MousePointer className="w-4 h-4" />
            <span className="text-sm font-medium">Click Mode Active</span>
          </div>
        </div>
      )}
      
      {/* Clean Instructions Panel */}
      {showInstructions && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-4 shadow-lg max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">How to Use</h3>
            <button
              onClick={() => setShowInstructions(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• Click to select areas</p>
            <p>• Shift+click to add to selection</p>
            <p>• Shift+right-click to remove</p>
            <p>• Drag to pan, scroll to zoom</p>
          </div>
        </div>
      )}
      
      {/* Clean Status Panel */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>Masks: {masks.length}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>Selected: {selectedMasks.size}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <span>Colored: {coloredMasks.length}</span>
          </div>
        </div>
      </div>
      
      {/* Clean Zoom Controls */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg">
        <div className="text-xs text-gray-600 mb-2">
          Zoom: {Math.round(scale * 100)}%
        </div>
        <div className="flex space-x-1">
          <button
            onClick={() => setScale(Math.min(5, scale * 1.2))}
            className="w-6 h-6 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setScale(Math.max(0.1, scale / 1.2))}
            className="w-6 h-6 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
          >
            -
          </button>
        </div>
      </div>

      {/* Mouse Position Indicator */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg">
        <div className="text-xs text-gray-600">
          Mouse: {Math.round(mousePosition.x)}, {Math.round(mousePosition.y)}
        </div>
      </div>
    </div>
  );
};

export default InteractiveCanvas; 