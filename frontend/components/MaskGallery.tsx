'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { MaskInfo } from '@/types';

interface MaskGalleryProps {
  masks: MaskInfo[];
  selectedMasks: Set<number>;
  onMaskSelect: (maskId: number, isSelected: boolean) => void;
  onMaskHover?: (maskId: number | null) => void;
}

const MaskGallery: React.FC<MaskGalleryProps> = ({
  masks,
  selectedMasks,
  onMaskSelect,
  onMaskHover,
}) => {
  if (masks.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-gray-200 p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Generated Masks ({masks.length})
        </h3>
        <div className="text-sm text-gray-500">
          Click to select • Shift+click to combine
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {masks.map((mask, index) => {
          const isSelected = selectedMasks.has(mask.id);
          
          return (
            <motion.div
              key={mask.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative group cursor-pointer rounded-lg border-2 transition-all duration-200
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                }
              `}
              onClick={() => onMaskSelect(mask.id, !isSelected)}
              onMouseEnter={() => onMaskHover?.(mask.id)}
              onMouseLeave={() => onMaskHover?.(null)}
            >
              {/* Mask thumbnail */}
              <div className="relative w-full h-24 bg-gray-100 rounded-t-lg overflow-hidden">
                <img
                  src={`data:image/png;base64,${mask.mask}`}
                  alt={`Mask ${index + 1}`}
                  className="w-full h-full object-cover opacity-80"
                />
                
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="w-5 h-5 text-blue-600 bg-white rounded-full" />
                  </div>
                )}
                
                {/* Mask info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1">
                  <div className="flex items-center justify-between">
                    <span>#{mask.id}</span>
                    {mask.score && (
                      <span className="text-green-400">
                        {Math.round(mask.score * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mask details */}
              <div className="p-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Mask {index + 1}</span>
                  {mask.area && (
                    <span className="text-gray-500">
                      {Math.round(mask.area)}px²
                    </span>
                  )}
                </div>
                
                {/* Selection status */}
                <div className="flex items-center mt-1">
                  {isSelected ? (
                    <Eye className="w-3 h-3 text-blue-600" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-gray-400" />
                  )}
                  <span className="ml-1 text-xs text-gray-500">
                    {isSelected ? 'Selected' : 'Click to select'}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full mt-0.5"></div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How to use masks:</p>
            <ul className="text-xs space-y-1">
              <li>• Click on a mask thumbnail to select/deselect it</li>
              <li>• Shift+click on the main image to add to selection</li>
              <li>• Shift+right-click to remove from selection</li>
              <li>• Selected masks will be colored when you paint</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MaskGallery; 