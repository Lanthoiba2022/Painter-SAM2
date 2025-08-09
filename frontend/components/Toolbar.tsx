'use client';

import React, { useState } from 'react';
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
  Sparkles,
  Layers,
  X,
} from 'lucide-react';
import { ToolbarProps } from '@/types';
import LoadingSpinner from './LoadingSpinner';

const Toolbar: React.FC<ToolbarProps> = ({
  onGenerateMasks,
  onGenerateAdvancedMasks,
  onPaintMasks,
  onDownloadImage,
  onReset,
  onToggleAllMasks,
  onToggleClickToGenerate,
  isGeneratingMasks,
  isGeneratingAdvancedMasks,
  isPainting,
  isDownloading,
  hasImage,
  hasMasks,
  hasSelectedMasks,
  isClickToGenerateMode,
  showAllMasks,
  onSave,
  canSave,
  onFetch,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Layers className="w-3 h-3 text-white" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Tools</h3>
        </div>
        <div className="flex items-center space-x-1">
          {/* <button
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 rounded-lg transition-all duration-200"
            title="Settings"
          >
            <Settings className="w-3 h-3" />
          </button> */}
          <button
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 rounded-lg transition-all duration-200"
            title="Help"
            onClick={() => setShowHelp(!showHelp)}
          >
            <Info className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Help Tooltip */}
      {showHelp && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-blue-50/80 border border-blue-200/50 rounded-xl relative"
        >
          <button
            onClick={() => setShowHelp(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3 h-3" />
          </button>
          <div className="text-xs text-blue-800 space-y-1">
            <p className="font-semibold mb-2">How to paint:</p>
            <ul className="space-y-1">
              <li className="flex items-start space-x-2">
                <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Select masks in Image</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Choose a color from the palette</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Click "Paint Selected Areas" to apply</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Download the final result</span>
              </li>
            </ul>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {/* Generate All Masks Button - COMMENTED OUT */}
        {/* 
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGenerateMasks}
          disabled={!hasImage || isGeneratingMasks || isGeneratingAdvancedMasks}
          className={`
            w-full flex items-center justify-center space-x-2 px-3 py-3 rounded-xl font-semibold transition-all duration-200 text-sm
            ${hasImage && !isGeneratingMasks && !isGeneratingAdvancedMasks
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isGeneratingMasks ? (
            <LoadingSpinner size="sm" color="text-white" text="Generating..." />
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate All Masks</span>
            </>
          )}
        </motion.button>
        */}

        {/* Generate Advanced Masks Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onGenerateAdvancedMasks}
          disabled={!hasImage || isGeneratingMasks || isGeneratingAdvancedMasks}
          className={`
            w-full flex items-center justify-center space-x-2 px-3 py-3 rounded-xl font-semibold transition-all duration-200 text-sm
            ${hasImage && !isGeneratingMasks && !isGeneratingAdvancedMasks
              ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isGeneratingAdvancedMasks ? (
            <LoadingSpinner size="sm" color="text-white" text="Generating..." />
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Masks</span>
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
            w-full flex items-center justify-center space-x-2 px-3 py-3 rounded-xl font-semibold transition-all duration-200 text-sm
            ${hasImage
              ? isClickToGenerateMode
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl'
                : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <MousePointer className="w-4 h-4" />
          <span>{isClickToGenerateMode ? 'Click Mode: ON' : 'Click to Generate'}</span>
        </motion.button>

        {/* Paint Masks Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onPaintMasks}
          disabled={!hasSelectedMasks || isPainting}
          className={`
            w-full flex items-center justify-center space-x-2 px-3 py-3 rounded-xl font-semibold transition-all duration-200 text-sm
            ${hasSelectedMasks && !isPainting
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
            w-full flex items-center justify-center space-x-2 px-3 py-3 rounded-xl font-semibold transition-all duration-200 text-sm
            ${!isDownloading
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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

        {/* Check + Save Row */}
        {(onFetch || (onSave && canSave)) && (
          <div className="flex items-center space-x-2">
            {onFetch && (
              <button
                onClick={onFetch}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Check
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={!canSave}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${canSave ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                Save
              </button>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200/50 my-4" />

        {/* Toggle All Masks Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onToggleAllMasks}
          disabled={!hasMasks}
          className={`
            w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200
            ${hasMasks
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
              : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100'
            }
          `}
        >
          {showAllMasks ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          <span>{showAllMasks ? 'Hide All Masks' : 'Show All Masks'}</span>
        </motion.button>

        {/* Reset Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onReset}
          className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-all duration-200"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset All</span>
        </motion.button>
      </div>

      {/* Status + Actions */}
      <div className="mt-4 p-3 bg-gray-50/50 rounded-xl border border-gray-200/50">
        <h4 className="text-xs font-semibold text-gray-700 mb-3">Status</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 font-medium">Image:</span>
            <div className={`flex items-center space-x-1 ${hasImage ? 'text-green-600' : 'text-red-600'}`}>
              <div className={`w-2 h-2 rounded-full ${hasImage ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs font-medium">{hasImage ? 'Loaded' : 'Not loaded'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 font-medium">Masks:</span>
            <div className={`flex items-center space-x-1 ${hasMasks ? 'text-green-600' : 'text-red-600'}`}>
              <div className={`w-2 h-2 rounded-full ${hasMasks ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs font-medium">{hasMasks ? 'Generated' : 'Not generated'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 font-medium">Selection:</span>
            <div className={`flex items-center space-x-1 ${hasSelectedMasks ? 'text-green-600' : 'text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${hasSelectedMasks ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-xs font-medium">{hasSelectedMasks ? 'Active' : 'None'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 font-medium">Click Mode:</span>
            <div className={`flex items-center space-x-1 ${isClickToGenerateMode ? 'text-green-600' : 'text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${isClickToGenerateMode ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-xs font-medium">{isClickToGenerateMode ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        </div>

        {/* Inline actions (optional) */}
        <div className="mt-3 space-y-2">
          {onSave && canSave && (
            <button
              onClick={onSave}
              className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Save to Library
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;