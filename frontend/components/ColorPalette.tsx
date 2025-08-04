'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ColorPaletteProps } from '@/types';

const defaultColors = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Sky Blue
  '#F8C471', // Orange
  '#82E0AA', // Light Green
  '#F1948A', // Salmon
  '#85C1E9', // Light Blue
  '#FAD7A0', // Peach
  '#D7BDE2', // Lavender
  '#A9DFBF', // Mint Green
  '#F9E79F', // Light Yellow
  '#F5B7B1', // Pink
  '#AED6F1', // Baby Blue
  '#ABEBC6', // Light Mint
  '#FDEBD0', // Cream
  '#E8DAEF', // Light Purple
  '#D5F4E6', // Very Light Green
];

const ColorPalette: React.FC<ColorPaletteProps> = ({
  colors = defaultColors,
  selectedColor,
  onColorSelect,
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Color Palette</h3>
      
      <div className="grid grid-cols-6 gap-2 mb-4">
        {colors.map((color, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`
              w-8 h-8 rounded-lg cursor-pointer border-2 transition-all duration-200
              ${selectedColor === color 
                ? 'border-gray-800 shadow-lg scale-110' 
                : 'border-gray-300 hover:border-gray-500'
              }
            `}
            style={{ backgroundColor: color }}
            onClick={() => onColorSelect(color)}
            title={`Select ${color}`}
          />
        ))}
      </div>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Selected Color
          </label>
          <div className="flex items-center space-x-3">
            <div
              className="w-8 h-8 rounded-lg border-2 border-gray-300"
              style={{ backgroundColor: selectedColor }}
            />
            <span className="text-sm font-mono text-gray-600">
              {selectedColor}
            </span>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Preview
          </label>
          <div className="w-full h-12 rounded-lg border border-gray-300 overflow-hidden">
            <div
              className="w-full h-full"
              style={{ backgroundColor: selectedColor }}
            />
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full mt-0.5"></div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How to paint:</p>
            <ul className="text-xs space-y-1">
              <li>• Select masks from the gallery below</li>
              <li>• Choose a color from this palette</li>
              <li>• Click "Paint Selected Areas" to apply</li>
              <li>• Download the final result</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPalette; 