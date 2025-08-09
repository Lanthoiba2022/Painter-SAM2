'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, X, Sparkles, RefreshCw } from 'lucide-react';

interface DuplicateNotificationProps {
  status: 'checking' | 'duplicate' | 'new' | null;
  onGenerateMasks?: () => void;
  onFetchDuplicates?: () => void;
  onClose?: () => void;
  isVisible?: boolean;
  masksCount?: number;
}

const DuplicateNotification: React.FC<DuplicateNotificationProps> = ({
  status,
  onGenerateMasks,
  onFetchDuplicates,
  onClose,
  isVisible = false,
  masksCount = 0
}) => {
  if (!status && !isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 max-w-md w-full mx-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {status === 'checking' && (
              <>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Checking for Duplicates</h3>
                  <p className="text-sm text-gray-500">Scanning your image library...</p>
                </div>
              </>
            )}
            {status === 'duplicate' && (
              <>
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Duplicate Image Found!</h3>
                  <p className="text-sm text-gray-500">
                    Found {masksCount} existing masks for this image
                  </p>
                </div>
              </>
            )}
            {status === 'new' && (
              <>
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">New Image Detected</h3>
                  <p className="text-sm text-gray-500">This image hasn't been processed before</p>
                </div>
              </>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mb-6">
          {status === 'checking' && (
            <p className="text-gray-600">
              Please wait while we check if this image has been processed before...
            </p>
          )}
          {status === 'duplicate' && (
            <p className="text-gray-600">
              Great! We found this image in your library. Your existing masks have been loaded automatically.
            </p>
          )}
          {status === 'new' && (
            <div className="space-y-3">
              <p className="text-gray-600">
                This is a new image that hasn't been processed before. Would you like to generate masks for it?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  <strong>Note:</strong> Mask generation is compute-intensive and may take a few minutes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {status === 'new' && (
          <div className="flex space-x-3">
            <button
              onClick={onGenerateMasks}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Generate Masks
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {status === 'duplicate' && onFetchDuplicates && (
          <div className="flex space-x-3">
            <button
              onClick={onFetchDuplicates}
              className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Refresh Duplicates
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {status === 'checking' && (
          <div className="flex justify-center">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default DuplicateNotification; 