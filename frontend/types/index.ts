// API Types
export interface Point {
  x: number;
  y: number;
  label: number; // 1 for foreground, 0 for background
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MaskInfo {
  id: number;
  mask: string; // base64 encoded mask
  score?: number;
  bbox?: number[];
  area?: number;
  stability_score?: number;
}

export interface ColoredMask {
  mask_id?: number;
  mask?: string; // base64 encoded mask
  color: string; // hex color
  opacity: number;
}

// API Response Types
export interface UploadResponse {
  session_id: string;
  image_data: string; // base64 encoded image
  width: number;
  height: number;
  message: string;
}

export interface SegmentationResponse {
  session_id: string;
  mask: string; // base64 encoded mask
  score?: number;
  bbox?: number[];
}

export interface GenerateMasksResponse {
  session_id: string;
  masks: MaskInfo[];
  total_masks: number;
  width: number;
  height: number;
}

export interface CombineMasksResponse {
  session_id: string;
  combined_mask: string;
  width: number;
  height: number;
  num_masks_combined: number;
}

export interface PaintMaskResponse {
  session_id: string;
  painted_image: string; // base64 encoded image
  width: number;
  height: number;
}

export interface PaintMultipleMasksResponse {
  session_id: string;
  painted_image: string; // base64 encoded image
  width: number;
  height: number;
  num_masks_painted: number;
}

export interface DownloadImageResponse {
  session_id: string;
  image_url: string;
  format: string;
  size_bytes: number;
  message: string;
}

export interface SessionInfoResponse {
  session_id: string;
  filename: string;
  width: number;
  height: number;
  created_at: string;
  stored_masks: number;
  message: string;
}

// Application State Types
export interface AppState {
  sessionId: string | null;
  imageData: string | null;
  imageWidth: number;
  imageHeight: number;
  filename: string | null;
  isLoading: boolean;
  error: string | null;
  masks: MaskInfo[];
  selectedMasks: Set<number>;
  coloredMasks: ColoredMask[];
  currentColor: string;
  currentOpacity: number;
  showAllMasks: boolean;
  paintedImage: string | null;
  isGeneratingMasks: boolean;
  isPainting: boolean;
  isDownloading: boolean;
}

// UI Component Types
export interface ColorPaletteProps {
  colors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

export interface CanvasProps {
  imageData: string;
  masks: MaskInfo[];
  selectedMasks: Set<number>;
  coloredMasks: ColoredMask[];
  showAllMasks: boolean;
  onMaskSelect: (maskId: number, isSelected: boolean) => void;
  onPointClick: (x: number, y: number, isShiftClick?: boolean, isRightClick?: boolean) => void;
  sessionId?: string | null;
  isClickToGenerateMode?: boolean;
}

export interface MaskGalleryProps {
  masks: MaskInfo[];
  selectedMasks: Set<number>;
  onMaskSelect: (maskId: number, isSelected: boolean) => void;
  onMaskHover?: (maskId: number | null) => void;
}

export interface ToolbarProps {
  onGenerateMasks: () => void;
  onPaintMasks: () => void;
  onDownloadImage: () => void;
  onReset: () => void;
  onToggleAllMasks: () => void;
  onToggleClickToGenerate: () => void;
  isGeneratingMasks: boolean;
  isPainting: boolean;
  isDownloading: boolean;
  hasImage: boolean;
  hasMasks: boolean;
  hasSelectedMasks: boolean;
  isClickToGenerateMode: boolean;
}

export interface UploadZoneProps {
  onImageUpload: (file: File) => void;
  isLoading: boolean;
}

// Utility Types
export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ClickPoint {
  x: number;
  y: number;
}

export interface MaskOverlay {
  id: number;
  mask: string;
  color: string;
  opacity: number;
  visible: boolean;
}

// Error Types
export interface ApiError {
  error: string;
  detail?: string;
}

// Configuration Types
export interface AppConfig {
  apiBaseUrl: string;
  maxFileSize: number; // in bytes
  allowedFileTypes: string[];
  defaultColors: string[];
  defaultOpacity: number;
  maxImageDimension: number;
}

// Event Types
export interface MaskSelectionEvent {
  maskId: number;
  isSelected: boolean;
  isMultiSelect: boolean;
}

export interface ColorChangeEvent {
  color: string;
  opacity: number;
}

export interface ImageUploadEvent {
  file: File;
  imageData: string;
  dimensions: ImageDimensions;
} 