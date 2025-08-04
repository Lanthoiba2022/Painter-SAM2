'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { UploadZoneProps } from '@/types';
import LoadingSpinner from './LoadingSpinner';

const UploadZone: React.FC<UploadZoneProps> = ({ onImageUpload, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);
      setDragActive(false);

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError('File is too large. Maximum size is 50MB.');
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Invalid file type. Please upload an image (JPG, PNG, BMP, TIFF).');
        } else {
          setError('Failed to upload file. Please try again.');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        
        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          setError('File is too large. Maximum size is 50MB.');
          return;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff'];
        if (!allowedTypes.includes(file.type)) {
          setError('Invalid file type. Please upload an image (JPG, PNG, BMP, TIFF).');
          return;
        }

        onImageUpload(file);
      }
    },
    [onImageUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.bmp', '.tiff']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
    disabled: isLoading,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div
        {...getRootProps()}
        className={`
          upload-zone
          relative
          cursor-pointer
          transition-all
          duration-200
          ease-in-out
          ${isDragActive || dragActive ? 'dragover' : ''}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          {isLoading ? (
            <>
              <LoadingSpinner size="lg" color="text-primary-500" text="Processing image..." />
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full">
                {isDragActive ? (
                  <Upload className="w-8 h-8 text-primary-600" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-primary-600" />
                )}
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {isDragActive ? 'Drop your image here' : 'Upload an image'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Drag and drop an image file, or click to browse
                </p>
                <p className="text-xs text-gray-400">
                  Supported formats: JPG, PNG, BMP, TIFF (max 50MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </motion.div>
      )}

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          Upload a photo of an Indian house or building to get started
        </p>
      </div>
    </motion.div>
  );
};

export default UploadZone; 