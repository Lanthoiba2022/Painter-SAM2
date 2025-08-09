import { 
  generateSHA256, 
  getImageDimensions, 
  checkDuplicateImage, 
  saveImageMetadata, 
  uploadToStorage, 
  uploadMasksToStorage, 
  fetchExistingMasks,
  createUserStorageFolder 
} from './supabase-utils';
import { api } from './api';
import { MaskInfo } from '@/types';
import toast from 'react-hot-toast';

// Main upload workflow that handles duplicate detection but doesn't auto-generate masks
export async function handleImageUpload(
  file: File,
  userId: string,
  onDuplicateStatusChange: (status: 'checking' | 'duplicate' | 'new' | null) => void,
  onMasksLoaded: (masks: MaskInfo[]) => void,
  onImageDataSet: (imageData: string, width: number, height: number, filename: string) => void,
  onSessionIdSet: (sessionId: string) => void
): Promise<{
  isExistingImage: boolean;
  masks?: MaskInfo[];
  sessionId?: string;
  imageHash?: string;
}> {
  try {
    // 1. Set checking status
    onDuplicateStatusChange('checking');
    
    // 2. Generate SHA-256 hash from file
    console.log('Generating SHA-256 hash...');
    const fileHash = await generateSHA256(file);
    console.log('Generated hash:', fileHash);
    
    // 3. Check if hash exists in database
    console.log('Checking for duplicate image...');
    const existingImage = await checkDuplicateImage(fileHash, userId);
    
    if (existingImage) {
      // 3a. Duplicate found - return existing masks immediately
      console.log('Duplicate image found:', existingImage);
      onDuplicateStatusChange('duplicate');
      
      toast.success('Duplicate image detected! Loading existing masks...', {
        duration: 3000,
        icon: '⚡'
      });
      
      // Fetch existing masks from storage
      const existingMasks = await fetchExistingMasks(existingImage.masks_storage_path);
      
      if (existingMasks && existingMasks.length > 0) {
        // Create a session for the existing image workflow (needed for backend operations)
        const response = await api.uploadImage(file);
        onSessionIdSet(response.session_id);
        
        // Set image data from file reader
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = e.target?.result as string;
          onImageDataSet(imageData, existingImage.image_dimensions.width, existingImage.image_dimensions.height, existingImage.original_filename);
        };
        reader.readAsDataURL(file);
        
        // Load masks immediately
        onMasksLoaded(existingMasks);
        
        toast.success(`Loaded ${existingMasks.length} existing masks instantly!`);
        
        return {
          isExistingImage: true,
          masks: existingMasks,
          sessionId: response.session_id,
          imageHash: fileHash
        };
      } else {
        console.warn('No masks found for existing image, treating as new');
        onDuplicateStatusChange('new');
      }
    } else {
      // 3b. New image detected - show popup but don't auto-generate
      console.log('New image detected');
      onDuplicateStatusChange('new');
      
      toast('New image detected! Click "Generate Masks" to proceed.', {
        icon: '🆕',
        duration: 5000
      });
    }
    
    // 4. Upload original image to backend API (for processing when user chooses to generate masks)
    console.log('Uploading image to backend API...');
    const response = await api.uploadImage(file);
    
    // 5. Set session and image data (use FileReader to ensure valid data URL for UI)
    onSessionIdSet(response.session_id);

    await new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onImageDataSet(dataUrl, response.width, response.height, file.name);
        resolve();
      };
      reader.readAsDataURL(file);
    });
    
    // 6. Don't automatically generate masks - wait for user action
    console.log('Image ready for mask generation. Waiting for user action...');
    
    return {
      isExistingImage: false,
      sessionId: response.session_id,
      imageHash: fileHash
    };
    
  } catch (error) {
    console.error('Upload workflow error:', error);
    onDuplicateStatusChange(null);
    toast.error('Failed to process image');
    throw error;
  }
}

