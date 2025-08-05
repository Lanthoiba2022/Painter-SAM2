// Utility functions for image processing and caching

/**
 * Generate a hash for image data to use as cache key
 * @param imageData - Base64 encoded image data
 * @returns A hash string for caching
 */
export const generateImageHash = (imageData: string): string => {
  // Simple hash function for image data
  let hash = 0;
  for (let i = 0; i < imageData.length; i++) {
    const char = imageData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
};

/**
 * Check if cached data is still valid (within 24 hours)
 * @param timestamp - Timestamp when data was cached
 * @returns True if cache is still valid
 */
export const isCacheValid = (timestamp: number): boolean => {
  const now = Date.now();
  const cacheAge = now - timestamp;
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  return cacheAge < maxAge;
};

/**
 * Compress image data for storage
 * @param imageData - Base64 encoded image data
 * @param maxSize - Maximum size in bytes
 * @returns Compressed image data
 */
export const compressImageData = async (imageData: string, maxSize: number = 1024 * 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(imageData);
        return;
      }
      
      // Calculate new dimensions to fit within maxSize
      let { width, height } = img;
      const aspectRatio = width / height;
      
      if (width * height > maxSize) {
        const scale = Math.sqrt(maxSize / (width * height));
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      resolve(compressedDataUrl);
    };
    
    img.onerror = () => {
      resolve(imageData); // Return original if compression fails
    };
    
    img.src = imageData;
  });
};

/**
 * Debounce function to limit API calls
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function to limit execution frequency
 * @param func - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Convert canvas coordinates to image coordinates
 * @param canvasX - X coordinate on canvas
 * @param canvasY - Y coordinate on canvas
 * @param canvasSize - Canvas dimensions
 * @param imageSize - Image dimensions
 * @returns Image coordinates
 */
export const canvasToImageCoords = (
  canvasX: number,
  canvasY: number,
  canvasSize: { width: number; height: number },
  imageSize: { width: number; height: number }
) => {
  const scale = Math.min(
    canvasSize.width / imageSize.width,
    canvasSize.height / imageSize.height
  );
  const offsetX = (canvasSize.width - imageSize.width * scale) / 2;
  const offsetY = (canvasSize.height - imageSize.height * scale) / 2;
  
  const imageX = (canvasX - offsetX) / scale;
  const imageY = (canvasY - offsetY) / scale;
  
  return {
    x: Math.round(imageX),
    y: Math.round(imageY)
  };
};

/**
 * Check if a point is within image bounds
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param width - Image width
 * @param height - Image height
 * @returns True if point is within bounds
 */
export const isPointInBounds = (
  x: number,
  y: number,
  width: number,
  height: number
): boolean => {
  return x >= 0 && x < width && y >= 0 && y < height;
};

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate unique colors for masks
 * @param index - Index for color selection
 * @returns Hex color string
 */
export const getUniqueColor = (index: number): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
    '#F1948A', '#85C1E9', '#FAD7A0', '#D7BDE2', '#A9DFBF', '#F9E79F',
    '#F5B7B1', '#AED6F1', '#ABEBC6', '#FDEBD0', '#E8DAEF', '#D5F4E6'
  ];
  return colors[index % colors.length];
};

/**
 * Validate image file
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes
 * @returns Validation result
 */
export const validateImageFile = (
  file: File,
  maxSize: number = 50 * 1024 * 1024
): { valid: boolean; error?: string } => {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${formatFileSize(maxSize)}`
    };
  }
  
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'File type not supported. Please use JPEG, PNG, BMP, or TIFF.'
    };
  }
  
  return { valid: true };
};

/**
 * Create a download link for a blob
 * @param blob - Blob to download
 * @param filename - Filename for download
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Convert base64 to blob
 * @param base64 - Base64 string
 * @param mimeType - MIME type
 * @returns Blob
 */
export const base64ToBlob = (base64: string, mimeType: string = 'image/png'): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}; 