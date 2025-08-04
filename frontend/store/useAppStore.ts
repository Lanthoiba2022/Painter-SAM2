import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, MaskInfo, ColoredMask } from '@/types';
import { api } from '@/lib/api';

interface AppStore extends AppState {
  // Additional state for hover functionality
  hoveredMaskId: number | null;
  isClickToGenerateMode: boolean;
  
  // Actions
  setSessionId: (sessionId: string) => void;
  setImageData: (imageData: string, width: number, height: number, filename: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setMasks: (masks: MaskInfo[]) => void;
  addMask: (mask: MaskInfo) => void;
  selectMask: (maskId: number, isSelected: boolean) => void;
  clearSelectedMasks: () => void;
  addColoredMask: (coloredMask: ColoredMask) => void;
  removeColoredMask: (index: number) => void;
  updateColoredMask: (index: number, coloredMask: Partial<ColoredMask>) => void;
  setCurrentColor: (color: string) => void;
  setCurrentOpacity: (opacity: number) => void;
  setShowAllMasks: (show: boolean) => void;
  setPaintedImage: (imageData: string | null) => void;
  setGeneratingMasks: (isGenerating: boolean) => void;
  setGeneratingAdvancedMasks: (isGenerating: boolean) => void;
  setPainting: (isPainting: boolean) => void;
  setDownloading: (isDownloading: boolean) => void;
  setHoveredMaskId: (maskId: number | null) => void;
  setClickToGenerateMode: (isActive: boolean) => void;
  reset: () => void;
  resetImage: () => void;
  resetMasks: () => void;
  resetColoredMasks: () => void;
  generateMaskAtPoint: (sessionId: string, point: [number, number]) => Promise<MaskInfo | null>;
}

const initialState: AppState = {
  sessionId: null,
  imageData: null,
  imageWidth: 0,
  imageHeight: 0,
  filename: null,
  isLoading: false,
  error: null,
  masks: [],
  selectedMasks: new Set(),
  coloredMasks: [],
  currentColor: '#FF0000',
  currentOpacity: 0.7,
  showAllMasks: false,
  paintedImage: null,
  isGeneratingMasks: false,
  isGeneratingAdvancedMasks: false,
  isPainting: false,
  isDownloading: false,
};

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      hoveredMaskId: null,
      isClickToGenerateMode: false,

      // Session management
      setSessionId: (sessionId: string) =>
        set({ sessionId }, false, 'setSessionId'),

      // Image management
      setImageData: (imageData: string, width: number, height: number, filename: string) =>
        set(
          {
            imageData,
            imageWidth: width,
            imageHeight: height,
            filename,
            error: null,
          },
          false,
          'setImageData'
        ),

      // Loading states
      setLoading: (isLoading: boolean) =>
        set({ isLoading }, false, 'setLoading'),

      setError: (error: string | null) =>
        set({ error }, false, 'setError'),

      // Mask management
      setMasks: (masks: MaskInfo[]) =>
        set({ masks }, false, 'setMasks'),

      addMask: (mask: MaskInfo) =>
        set(
          (state) => ({
            masks: [...state.masks, mask],
          }),
          false,
          'addMask'
        ),

      selectMask: (maskId: number, isSelected: boolean) =>
        set(
          (state) => {
            const newSelectedMasks = new Set(state.selectedMasks);
            if (isSelected) {
              newSelectedMasks.add(maskId);
            } else {
              newSelectedMasks.delete(maskId);
            }
            return { selectedMasks: newSelectedMasks };
          },
          false,
          'selectMask'
        ),

      clearSelectedMasks: () =>
        set({ selectedMasks: new Set() }, false, 'clearSelectedMasks'),

      // Colored mask management
      addColoredMask: (coloredMask: ColoredMask) =>
        set(
          (state) => {
            // Check if mask already exists and update it, otherwise add new
            const existingIndex = state.coloredMasks.findIndex(
              cm => cm.mask_id === coloredMask.mask_id
            );
            
            if (existingIndex >= 0) {
              // Update existing colored mask
              const updatedColoredMasks = [...state.coloredMasks];
              updatedColoredMasks[existingIndex] = coloredMask;
              return { coloredMasks: updatedColoredMasks };
            } else {
              // Add new colored mask
              return { coloredMasks: [...state.coloredMasks, coloredMask] };
            }
          },
          false,
          'addColoredMask'
        ),

      removeColoredMask: (index: number) =>
        set(
          (state) => ({
            coloredMasks: state.coloredMasks.filter((_, i) => i !== index),
          }),
          false,
          'removeColoredMask'
        ),

      updateColoredMask: (index: number, coloredMask: Partial<ColoredMask>) =>
        set(
          (state) => ({
            coloredMasks: state.coloredMasks.map((mask, i) =>
              i === index ? { ...mask, ...coloredMask } : mask
            ),
          }),
          false,
          'updateColoredMask'
        ),

      // Color and opacity management
      setCurrentColor: (color: string) =>
        set({ currentColor: color }, false, 'setCurrentColor'),

      setCurrentOpacity: (opacity: number) =>
        set({ currentOpacity: opacity }, false, 'setCurrentOpacity'),

      // UI state management
      setShowAllMasks: (show: boolean) =>
        set({ showAllMasks: show }, false, 'setShowAllMasks'),

      setPaintedImage: (imageData: string | null) =>
        set({ paintedImage: imageData }, false, 'setPaintedImage'),

      // Operation states
      setGeneratingMasks: (isGenerating: boolean) =>
        set({ isGeneratingMasks: isGenerating }, false, 'setGeneratingMasks'),

