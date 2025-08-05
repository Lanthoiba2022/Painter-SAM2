import axios, { AxiosResponse } from 'axios';
import {
  UploadResponse,
  SegmentationResponse,
  GenerateMasksResponse,
  CombineMasksResponse,
  PaintMaskResponse,
  PaintMultipleMasksResponse,
  DownloadImageResponse,
  SessionInfoResponse,
  Point,
  BoundingBox,
  ColoredMask,
  ApiError,
} from '@/types';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout for long operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    // Handle CORS errors specifically
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      console.error('CORS Error: Make sure the backend server is running and CORS is properly configured');
    }
    
    return Promise.reject(error);
  }
);

// Enhanced API Functions with Embedding Caching
export const api = {
  // Health check
  health: async (): Promise<any> => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Upload image with embedding caching
  uploadImage: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 1 minute for upload
    });

    return response.data;
  },

  // Get image embedding (cached operation)
  getImageEmbedding: async (sessionId: string): Promise<{ embedding: string; cached: boolean }> => {
    try {
      const response = await apiClient.post('/get-embedding', { session_id: sessionId });
      return {
        embedding: response.data.embedding,
        cached: response.data.cached || false,
      };
    } catch (error) {
      console.error('Failed to get image embedding:', error);
      throw error;
    }
  },

  // Segment image with points
  segmentImage: async (
    sessionId: string,
    points: Point[],
    boxes?: BoundingBox[],
    mask?: string
  ): Promise<SegmentationResponse> => {
    const payload = {
      session_id: sessionId,
      points,
      boxes,
      mask,
    };

    const response = await apiClient.post('/segment', payload);
    return response.data;
  },

  // Generate all masks with embedding caching
  generateMasks: async (
    sessionId: string,
    pointsPerSide: number = 32,
    predIouThresh: number = 0.88,
    stabilityScoreThresh: number = 0.95
  ): Promise<GenerateMasksResponse> => {
    const payload = {
      session_id: sessionId,
      points_per_side: pointsPerSide,
      pred_iou_thresh: predIouThresh,
      stability_score_thresh: stabilityScoreThresh,
    };

    const response = await apiClient.post('/generate-masks', payload, {
      timeout: 300000, // 5 minutes for mask generation
    });

    return response.data;
  },

  // Generate masks with embedding caching (optimized version)
  generateMasksWithCache: async (
    sessionId: string,
    imageHash: string,
    pointsPerSide: number = 96,
    predIouThresh: number = 0.7,
    stabilityScoreThresh: number = 0.8
  ): Promise<GenerateMasksResponse & { cached: boolean }> => {
    const payload = {
      session_id: sessionId,
      image_hash: imageHash,
      points_per_side: pointsPerSide,
      pred_iou_thresh: predIouThresh,
      stability_score_thresh: stabilityScoreThresh,
    };

    const response = await apiClient.post('/generate-masks-cached', payload, {
      timeout: 300000, // 5 minutes for mask generation
    });

    return response.data;
  },

  // Get mask at point from pre-generated masks (optimized for instant response)
  getMaskAtPoint: async (
    sessionId: string,
    point: [number, number],
    allMasks: any[]
  ): Promise<SegmentationResponse> => {
    // Convert masks to the format expected by Modal backend
    const masksForModal = allMasks.map(mask => ({
      id: mask.id,
      mask: mask.mask,
      score: mask.score,
      bbox: mask.bbox,
      area: mask.area,
      stability_score: mask.stability_score
    }));

    const payload = {
      session_id: sessionId,
      point,
      all_masks: masksForModal,
    };

    const response = await apiClient.post('/get-mask-at-point', payload);
    return response.data;
  },

  // Get mask at point with instant cache lookup
  getMaskAtPointInstant: async (
    sessionId: string,
    point: [number, number],
    imageHash: string,
    allMasks: any[]
  ): Promise<SegmentationResponse & { cached: boolean }> => {
    const payload = {
      session_id: sessionId,
      point,
      image_hash: imageHash,
      all_masks: allMasks,
    };

    const response = await apiClient.post('/get-mask-at-point-instant', payload);
    return response.data;
  },

  // Generate mask for specific point (without generating all masks)
  generateMaskAtPoint: async (
    sessionId: string,
    point: [number, number]
  ): Promise<SegmentationResponse> => {
    const payload = {
      session_id: sessionId,
      point: point
    };

    const response = await apiClient.post('/generate-mask-at-point', payload, {
      timeout: 60000, // 1 minute for single mask generation
    });
    return response.data;
  },

  // Generate mask at point with embedding cache
  generateMaskAtPointWithCache: async (
    sessionId: string,
    point: [number, number],
    imageHash: string
  ): Promise<SegmentationResponse & { cached: boolean }> => {
    const payload = {
      session_id: sessionId,
      point: point,
      image_hash: imageHash
    };

    const response = await apiClient.post('/generate-mask-at-point-cached', payload, {
      timeout: 60000, // 1 minute for single mask generation
    });
    return response.data;
  },

  // Combine masks
  combineMasks: async (
    sessionId: string,
    maskIds: number[]
  ): Promise<CombineMasksResponse> => {
    const payload = {
      session_id: sessionId,
      mask_ids: maskIds,
    };

    const response = await apiClient.post('/combine-masks', payload);
    return response.data;
  },

  // Paint single mask
  paintMask: async (
    sessionId: string,
    maskId: number | null,
    mask: string | null,
    color: string,
    opacity: number = 0.7
  ): Promise<PaintMaskResponse> => {
    const payload = {
      session_id: sessionId,
      mask_id: maskId,
      mask,
      color,
      opacity,
    };

    const response = await apiClient.post('/paint-mask', payload);
    return response.data;
  },

  // Paint multiple masks
  paintMultipleMasks: async (
    sessionId: string,
    coloredMasks: ColoredMask[]
  ): Promise<PaintMultipleMasksResponse> => {
    const payload = {
      session_id: sessionId,
      colored_masks: coloredMasks,
    };

    const response = await apiClient.post('/paint-multiple-masks', payload);
    return response.data;
  },

  // Download original image
  downloadImage: async (
    sessionId: string,
    format: string = 'PNG',
    quality: number = 95
  ): Promise<DownloadImageResponse> => {
    const payload = {
      session_id: sessionId,
      format,
      quality,
    };

    const response = await apiClient.post('/download-image', payload);
    return response.data;
  },

  // Download painted image
  downloadPaintedImage: async (
    sessionId: string,
    maskId: number | null,
    mask: string | null,
    color: string = '#FF0000',
    opacity: number = 0.7,
    format: string = 'PNG',
    quality: number = 95
  ): Promise<DownloadImageResponse> => {
    const payload = {
      session_id: sessionId,
      mask_id: maskId,
      mask,
      color,
      opacity,
      format,
      quality,
    };

    const response = await apiClient.post('/download-painted-image', payload);
    return response.data;
  },

  // Get session info
  getSessionInfo: async (sessionId: string): Promise<SessionInfoResponse> => {
    const response = await apiClient.get(`/session/${sessionId}`);
    return response.data;
  },

  // Delete session
  deleteSession: async (sessionId: string): Promise<any> => {
    const response = await apiClient.delete(`/session/${sessionId}`);
    return response.data;
  },

  // List downloads
  listDownloads: async (): Promise<any> => {
    const response = await apiClient.get('/list-downloads');
    return response.data;
  },

  // Download file
  downloadFile: async (filename: string): Promise<Blob> => {
    const response = await apiClient.get(`/download-file/${filename}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Cache management
  clearCache: async (): Promise<any> => {
    const response = await apiClient.post('/clear-cache');
    return response.data;
  },

  // Get cache status
  getCacheStatus: async (): Promise<any> => {
    const response = await apiClient.get('/cache-status');
    return response.data;
  },
};

// Utility functions
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadFromUrl = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Error handling utilities
export const handleApiError = (error: any): string => {
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export const isNetworkError = (error: any): boolean => {
  return !error.response && error.request;
};

export const isServerError = (error: any): boolean => {
  return error.response?.status >= 500;
};

export const isClientError = (error: any): boolean => {
  return error.response?.status >= 400 && error.response?.status < 500;
};

export default api; 