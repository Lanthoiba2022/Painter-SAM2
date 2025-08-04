'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, CheckCircle, Layers, Info } from 'lucide-react';
import { MaskInfo } from '@/types';

interface MaskGalleryProps {
  masks: MaskInfo[];
  selectedMasks: Set<number>;
  hoveredMaskId: number | null;
  onMaskSelect: (maskId: number, isSelected: boolean) => void;
  onMaskHover?: (maskId: number | null) => void;
}

const MaskGallery: React.FC<MaskGalleryProps> = ({
  masks,
  selectedMasks,
  hoveredMaskId,
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
      className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-8"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            Generated Masks ({masks.length})
          </h3>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Info className="w-4 h-4" />
          <span>Click to select • Shift+click to combine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {masks.map((mask, index) => {
          const isSelected = selectedMasks.has(mask.id);
          const isHoveredFromImage = hoveredMaskId === mask.id;
          
          return (
            <motion.div
              key={mask.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative group cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50/50 shadow-lg ring-2 ring-blue-200' 
                  : isHoveredFromImage
                  ? 'border-cyan-500 bg-cyan-50/50 shadow-lg ring-2 ring-cyan-200'
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50/50 hover:shadow-md'
                }
              `}
              onClick={() => onMaskSelect(mask.id, !isSelected)}
              onMouseEnter={() => onMaskHover?.(mask.id)}
              onMouseLeave={() => onMaskHover?.(null)}
            >
              {/* Mask thumbnail */}
              <div className="relative w-full h-40 bg-gray-100 overflow-hidden">
                <img
                  src={`data:image/png;base64,${mask.mask}`}
                  alt={`Mask ${index + 1}`}
                  className="w-full h-full object-cover opacity-80"
                />
                
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="w-6 h-6 text-blue-600 bg-white rounded-full shadow-lg" />
                  </div>
                )}
                
                {/* Mask info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-xs p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">#{mask.id}</span>
                    {mask.score && (
                      <span className="text-green-400 font-semibold">
                        {Math.round(mask.score * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mask details */}
              <div className="p-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span className="font-medium">Mask {index + 1}</span>
                  {mask.area && (
                    <span className="text-gray-500 font-mono">
                      {Math.round(mask.area)}px²
                    </span>
                  )}
                </div>
                
                {/* Selection status */}
                <div className="flex items-center">
                  {isSelected ? (
                    <Eye className="w-4 h-4 text-blue-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="ml-2 text-xs text-gray-500 font-medium">
                    {isSelected ? 'Selected' : 'Click to select'}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Instructions */}
      <div className="mt-8 p-6 bg-blue-50/80 border border-blue-200/50 rounded-xl">
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 bg-blue-500 rounded-full mt-0.5 flex-shrink-0"></div>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-3">How to use masks:</p>
            <ul className="text-xs space-y-2">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Click on a mask thumbnail to select/deselect it</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Shift+click on the main image to add to selection</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Shift+right-click to remove from selection</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                <span>Selected masks will be colored when you paint</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MaskGallery; 