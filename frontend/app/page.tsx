'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import UploadZone from '@/components/UploadZone';
import MaskGallery from '@/components/MaskGallery';
import ColorPalette from '@/components/ColorPalette';
import Toolbar from '@/components/Toolbar';
import AuthModal from '@/components/AuthModal';
import UserProfile from '@/components/UserProfile';
import DuplicateNotification from '@/components/DuplicateNotification';
import { useAppStore } from '@/store/useAppStore';
import { api, handleApiError } from '@/lib/api';
import { MaskInfo, ColoredMask } from '@/types';
import ClientOnly from '@/components/ClientOnly';
import { supabase } from '@/lib/supabase';
import { handleImageUpload, generateMasksForImage, saveMasksToStorage, fetchDuplicateImage, initializeUserStorage } from '@/lib/upload-workflow';

// Dynamically import InteractiveCanvas to prevent hydration issues
const InteractiveCanvas = dynamic(() => import('@/components/InteractiveCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full min-h-[600px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <div className="w-8 h-8 bg-gray-400 rounded-full animate-pulse"></div>
        </div>
        <p className="text-gray-500 font-medium">Loading canvas...</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  // Use ClientOnly to prevent hydration issues with Zustand store
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
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
    isGeneratingAdvancedMasks,
    isPainting,
    isDownloading,
    error,
    hoveredMaskId,
    isClickToGenerateMode,
    
    // Authentication state
    user,
    isAuthenticated,
    isAuthLoading,
    
    // Duplicate detection state
    isDuplicateChecking,
    duplicateStatus,
    
    // Caching state
    currentImageHash,
    isEmbeddingCached,
    isMaskCached,
    
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
    setGeneratingAdvancedMasks,
    setPainting,
    setDownloading,
    setHoveredMaskId,
    setClickToGenerateMode,
    generateMaskAtPoint,
    reset,
    
    // Authentication actions
    setUser,
    setIsAuthenticated,
    setIsAuthLoading,
    
    // Duplicate detection actions
    setIsDuplicateChecking,
    setDuplicateStatus,
    
    // Caching actions
    setEmbeddingCache,
    setMaskCache,
    getCachedMasks,
    setIsEmbeddingCached,
    setIsMaskCached,
  } = useAppStore();

  const [isUploading, setIsUploading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Add new state for improved workflow
  const [showNewImagePopup, setShowNewImagePopup] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // Setup authentication listener
  useEffect(() => {
    const setupAuth = async () => {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        setIsAuthenticated(true);
        // Initialize user storage
        await initializeUserStorage(session.user.id);
      }
      
      setIsAuthLoading(false);
      
      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state changed:', event, session?.user?.email);
          
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
            // Initialize user storage for new users
            await initializeUserStorage(session.user.id);
          } else {
            setUser(null);
            setIsAuthenticated(false);
          }
          
          setIsAuthLoading(false);
        }
      );
      
      return () => subscription.unsubscribe();
    };
    
    setupAuth();
  }, [setUser, setIsAuthenticated, setIsAuthLoading]);

  // Clear cache on page refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear cache when page is refreshed
      localStorage.removeItem('sam2-building-painter-store');
    };

    // Clear cache on initial load to ensure fresh start
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sam2-building-painter-store');
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Auto-load cached masks when image hash changes
  useEffect(() => {
    if (currentImageHash && !masks.length) {
      const cachedMasks = getCachedMasks(currentImageHash);
      if (cachedMasks && cachedMasks.length > 0) {
        console.log(`Loading ${cachedMasks.length} cached masks for image ${currentImageHash}`);
        setMasks(cachedMasks);
        setIsMaskCached(true);
        toast.success(`Loaded ${cachedMasks.length} cached masks!`, { 
          id: 'cached-masks',
          duration: 3000 
        });
      }
    }
  }, [currentImageHash, masks.length, getCachedMasks, setMasks, setIsMaskCached]);

  // Handle image upload with Supabase integration and duplicate detection
  const handleImageUploadWithAuth = useCallback(async (file: File) => {
    if (!isAuthenticated || !user) {
      setShowAuthModal(true);
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setCurrentFile(file);
      
      // Use the integrated upload workflow (no auto-generation)
      const result = await handleImageUpload(
        file,
        user.id,
        setDuplicateStatus,
        setMasks,
        setImageData,
        setSessionId
      );
      
      if (result.imageHash) {
        setCurrentFileHash(result.imageHash);
      }
      
      // Show popup for new images regardless of current duplicateStatus state
      if (!result.isExistingImage) {
        setShowNewImagePopup(true);
      }
      
      // If it's an existing image, reset duplicate status after loading
      if (result.isExistingImage) {
        // Duplicate image already has masks; allow Save to re-save if needed
        setCanSave(masks.length > 0);
        setHasSaved(false);
        setTimeout(() => setDuplicateStatus(null), 3000);
      }
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      toast.error(`Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  }, [isAuthenticated, user, setDuplicateStatus, setMasks, setImageData, setSessionId, setError]);

  // Generate masks when user explicitly clicks the button
  const handleGenerateMasksExplicit = useCallback(async (shouldSave: boolean = false) => {
    if (!sessionId || !currentFile || !user || !currentFileHash) {
      toast.error('Missing required data for mask generation');
      return;
    }
    
    try {
      setGeneratingMasks(true);
      setError(null);
      setShowNewImagePopup(false);
      
      const generatedMasks = await generateMasksForImage(
        sessionId,
        currentFile,
        user.id,
        currentFileHash,
        shouldSave
      );
      
      setMasks(generatedMasks);
      clearSelectedMasks();
      setDuplicateStatus(null);

      // Enable Save when we have masks and an image hash
      if (generatedMasks.length > 0) {
        setCanSave(true);
        setHasSaved(false);
      }
      
      // Cache the masks for future use
      if (currentFileHash) {
        setMaskCache(currentFileHash, generatedMasks, 32, 0.88, 0.95);
        setIsMaskCached(true);
      }
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      toast.error(`Failed to generate masks: ${errorMessage}`);
    } finally {
      setGeneratingMasks(false);
    }
  }, [sessionId, currentFile, user, currentFileHash, setMasks, clearSelectedMasks, setMaskCache, setIsMaskCached, setError, setGeneratingMasks, setDuplicateStatus]);

  // Generate masks with caching
  const handleGenerateMasks = useCallback(async () => {
    if (!sessionId || !currentImageHash) return;
    
    try {
      setGeneratingMasks(true);
      setError(null);
      
      toast.loading('Generating masks with improved coverage...', { id: 'generate-masks' });
      
      // Use cached endpoint for better performance
      const response = await api.generateMasksWithCache(sessionId, currentImageHash, 96, 0.7, 0.8);
      
      setMasks(response.masks);
      clearSelectedMasks();
      
      // Cache the masks for future use
      if (currentImageHash) {
        setMaskCache(currentImageHash, response.masks, 96, 0.7, 0.8);
        setIsMaskCached(true);
      }
      
      const cacheStatus = response.cached ? ' (from cache)' : '';
      toast.success(`Generated ${response.total_masks} masks with improved coverage!${cacheStatus}`, { 
        id: 'generate-masks',
        duration: 4000 
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
  }, [sessionId, currentImageHash, setMasks, clearSelectedMasks, setMaskCache, setIsMaskCached, setError, setGeneratingMasks]);

  // Generate masks with advanced parameters for maximum coverage
  const handleGenerateAdvancedMasks = useCallback(async () => {
    if (!sessionId || !currentImageHash) return;
    
    try {
      setGeneratingAdvancedMasks(true);
      setError(null);
      
      toast.loading('Generating masks with maximum coverage...', { id: 'generate-advanced-masks' });
      
      // Use maximum coverage parameters with caching
      const response = await api.generateMasksWithCache(sessionId, currentImageHash, 128, 0.6, 0.7);
      
      setMasks(response.masks);
      clearSelectedMasks();
      
      // Cache the masks for future use
      if (currentImageHash) {
        setMaskCache(currentImageHash, response.masks, 128, 0.6, 0.7);
        setIsMaskCached(true);
      }
      
      const cacheStatus = response.cached ? ' (from cache)' : '';
      toast.success(`Generated ${response.total_masks} masks with maximum coverage!${cacheStatus}`, { 
        id: 'generate-advanced-masks',
        duration: 4000 
      });
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      toast.error(`Failed to generate advanced masks: ${errorMessage}`, { 
        id: 'generate-advanced-masks',
        duration: 5000 
      });
    } finally {
      setGeneratingAdvancedMasks(false);
    }
  }, [sessionId, currentImageHash, setMasks, clearSelectedMasks, setMaskCache, setIsMaskCached, setError, setGeneratingAdvancedMasks]);

  // Handle point click for mask selection with caching
  const handlePointClick = useCallback(async (x: number, y: number, isShiftClick: boolean = false, isRightClick: boolean = false) => {
    if (!sessionId || !currentImageHash) return;
    
    try {
      if (isClickToGenerateMode) {
        // Click mode is active - generate a new mask at this point with caching
        toast.loading('Generating mask for this area...', { id: 'generate-mask-point' });
        
        const newMask = await generateMaskAtPoint(sessionId, [x, y]);
        
        if (newMask) {
          toast.success('Mask generated for this area!', { id: 'generate-mask-point' });
        } else {
          toast.error('Failed to generate mask for this area. Please try again.', { id: 'generate-mask-point' });
        }
      } else {
        // Click mode is not active - handle existing mask selection/deselection with instant cache lookup
        if (masks.length > 0) {
          if (isRightClick) {
            // Right-click: Try to deselect masks at this point without calling backend
            const selectedMaskAtPoint = Array.from(selectedMasks).find(maskId => {
              const mask = masks.find(m => m.id === maskId);
              if (!mask) return false;
              return true;
            });
            
            if (selectedMaskAtPoint) {
              selectMask(selectedMaskAtPoint, false);
              toast.success('Mask deselected!');
            } else {
              // Use instant cache lookup if available
              const response = await api.getMaskAtPointInstant(sessionId, [x, y], currentImageHash, masks);
              const maskIndex = masks.findIndex(m => m.mask === response.mask);
              if (maskIndex !== -1) {
                const maskId = masks[maskIndex].id;
                selectMask(maskId, false);
                toast.success('Mask deselected!');
              } else {
                toast.success('No mask found at this point to deselect.');
              }
            }
          } else if (isShiftClick) {
            // Shift+click: Add to selection with instant cache lookup
            const response = await api.getMaskAtPointInstant(sessionId, [x, y], currentImageHash, masks);
            const maskIndex = masks.findIndex(m => m.mask === response.mask);
            if (maskIndex !== -1) {
              const maskId = masks[maskIndex].id;
              selectMask(maskId, true);
              const cacheStatus = response.cached ? ' (instant)' : '';
              toast.success(`Mask added to selection!${cacheStatus}`);
            } else {
              toast.error('No mask found at this point. Try clicking on a different area.');
            }
          } else {
            // Normal click: Replace selection with instant cache lookup
            const response = await api.getMaskAtPointInstant(sessionId, [x, y], currentImageHash, masks);
            const maskIndex = masks.findIndex(m => m.mask === response.mask);
            if (maskIndex !== -1) {
              const maskId = masks[maskIndex].id;
              clearSelectedMasks();
              selectMask(maskId, true);
              const cacheStatus = response.cached ? ' (instant)' : '';
              toast.success(`Mask selected!${cacheStatus}`);
            } else {
              toast.error('No mask found at this point. Try clicking on a different area.');
            }
          }
        } else {
          // No masks available and click mode is not active
          toast.success('Click "Click to Generate Mask" to enable mask generation mode, then click on areas to generate masks.');
        }
      }
      
    } catch (err) {
      const errorMessage = handleApiError(err);
      console.error('Point click error:', err);
      toast.error(`Failed to select area: ${errorMessage}`);
    }
  }, [sessionId, currentImageHash, masks, selectedMasks, selectMask, clearSelectedMasks, generateMaskAtPoint, isClickToGenerateMode]);

  // Toggle click to generate mode
  const handleToggleClickToGenerate = useCallback(() => {
    setClickToGenerateMode(!isClickToGenerateMode);
    if (!isClickToGenerateMode) {
      toast.success('Click mode enabled! Click on areas to generate masks.');
    } else {
      toast.success('Click mode disabled. You can now freely select existing masks.');
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
  const handleReset = useCallback(async () => {
    // Clear all cached data
    localStorage.removeItem('sam2-building-painter-store');
    
    // Clear backend cache as well
    try {
      await api.clearCache();
    } catch (error) {
      console.warn('Failed to clear backend cache:', error);
    }
    
    reset();
    toast.success('Application reset successfully!');
  }, [reset]);

  // Toggle all masks visibility
  const handleToggleAllMasks = useCallback(() => {
    setShowAllMasks(!showAllMasks);
    toast.success(showAllMasks ? 'All masks hidden' : 'All masks visible');
  }, [showAllMasks, setShowAllMasks]);

  // Handle color selection
  const handleColorSelect = useCallback((color: string) => {
    setCurrentColor(color);
  }, [setCurrentColor]);

  // Handle mask selection from gallery
  const handleMaskSelect = useCallback((maskId: number, isSelected: boolean) => {
    selectMask(maskId, isSelected);
  }, [selectMask]);

  // Handle mask deselection (not removal)
  const handleMaskDeselect = useCallback((maskId: number) => {
    selectMask(maskId, false);
    toast.success('Mask deselected!');
  }, [selectMask]);

  // Handle mask hover from gallery
  const handleMaskHover = useCallback((maskId: number | null) => {
    setHoveredMaskId(maskId);
  }, [setHoveredMaskId]);

  // Save current image and masks to storage
  const handleSaveToStorage = useCallback(async () => {
    if (!currentFile || !user || !currentFileHash || !masks.length) {
      toast.error('Nothing to save');
      return;
    }
    
    try {
      const success = await saveMasksToStorage(currentFile, user.id, currentFileHash, masks);
      if (success) {
        setCanSave(false);
        setHasSaved(true);
        toast.success('Saved to your library');
      }
    } catch (err) {
      toast.error('Failed to save to storage');
    }
  }, [currentFile, user, currentFileHash, masks]);

  // Fetch duplicates manually
  const handleFetchDuplicates = useCallback(async () => {
    if (!currentFile || !user) {
      toast.error('No image to check');
      return;
    }
    
    try {
      const result = await fetchDuplicateImage(currentFile, user.id);
      
      if (result.isDuplicate && result.masks) {
        setMasks(result.masks);
        setDuplicateStatus('duplicate');
        setTimeout(() => setDuplicateStatus(null), 3000);
      } else {
        setDuplicateStatus('new');
        setTimeout(() => setDuplicateStatus(null), 3000);
      }
    } catch (err) {
      toast.error('Failed to check for duplicates');
    }
  }, [currentFile, user, setMasks, setDuplicateStatus]);

  // Handle logout with proper cleanup
  const handleSignOut = useCallback(() => {
    // Clear all app state
    reset();
    
    // Clear localStorage
    localStorage.removeItem('sam2-building-painter-store');
    
    // Reset local state
    setCurrentFile(null);
    setCurrentFileHash(null);
    setCanSave(false);
    setHasSaved(false);
    setShowNewImagePopup(false);
    setDuplicateStatus(null);
    
    // Set loading to false immediately to prevent infinite loading
    setIsAuthLoading(false);
  }, [reset, setIsAuthLoading, setDuplicateStatus]);

  // Handle new image popup close
  const handleNewImagePopupClose = useCallback(() => {
    setShowNewImagePopup(false);
    setDuplicateStatus(null);
  }, [setDuplicateStatus]);

  // Don't render until client-side to prevent hydration issues
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl overflow-hidden">
              <img 
                src="/color-palette.png" 
                alt="Color Palette" 
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-gray-500 font-medium">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
                <img 
                  src="/color-palette.png" 
                  alt="Color Palette" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SAM2 Building Painter</h1>
                <p className="text-xs text-gray-500">AI-Powered Segmentation & Painting</p>
              </div>
            </div>

            {/* Auth Section */}
            <div className="flex items-center space-x-4">
              {isAuthLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-500">Loading...</span>
                </div>
              ) : isAuthenticated && user ? (
                <UserProfile user={user} onSignOut={handleSignOut} />
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-200/50 max-w-md w-full p-8 relative animate-fadeIn">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              onClick={() => setShowHelp(false)}
              title="Close"
            >
              <span className="text-lg">×</span>
            </button>
            <div className="flex items-start space-x-3 mb-2">
              <div className="w-5 h-5 bg-blue-500 rounded-full mt-0.5 flex-shrink-0"></div>
              <p className="font-semibold text-blue-800">How to use masks:</p>
            </div>
            <ul className="text-xs text-blue-800 space-y-2 pl-8 list-disc">
              <li>Hover over the preview image to see which mask covers that area</li>
              <li>Click on a mask thumbnail or preview area to select/deselect it</li>
              <li>left click on the main image to add to selection</li>
              <li>right click to remove from selection</li>
              <li>Selected masks will be colored when you paint</li>
              <li>Painted Result Image can be preview at the bottom of the page too</li>
            </ul>
          </div>
        </div>
      )}

      {/* Duplicate Status Notification */}
      <DuplicateNotification
        status={duplicateStatus}
        isVisible={showNewImagePopup}
        masksCount={masks.length}
        onGenerateMasks={() => handleGenerateMasksExplicit(false)}
        onFetchDuplicates={handleFetchDuplicates}
        onClose={handleNewImagePopupClose}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="xl:col-span-3 space-y-6 hidden lg:block">
            {/* Tools Panel */}
            <ClientOnly
              fallback={
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg"></div>
                    <h3 className="text-base font-bold text-gray-900">Tools</h3>
                  </div>
                  <div className="space-y-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div
                        key={i}
                        className="h-12 bg-gray-200 rounded-xl animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              }
            >
              <Toolbar
                onGenerateMasks={handleGenerateMasks}
                onGenerateAdvancedMasks={handleGenerateAdvancedMasks}
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
                isGeneratingAdvancedMasks={isGeneratingAdvancedMasks}
                showAllMasks={showAllMasks}
                onSave={handleSaveToStorage}
                canSave={!!(currentFile && masks.length > 0 && !hasSaved)}
                onFetch={handleFetchDuplicates}
              />
            </ClientOnly>
            
            {/* Color Palette */}
            <ClientOnly
              fallback={
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs">🎨</span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900">Color Palette</h3>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {Array.from({ length: 25 }, (_, i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-xl border-2 border-gray-300 shadow-sm bg-gray-200"
                      />
                    ))}
                  </div>
                </div>
              }
            >
              <ColorPalette
                colors={[
                  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF',
                  '#00FFFF', '#FF8000', '#8000FF', '#FF0080', '#0080FF',
                  '#80FF00', '#FF8000', '#800080', '#008080', '#FF4000',
                  '#4000FF', '#FF0040', '#40FF00', '#0040FF', '#FF4000',
                  '#400080', '#804000', '#408000', '#800040'
                ]}
                selectedColor={currentColor}
                onColorSelect={handleColorSelect}
              />
            </ClientOnly>
          </div>

          {/* Main Canvas Area */}
          <div className="xl:col-span-9">
            {!imageData ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-12"
              >
                <div className="text-center max-w-4xl mx-auto">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl overflow-hidden">
                    <img 
                      src="/color-palette.png" 
                      alt="Color Palette" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Welcome to SAM2 Building Painter
                  </h2>
                  <p className="text-gray-600 mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
                    {isAuthenticated ? (
                      <>Upload an image of an Indian house or building, and use AI-powered segmentation 
                      to automatically identify walls and other architectural elements. Then paint them 
                      with beautiful colors to create stunning visualizations. Your images are securely 
                      stored and duplicates are detected automatically.</>
                    ) : (
                      <>Sign in to upload images and use AI-powered segmentation to automatically 
                      identify walls and other architectural elements. Your images will be securely 
                      stored with intelligent duplicate detection.</>
                    )}
                  </p>
                  <UploadZone
                    onImageUpload={handleImageUploadWithAuth}
                    isLoading={isUploading}
                  />
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {/* Canvas */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                        <img 
                          src="/imgPrev.png" 
                          alt="Image Prev icon" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">
                        Image Preview
                      </h3>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {masks.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>{masks.length} masks</span>
                        </div>
                      )}
                      {selectedMasks.size > 0 && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>{selectedMasks.size} selected</span>
                        </div>
                      )}
                      {coloredMasks.length > 0 && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span>{coloredMasks.length} colored</span>
                        </div>
                      )}
                    </div>
                  </div>
                                     <div className="w-full relative">
                    <ClientOnly
                      fallback={
                        <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                              <div className="w-8 h-8 bg-gray-400 rounded-full animate-pulse"></div>
                            </div>
                            <p className="text-gray-500 font-medium">Loading canvas...</p>
                          </div>
                        </div>
                      }
                    >
                      <InteractiveCanvas
                        imageData={imageData}
                        masks={masks}
                        selectedMasks={selectedMasks}
                        coloredMasks={coloredMasks}
                        showAllMasks={showAllMasks}
                        hoveredMaskId={hoveredMaskId}
                        onMaskSelect={handleMaskSelect}
                        onPointClick={handlePointClick}
                        setHoveredMaskId={handleMaskHover}
                        sessionId={sessionId}
                        isClickToGenerateMode={isClickToGenerateMode}
                      />
                    </ClientOnly>
                  </div>
                </div>

                {/* Mask Gallery below Image Preview */}
                {masks.length > 0 && (
                  <ClientOnly
                    fallback={
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4 mt-6">
                        <div className="flex items-center space-x-2 mb-4">
                          <div className="w-6 h-6 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg"></div>
                          <h3 className="text-base font-bold text-gray-900">Mask Gallery</h3>
                        </div>
                        <div className="space-y-3">
                          {Array.from({ length: 4 }, (_, i) => (
                            <div
                              key={i}
                              className="h-24 bg-gray-200 rounded-xl animate-pulse"
                            />
                          ))}
                        </div>
                      </div>
                    }
                  >
                    <MaskGallery
                      masks={masks}
                      selectedMasks={selectedMasks}
                      hoveredMaskId={hoveredMaskId}
                      onMaskSelect={handleMaskSelect}
                      onMaskHover={handleMaskHover}
                    />
                  </ClientOnly>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 