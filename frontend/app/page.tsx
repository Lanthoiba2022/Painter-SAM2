'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import UploadZone from '@/components/UploadZone';
import InteractiveCanvas from '@/components/InteractiveCanvas';
import MaskGallery from '@/components/MaskGallery';
import ColorPalette from '@/components/ColorPalette';
import Toolbar from '@/components/Toolbar';
import { useAppStore } from '@/store/useAppStore';
import { api, handleApiError } from '@/lib/api';
import { MaskInfo, ColoredMask } from '@/types';

export default function HomePage() {
  const {
    // State
    sessionId,
    imageData,
    masks,
    selectedMasks,
    coloredMasks,
    currentColor,
    currentOpacity,
    showAllMasks,
    paintedImage,
    isGeneratingMasks,
    isPainting,
    isDownloading,
    error,
    hoveredMaskId,
    isClickToGenerateMode,
    
    // Actions
    setSessionId,
    setImageData,
    setError,
    setMasks,
    selectMask,
    clearSelectedMasks,
    addColoredMask,
    setCurrentColor,
    setCurrentOpacity,
    setShowAllMasks,
    setPaintedImage,
    setGeneratingMasks,
    setPainting,
    setDownloading,
    setHoveredMaskId,
    setClickToGenerateMode,
    generateMaskAtPoint,
    reset,
  } = useAppStore();

  const [isUploading, setIsUploading] = useState(false);

  // Handle image upload
  const handleImageUpload = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      
      // Create preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        // Set preview immediately for better UX
        setImageData(previewUrl, 0, 0, file.name);
      };
      reader.readAsDataURL(file);
      
      toast.loading('Uploading image...', { id: 'upload' });
      
      const response = await api.uploadImage(file);
      
      setSessionId(response.session_id);
      setImageData(response.image_data, response.width, response.height, file.name);
      
      toast.success('Image uploaded successfully!', { id: 'upload' });
      
      // Auto-generate masks after upload
      setTimeout(() => {
        handleGenerateMasks();
      }, 1000);
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      toast.error(`Upload failed: ${errorMessage}`, { id: 'upload' });
    } finally {
      setIsUploading(false);
    }
  }, [setSessionId, setImageData, setError]);

  // Generate masks
  const handleGenerateMasks = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setGeneratingMasks(true);
      setError(null);
      
      toast.loading('Generating masks... This may take a few minutes.', { id: 'generate-masks' });
      
      const response = await api.generateMasks(sessionId);
      
      setMasks(response.masks);
      clearSelectedMasks();
      
      toast.success(`Generated ${response.total_masks} masks! Click on the image or select masks from the gallery below to start painting.`, { 
        id: 'generate-masks',
        duration: 5000 
      });
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      toast.error(`Failed to generate masks: ${errorMessage}`, { 
        id: 'generate-masks',
        duration: 5000 
      });
    } finally {
      setGeneratingMasks(false);
    }
  }, [sessionId, setMasks, clearSelectedMasks, setError, setGeneratingMasks]);

  // Handle point click for mask selection
  const handlePointClick = useCallback(async (x: number, y: number, isShiftClick: boolean = false, isRightClick: boolean = false) => {
    if (!sessionId) return;
    
    try {
      // If we have masks, try to find the mask at this point (this is always allowed)
      if (masks.length > 0) {
        const response = await api.getMaskAtPoint(sessionId, [x, y], masks);
        
        // Find the mask in our local array and select it
        const maskIndex = masks.findIndex(m => m.mask === response.mask);
        if (maskIndex !== -1) {
          const maskId = masks[maskIndex].id;
          
          if (isRightClick) {
            // Remove from selection
            selectMask(maskId, false);
            toast.success('Area removed from selection!');
          } else if (isShiftClick) {
            // Add to selection
            selectMask(maskId, true);
            toast.success('Area added to selection!');
          } else {
            // Replace selection
            clearSelectedMasks();
            selectMask(maskId, true);
            toast.success('Area selected!');
          }
        } else {
          toast.error('No mask found at this point. Try clicking on a different area.');
        }
      } else if (isClickToGenerateMode) {
        // No masks available and click-to-generate mode is active, generate a new mask at this point
        toast.loading('Generating mask for this area...', { id: 'generate-mask-point' });
        
        const newMask = await generateMaskAtPoint(sessionId, [x, y]);
        
        if (newMask) {
          toast.success('Mask generated for this area!', { id: 'generate-mask-point' });
        } else {
          toast.error('Failed to generate mask for this area. Please try again.', { id: 'generate-mask-point' });
        }
      } else {
        // No masks available and click-to-generate mode is not active
        toast.success('Click "Click to Generate Mask" to enable mask generation mode, then click on areas to generate masks.');
      }
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      console.error('Point click error:', err);
      toast.error(`Failed to select area: ${errorMessage}`);
    }
  }, [sessionId, masks, selectMask, clearSelectedMasks, generateMaskAtPoint, isClickToGenerateMode]);

  // Toggle click to generate mode
  const handleToggleClickToGenerate = useCallback(() => {
    setClickToGenerateMode(!isClickToGenerateMode);
    if (!isClickToGenerateMode) {
      toast.success('Click mode enabled! Click on areas to generate masks.');
    } else {
      toast.success('Click mode disabled. You can now freely zoom and pan without generating masks.');
    }
  }, [isClickToGenerateMode, setClickToGenerateMode]);

  // Paint selected masks
  const handlePaintMasks = useCallback(async () => {
    if (!sessionId || selectedMasks.size === 0) {
      toast.error('Please select at least one area to paint!');
      return;
    }
    
    try {
      setPainting(true);
      setError(null);
      
      toast.loading('Painting selected areas...', { id: 'paint-masks' });
      
      // Prepare colored masks for API - add new ones to existing colored masks
      const newColoredMasks: ColoredMask[] = Array.from(selectedMasks).map(maskId => {
        const mask = masks.find(m => m.id === maskId);
        return {
          mask_id: maskId,
          mask: mask?.mask,
          color: currentColor,
          opacity: currentOpacity,
        };
      });
      
      // Combine existing colored masks with new ones
      const allColoredMasks = [...coloredMasks, ...newColoredMasks];
      
      const response = await api.paintMultipleMasks(sessionId, allColoredMasks);
      
      setPaintedImage(response.painted_image);
      
      // Add new colored masks to the list (this will update existing ones or add new ones)
      newColoredMasks.forEach(coloredMask => {
        addColoredMask(coloredMask);
      });
      
      // Clear selection after painting
      clearSelectedMasks();
      
      toast.success(`Successfully painted ${response.num_masks_painted} areas! You can now download the result.`, { 
        id: 'paint-masks',
        duration: 4000 
      });
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      toast.error(`Failed to paint areas: ${errorMessage}`, { 
        id: 'paint-masks',
        duration: 5000 
      });
    } finally {
      setPainting(false);
    }
  }, [sessionId, selectedMasks, masks, currentColor, currentOpacity, coloredMasks, setPaintedImage, addColoredMask, clearSelectedMasks, setError, setPainting]);

  // Download painted image
  const handleDownloadImage = useCallback(async () => {
    if (!sessionId) {
      toast.error('No session available for download');
      return;
    }
    
    try {
      setDownloading(true);
      
      toast.loading('Preparing download...', { id: 'download' });
      
      // If we have a painted image, download it directly
      if (paintedImage) {
        // Convert base64 to blob and download
        const base64Response = await fetch(`data:image/png;base64,${paintedImage}`);
        const blob = await base64Response.blob();
        const filename = `painted_building_${Date.now()}.png`;
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Download completed!', { id: 'download' });
        return;
      }
      
      // If no painted image but we have colored masks, paint them first
      if (coloredMasks.length > 0) {
        toast.loading('Painting all masks for download...', { id: 'download' });
        
        // Prepare colored masks for API - include ALL colored masks
        const coloredMasksForAPI: ColoredMask[] = coloredMasks.map(coloredMask => ({
          mask_id: coloredMask.mask_id,
          mask: coloredMask.mask,
          color: coloredMask.color,
          opacity: coloredMask.opacity,
        }));
        
        const response = await api.paintMultipleMasks(sessionId, coloredMasksForAPI);
        
        // Download the painted image with ALL masks
        const base64Response = await fetch(`data:image/png;base64,${response.painted_image}`);
        const blob = await base64Response.blob();
        const filename = `painted_building_all_masks_${Date.now()}.png`;
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Download completed with all masks!', { id: 'download' });
        return;
      }
      
      // If no colored masks, download the original image
      toast.loading('Downloading original image...', { id: 'download' });
      
      const response = await api.downloadImage(sessionId, 'PNG', 95);
      
      // Download the file
      const blob = await api.downloadFile(response.image_url.split('/').pop() || '');
      const filename = `original_building_${Date.now()}.png`;
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Download completed!', { id: 'download' });
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      toast.error(`Download failed: ${errorMessage}`, { id: 'download' });
    } finally {
      setDownloading(false);
    }
  }, [sessionId, paintedImage, coloredMasks, setDownloading]);

  // Reset everything
  const handleReset = useCallback(() => {
    reset();
    toast.success('Application reset successfully!');
  }, [reset]);

  // Toggle all masks visibility
  const handleToggleAllMasks = useCallback(() => {
    setShowAllMasks(!showAllMasks);
  }, [showAllMasks, setShowAllMasks]);

  // Handle color selection
  const handleColorSelect = useCallback((color: string) => {
    setCurrentColor(color);
  }, [setCurrentColor]);

  // Handle mask selection from gallery
  const handleMaskSelect = useCallback((maskId: number, isSelected: boolean) => {
    selectMask(maskId, isSelected);
  }, [selectMask]);

  // Handle mask hover from gallery
  const handleMaskHover = useCallback((maskId: number | null) => {
    setHoveredMaskId(maskId);
  }, [setHoveredMaskId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">S2</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                SAM2 Building Painter
              </h1>
            </div>
            <div className="text-sm text-gray-500">
              Powered by Meta AI
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Sidebar - Tools */}
          <div className="lg:col-span-1 space-y-6">
            <Toolbar
              onGenerateMasks={handleGenerateMasks}
              onPaintMasks={handlePaintMasks}
              onDownloadImage={handleDownloadImage}
              onReset={handleReset}
              onToggleAllMasks={handleToggleAllMasks}
              onToggleClickToGenerate={handleToggleClickToGenerate}
              isGeneratingMasks={isGeneratingMasks}
              isPainting={isPainting}
              isDownloading={isDownloading}
              hasImage={!!imageData}
              hasMasks={masks.length > 0}
              hasSelectedMasks={selectedMasks.size > 0}
              isClickToGenerateMode={isClickToGenerateMode}
            />
            
            <ColorPalette
              colors={[
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
                '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
                '#F1948A', '#85C1E9', '#FAD7A0', '#D7BDE2', '#A9DFBF', '#F9E79F',
                '#F5B7B1', '#AED6F1', '#ABEBC6', '#FDEBD0', '#E8DAEF', '#D5F4E6'
              ]}
              selectedColor={currentColor}
              onColorSelect={handleColorSelect}
            />
          </div>

          {/* Main Canvas Area */}
          <div className="lg:col-span-4">
            {!imageData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-8"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Welcome to SAM2 Building Painter
                  </h2>
                  <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                    Upload an image of an Indian house or building, and use AI-powered segmentation 
                    to automatically identify walls and other architectural elements. Then paint them 
                    with beautiful colors to create stunning visualizations.
                  </p>
                  <UploadZone
                    onImageUpload={handleImageUpload}
                    isLoading={isUploading}
                  />
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {/* Canvas */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Image Preview
                    </h3>
                    <div className="text-sm text-gray-500">
                      {masks.length > 0 && (
                        <span className="mr-4">
                          {masks.length} masks available
                        </span>
                      )}
                      {selectedMasks.size > 0 && (
                        <span className="mr-4">
                          {selectedMasks.size} selected
                        </span>
                      )}
                      {coloredMasks.length > 0 && (
                        <span>
                          {coloredMasks.length} colored
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-[600px] relative">
                    <InteractiveCanvas
                      imageData={imageData}
                      masks={masks}
                      selectedMasks={selectedMasks}
                      coloredMasks={coloredMasks}
                      showAllMasks={showAllMasks}
                      onMaskSelect={handleMaskSelect}
                      onPointClick={handlePointClick}
                      sessionId={sessionId}
                      isClickToGenerateMode={isClickToGenerateMode}
                    />
                  </div>
                </div>

                {/* Mask Gallery */}
                {masks.length > 0 && (
                  <MaskGallery
                    masks={masks}
                    selectedMasks={selectedMasks}
                    onMaskSelect={handleMaskSelect}
                    onMaskHover={handleMaskHover}
                  />
                )}

                {/* Painted Result */}
                {paintedImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Painted Result
                    </h3>
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${paintedImage}`}
                        alt="Painted building"
                        className="max-w-full h-auto rounded-lg shadow-md"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Error Display */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-lg p-4"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <p className="text-red-700">{error}</p>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>
              Built with Next.js, React Konva, and SAM2. 
              Powered by Meta AI's Segment Anything Model 2.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
} 