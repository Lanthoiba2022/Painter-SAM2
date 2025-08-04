'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Wand2,
  Palette,
  Download,
  RotateCcw,
  Eye,
  EyeOff,
  Settings,
  Info,
  MousePointer,
} from 'lucide-react';
import { ToolbarProps } from '@/types';
import LoadingSpinner from './LoadingSpinner';

const Toolbar: React.FC<ToolbarProps> = ({
  onGenerateMasks,
  onPaintMasks,
  onDownloadImage,
  onReset,
  onToggleAllMasks,
  onToggleClickToGenerate,
  isGeneratingMasks,
  isPainting,
  isDownloading,
  hasImage,
  hasMasks,
  hasSelectedMasks,
  isClickToGenerateMode,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Tools</h3>
        <div className="flex items-center space-x-2">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Help"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Generate All Masks Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGenerateMasks}
          disabled={!hasImage || isGeneratingMasks}
          className={`
            w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all
            ${hasImage && !isGeneratingMasks
              ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-md hover:shadow-lg'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isGeneratingMasks ? (
            <LoadingSpinner size="sm" color="text-white" text="Generating..." />
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Generate All Masks</span>
            </>
          )}
        </motion.button>

        {/* Click to Generate Mask Toggle Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onToggleClickToGenerate}
          disabled={!hasImage}
          className={`
            w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all
            ${hasImage
              ? isClickToGenerateMode
                ? 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <MousePointer className="w-4 h-4" />
          <span>{isClickToGenerateMode ? 'Click Mode: ON' : 'Click to Generate Mask'}</span>
        </motion.button>

        {/* Paint Masks Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onPaintMasks}
          disabled={!hasSelectedMasks || isPainting}
          className={`
            w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all
            ${hasSelectedMasks && !isPainting
              ? 'bg-accent-500 text-white hover:bg-accent-600 shadow-md hover:shadow-lg'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isPainting ? (
            <LoadingSpinner size="sm" color="text-white" text="Painting..." />
          ) : (
            <>
              <Palette className="w-4 h-4" />
              <span>Paint Selected Areas</span>
            </>
          )}
        </motion.button>

        {/* Download Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onDownloadImage}
          disabled={isDownloading}
          className={`
            w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all
            ${!isDownloading
              ? 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {isDownloading ? (
            <LoadingSpinner size="sm" color="text-white" text="Downloading..." />
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download Result</span>
            </>
          )}
        </motion.button>

        {/* Divider */}
        <div className="border-t border-gray-200 my-4" />

        {/* Toggle All Masks Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onToggleAllMasks}
          disabled={!hasMasks}
          className={`
            w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
            ${hasMasks
              ? 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <Eye className="w-4 h-4" />
          <span>Toggle All Masks</span>
        </motion.button>

        {/* Reset Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onReset}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset All</span>
        </motion.button>
      </div>

      {/* Status Indicators */}
      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Image:</span>
          <span className={hasImage ? 'text-green-600' : 'text-red-600'}>
            {hasImage ? 'Loaded' : 'Not loaded'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Masks:</span>
          <span className={hasMasks ? 'text-green-600' : 'text-red-600'}>
            {hasMasks ? 'Generated' : 'Not generated'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Selection:</span>
          <span className={hasSelectedMasks ? 'text-green-600' : 'text-red-600'}>
            {hasSelectedMasks ? 'Active' : 'None'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Click Mode:</span>
          <span className={isClickToGenerateMode ? 'text-green-600' : 'text-gray-600'}>
            {isClickToGenerateMode ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Toolbar; 