// Generate masks when user explicitly requests it
export async function generateMasksForImage(
  sessionId: string,
  file: File,
  userId: string,
  fileHash: string,
  shouldSave: boolean = false
): Promise<MaskInfo[]> {
  try {
    console.log('Generating masks for new image...');
    toast.loading('Generating segmentation masks...', { id: 'generate-masks' });
    
    // Generate masks using existing API
    const masksResponse = await api.generateMasks(sessionId, 32, 0.88, 0.95);
    const generatedMasks = masksResponse.masks;
    
    if (generatedMasks && generatedMasks.length > 0) {
      toast.success(`Generated ${generatedMasks.length} masks successfully!`, { id: 'generate-masks' });
      
      // Only save if user explicitly requested it
      if (shouldSave) {
        await saveMasksToStorage(file, userId, fileHash, generatedMasks);
      }
      
      return generatedMasks;
    } else {
      toast.error('Failed to generate masks', { id: 'generate-masks' });
      throw new Error('No masks generated');
    }
    
  } catch (error) {
    console.error('Mask generation error:', error);
    toast.error('Failed to generate masks', { id: 'generate-masks' });
    throw error;
  }
}

// Save masks to storage (called when user clicks save)
export async function saveMasksToStorage(
  file: File,
  userId: string,
  fileHash: string,
  masks: MaskInfo[]
): Promise<boolean> {
  try {
    console.log('Saving masks to storage...');
    toast.loading('Saving to your library...', { id: 'save-masks' });
    
    // 1. Get image dimensions for storage
    const dimensions = await getImageDimensions(file);
    
    // 2. Upload original image to Supabase Storage
    console.log('Uploading image to Supabase Storage...');
    const storagePath = await uploadToStorage(file, fileHash, userId);
    
    if (!storagePath) {
      console.error('Failed to upload image to storage');
      toast.error('Failed to save image', { id: 'save-masks' });
      return false;
    }
    
    // 3. Upload masks to Supabase Storage
    console.log('Uploading masks to Supabase Storage...');
    const masksPath = await uploadMasksToStorage(masks, fileHash, userId);
    
    if (!masksPath) {
      console.error('Failed to upload masks to storage');
      toast.error('Failed to save masks', { id: 'save-masks' });
      return false;
    }
    
    // 4. Save metadata to database
    console.log('Saving image metadata to database...');
    const savedMetadata = await saveImageMetadata({
      userId,
      filename: file.name,
      fileHash,
      storagePath,
      masksPath,
      fileSize: file.size,
      dimensions
    });
    
    if (savedMetadata) {
      console.log('Successfully saved image metadata:', savedMetadata);
      toast.success('Successfully saved to your library!', { id: 'save-masks' });
      return true;
    } else {
      console.warn('Failed to save image metadata');
      toast.error('Failed to save metadata', { id: 'save-masks' });
      return false;
    }
    
  } catch (error) {
    console.error('Save masks error:', error);
    toast.error('Failed to save masks', { id: 'save-masks' });
    return false;
  }
}

// Manually fetch duplicates (for the fetch button)
export async function fetchDuplicateImage(
  file: File,
  userId: string
): Promise<{
  isDuplicate: boolean;
  masks?: MaskInfo[];
  existingImage?: any;
}> {
  try {
    toast.loading('Checking for duplicates...', { id: 'fetch-duplicates' });
    
    // Generate hash and check for duplicates
    const fileHash = await generateSHA256(file);
    const existingImage = await checkDuplicateImage(fileHash, userId);
    
    if (existingImage) {
      // Fetch existing masks
      const existingMasks = await fetchExistingMasks(existingImage.masks_storage_path);
      
      toast.success(`Found duplicate with ${existingMasks?.length || 0} masks!`, { id: 'fetch-duplicates' });
      
      return {
        isDuplicate: true,
        masks: existingMasks || [],
        existingImage
      };
    } else {
      toast.success('No duplicates found - this is a new image', { id: 'fetch-duplicates' });
      return {
        isDuplicate: false
      };
    }
    
  } catch (error) {
    console.error('Fetch duplicates error:', error);
    toast.error('Failed to check for duplicates', { id: 'fetch-duplicates' });
    throw error;
  }
}

// Initialize user storage when they first sign up or log in
export async function initializeUserStorage(userId: string): Promise<void> {
  try {
    await createUserStorageFolder(userId);
    console.log('User storage initialized for:', userId);
  } catch (error) {
    console.error('Failed to initialize user storage:', error);
  }
} 