      setGeneratingAdvancedMasks: (isGenerating: boolean) =>
        set({ isGeneratingAdvancedMasks: isGenerating }, false, 'setGeneratingAdvancedMasks'),

      setPainting: (isPainting: boolean) =>
        set({ isPainting }, false, 'setPainting'),

      setDownloading: (isDownloading: boolean) =>
        set({ isDownloading }, false, 'setDownloading'),

      // Hover state management - optimized to reduce unnecessary re-renders
      setHoveredMaskId: (maskId: number | null) =>
        set((state) => {
          // Only update if the value has actually changed
          if (state.hoveredMaskId === maskId) {
            return state;
          }
          return { hoveredMaskId: maskId };
        }, false, 'setHoveredMaskId'),

      setClickToGenerateMode: (isActive: boolean) =>
        set({ isClickToGenerateMode: isActive }, false, 'setClickToGenerateMode'),

        // Generate mask at specific point
      generateMaskAtPoint: async (sessionId: string, point: [number, number]) => {
        try {
          const response = await api.generateMaskAtPoint(sessionId, point);
          const newMask: MaskInfo = {
            id: Date.now() + Math.random(), // Generate unique ID
            mask: response.mask,
            score: response.score,
            // Calculate area from mask if needed
            area: undefined,
          };
          
          set((state) => {
            // Add to masks array (don't clear existing masks)
            const updatedMasks = [...state.masks, newMask];
            
            // Auto-select the new mask
            const updatedSelectedMasks = new Set([newMask.id]);
            
            // Add to colored masks with current color and opacity
            const newColoredMask: ColoredMask = {
              mask_id: newMask.id,
              mask: newMask.mask,
              color: state.currentColor,
              opacity: state.currentOpacity,
            };
            
            const updatedColoredMasks = [...state.coloredMasks, newColoredMask];
            
            return {
              masks: updatedMasks,
              selectedMasks: updatedSelectedMasks,
              coloredMasks: updatedColoredMasks,
            };
          }, false, 'generateMaskAtPoint');
          
          return newMask;
        } catch (error) {
          console.error('Failed to generate mask at point:', error);
          // Don't throw the error, just log it and return null
          // This allows the UI to continue working even if mask generation fails
          return null;
        }
      },

      // Reset functions
      reset: () => set({ ...initialState, hoveredMaskId: null, isClickToGenerateMode: false }, false, 'reset'),

      resetImage: () =>
        set(
          {
            imageData: null,
            imageWidth: 0,
            imageHeight: 0,
            filename: null,
            masks: [], // Clear masks when image is reset
            selectedMasks: new Set(),
            coloredMasks: [], // Clear colored masks when image is reset
            paintedImage: null,
            error: null,
            hoveredMaskId: null,
            isClickToGenerateMode: false,
          },
          false,
          'resetImage'
        ),

      resetMasks: () =>
        set(
          {
            masks: [],
            selectedMasks: new Set(),
            // Don't clear coloredMasks - they should persist until session ends
            paintedImage: null,
            hoveredMaskId: null,
            isClickToGenerateMode: false,
          },
          false,
          'resetMasks'
        ),

      resetColoredMasks: () =>
        set(
          {
            coloredMasks: [],
            paintedImage: null,
          },
          false,
          'resetColoredMasks'
        ),
    }),
    {
      name: 'sam2-building-painter-store',
    }
  )
);

// Selectors for better performance
export const useSessionId = () => useAppStore((state) => state.sessionId);
export const useImageData = () => useAppStore((state) => state.imageData);
export const useImageDimensions = () =>
  useAppStore((state) => ({
    width: state.imageWidth,
    height: state.imageHeight,
  }));
export const useFilename = () => useAppStore((state) => state.filename);
export const useLoading = () => useAppStore((state) => state.isLoading);
export const useError = () => useAppStore((state) => state.error);
export const useMasks = () => useAppStore((state) => state.masks);
export const useSelectedMasks = () => useAppStore((state) => state.selectedMasks);
export const useColoredMasks = () => useAppStore((state) => state.coloredMasks);
export const useCurrentColor = () => useAppStore((state) => state.currentColor);
export const useCurrentOpacity = () => useAppStore((state) => state.currentOpacity);
export const useShowAllMasks = () => useAppStore((state) => state.showAllMasks);
export const usePaintedImage = () => useAppStore((state) => state.paintedImage);
export const useGeneratingMasks = () => useAppStore((state) => state.isGeneratingMasks);
export const useGeneratingAdvancedMasks = () => useAppStore((state) => state.isGeneratingAdvancedMasks);
export const usePainting = () => useAppStore((state) => state.isPainting);
export const useDownloading = () => useAppStore((state) => state.isDownloading);
export const useHoveredMaskId = () => useAppStore((state) => state.hoveredMaskId);
export const useClickToGenerateMode = () => useAppStore((state) => state.isClickToGenerateMode);

// Computed selectors
export const useHasImage = () => useAppStore((state) => !!state.imageData);
export const useHasMasks = () => useAppStore((state) => state.masks.length > 0);
export const useHasSelectedMasks = () => useAppStore((state) => state.selectedMasks.size > 0);
export const useHasColoredMasks = () => useAppStore((state) => state.coloredMasks.length > 0);
export const useSelectedMasksArray = () =>
  useAppStore((state) => Array.from(state.selectedMasks));
export const useSelectedMasksCount = () =>
  useAppStore((state) => state.selectedMasks.size);
export const useMasksCount = () => useAppStore((state) => state.masks.length);
export const useColoredMasksCount = () => useAppStore((state) => state.coloredMasks.length);

export default useAppStore;