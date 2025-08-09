import { supabase, UserImage, TABLES, STORAGE_BUCKETS } from './supabase'
import { MaskInfo } from '@/types'

// Generate SHA-256 hash from file
export async function generateSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

// Get image dimensions from file
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// Check if image hash already exists for user
export async function checkDuplicateImage(fileHash: string, userId: string): Promise<UserImage | null> {
  try {
    const { data, error } = await supabase
      .from(TABLES.USER_IMAGES)
      .select('*')
      .eq('file_hash', fileHash)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error checking duplicate image:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error checking duplicate image:', error)
    return null
  }
}

// Save image metadata to database
export async function saveImageMetadata(data: {
  userId: string
  filename: string
  fileHash: string
  storagePath: string
  masksPath: string
  fileSize: number
  dimensions: { width: number; height: number }
}): Promise<UserImage | null> {
  try {
    const { data: result, error } = await supabase
      .from(TABLES.USER_IMAGES)
      .insert({
        user_id: data.userId,
        original_filename: data.filename,
        file_hash: data.fileHash,
        storage_path: data.storagePath,
        masks_storage_path: data.masksPath,
        file_size: data.fileSize,
        image_dimensions: data.dimensions
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving image metadata:', error)
      return null
    }

    return result
  } catch (error) {
    console.error('Error saving image metadata:', error)
    return null
  }
}

// Upload original image to Supabase Storage
export async function uploadToStorage(file: File, hash: string, userId: string): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${hash}.${fileExt}`
    const filePath = `${userId}/originals/${fileName}`

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.USER_IMAGES)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Error uploading file:', error)
      return null
    }

    return data.path
  } catch (error) {
    console.error('Error uploading file:', error)
    return null
  }
}

// Upload masks to Supabase Storage
export async function uploadMasksToStorage(
  masks: MaskInfo[], 
  hash: string, 
  userId: string
): Promise<string | null> {
  try {
    const masksFolder = `${userId}/masks/${hash}`
    const uploadPromises = masks.map(async (mask, index) => {
      // Convert base64 mask to blob
      const maskData = mask.mask.replace(/^data:image\/[a-z]+;base64,/, '')
      const binaryString = atob(maskData)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: 'image/png' })
      
      const fileName = `mask_${index + 1}.png`
      const filePath = `${masksFolder}/${fileName}`

      const { error } = await supabase.storage
        .from(STORAGE_BUCKETS.USER_IMAGES)
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error(`Error uploading mask ${index + 1}:`, error)
        return null
      }

      return filePath
    })

    const results = await Promise.all(uploadPromises)
    
    // Return the folder path if all uploads were successful
    if (results.every(result => result !== null)) {
      return masksFolder
    }

    return null
  } catch (error) {
    console.error('Error uploading masks:', error)
    return null
  }
}

// Fetch existing masks from storage
export async function fetchExistingMasks(masksPath: string): Promise<MaskInfo[] | null> {
  try {
    let allFiles: any[] = [];
    let offset = 0;
    const limit = 1000; // Increased limit to get more files per request
    
    // Fetch all files using pagination
    while (true) {
      const { data: files, error } = await supabase.storage
        .from(STORAGE_BUCKETS.USER_IMAGES)
        .list(masksPath, {
          limit: limit,
          offset: offset,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        console.error('Error listing mask files:', error);
        return null;
      }

      if (!files || files.length === 0) {
        break; // No more files to fetch
      }

      allFiles = allFiles.concat(files);
      
      // If we got fewer files than the limit, we've reached the end
      if (files.length < limit) {
        break;
      }
      
      offset += limit;
    }

    console.log(`Found ${allFiles.length} mask files in storage`);

    // Filter out non-mask files and sort by name to ensure correct order
    const maskFiles = allFiles
      .filter(file => file.name.startsWith('mask_') && file.name.endsWith('.png'))
      .sort((a, b) => {
        // Extract mask number from filename (e.g., "mask_1.png" -> 1)
        const aNum = parseInt(a.name.replace('mask_', '').replace('.png', ''));
        const bNum = parseInt(b.name.replace('mask_', '').replace('.png', ''));
        return aNum - bNum;
      });

    console.log(`Processing ${maskFiles.length} mask files`);

    const maskPromises = maskFiles.map(async (file, index) => {
      const filePath = `${masksPath}/${file.name}`;
      const { data: blob } = await supabase.storage
        .from(STORAGE_BUCKETS.USER_IMAGES)
        .download(filePath);

      if (!blob) {
        console.warn(`Failed to download mask file: ${filePath}`);
        return null;
      }

      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
      const base64 = btoa(binaryString);

      // Extract mask ID from filename (e.g., "mask_1.png" -> 1)
      const maskId = parseInt(file.name.replace('mask_', '').replace('.png', ''));

      return {
        id: maskId || index + 1, // Use extracted ID or fallback to index
        mask: base64, // Return just the base64 string, not the data URL
        score: 0.9, // Default score for cached masks
        area: undefined
      } as MaskInfo;
    });

    const masks = await Promise.all(maskPromises);
    const validMasks = masks.filter(mask => mask !== null) as MaskInfo[];
    
    console.log(`Successfully loaded ${validMasks.length} masks`);
    return validMasks;
  } catch (error) {
    console.error('Error fetching existing masks:', error);
    return null;
  }
}

// Get user's image history
export async function fetchUserImages(userId: string): Promise<UserImage[]> {
  try {
    const { data, error } = await supabase
      .from(TABLES.USER_IMAGES)
      .select('*')
      .eq('user_id', userId)
      .order('upload_timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching user images:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching user images:', error)
    return []
  }
}

// Initialize user storage folder
export async function createUserStorageFolder(userId: string): Promise<void> {
  try {
    // Create placeholder files to ensure folders exist
    const placeholderContent = new Blob([''], { type: 'text/plain' })
    
    await Promise.all([
      supabase.storage
        .from(STORAGE_BUCKETS.USER_IMAGES)
        .upload(`${userId}/originals/.placeholder`, placeholderContent, { upsert: true }),
      supabase.storage
        .from(STORAGE_BUCKETS.USER_IMAGES)
        .upload(`${userId}/masks/.placeholder`, placeholderContent, { upsert: true })
    ])
  } catch (error) {
    console.error('Error creating user storage folders:', error)
  }
} 