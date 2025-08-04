'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ColorPaletteProps } from '@/types';
import { Palette } from 'lucide-react';

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
              ${selectedColor === color 
                ? 'border-gray-800 shadow-lg scale-110 ring-2 ring-gray-200' 
                : 'border-gray-300 hover:border-gray-500 hover:shadow-md'
              }
            `}
            style={{ backgroundColor: color }}
            onClick={() => onColorSelect(color)}
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
              style={{ backgroundColor: selectedColor }}
            />
            <div>
              <span className="text-xs font-mono text-gray-600 font-medium">
                {selectedColor}
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
              style={{ backgroundColor: selectedColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorPalette; 