'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'text-blue-500',
  text
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex items-center justify-center space-x-2">
      <motion.div
        className={`${sizeClasses[size]} rounded-lg overflow-hidden`}
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <img 
          src="/color-palette.png" 
          alt="Color Palette" 
          className="w-full h-full object-cover"
        />
      </motion.div>
      {text && (
        <span className="text-sm text-gray-600">{text}</span>
      )}
    </div>
  );
};

export default LoadingSpinner; 