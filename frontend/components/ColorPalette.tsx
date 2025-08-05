'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ColorPaletteProps } from '@/types';
import { Palette } from 'lucide-react';

const defaultColors = [
  '#FF0000', // Bright Red
  '#00FF00', // Bright Green
  '#0000FF', // Bright Blue
  '#FFFF00', // Bright Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FF8000', // Orange
  '#8000FF', // Purple
  '#FF0080', // Pink
  '#0080FF', // Sky Blue
  '#80FF00', // Lime Green
  '#FF8000', // Dark Orange
  '#800080', // Dark Purple
  '#008080', // Teal
  '#FF4000', // Red Orange
  '#4000FF', // Indigo
  '#FF0040', // Hot Pink
  '#40FF00', // Bright Lime
  '#0040FF', // Royal Blue
  '#FF4000', // Coral
  '#400080', // Deep Purple
  '#804000', // Brown
  '#408000', // Forest Green
  '#800040', // Burgundy
];

const ColorPalette: React.FC<ColorPaletteProps> = ({
  colors = defaultColors,
  selectedColor,
  onColorSelect,
}) => {
  // Prevent hydration issues by ensuring consistent initial state
  const [mounted, setMounted] = useState(false);
  const [localSelectedColor, setLocalSelectedColor] = useState('#FF0000'); // Default color

  useEffect(() => {
    setMounted(true);
    setLocalSelectedColor(selectedColor);
  }, [selectedColor]);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Palette className="w-3 h-3 text-white" />
          </div>
          <h3 className="text-base font-bold text-gray-900">Color Palette</h3>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {colors.map((color, index) => (
            <div
              key={index}
              className="w-10 h-10 rounded-xl border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200/50 p-4">
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Palette className="w-3 h-3 text-white" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Color Palette</h3>
      </div>
      
      <div className="grid grid-cols-5 gap-2 mb-4">
        {colors.map((color, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`
              w-10 h-10 rounded-xl cursor-pointer border-2 transition-all duration-200 shadow-sm
              ${localSelectedColor === color 
                ? 'border-gray-800 shadow-lg scale-110 ring-2 ring-gray-200' 
                : 'border-gray-300 hover:border-gray-500 hover:shadow-md'
              }
            `}
            style={{ backgroundColor: color }}
            onClick={() => {
              setLocalSelectedColor(color);
              onColorSelect(color);
            }}
            title={`Select ${color}`}
          />
        ))}
      </div>
      
      <div className="space-y-3">
        <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-200/50">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Selected Color
          </label>
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-xl border-2 border-gray-300 shadow-sm"
              style={{ backgroundColor: localSelectedColor }}
            />
            <div>
              <span className="text-xs font-mono text-gray-600 font-medium">
                {localSelectedColor}
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-200/50">
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            Color Preview
          </label>
          <div className="w-full h-12 rounded-xl border border-gray-300 overflow-hidden shadow-sm">
            <div
              className="w-full h-full"
              style={{ backgroundColor: localSelectedColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPalette; 