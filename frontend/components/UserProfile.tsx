'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface UserProfileProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
  onSignOut: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onSignOut }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      
      // Clear localStorage before signing out
      localStorage.removeItem('sam2-building-painter-store');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        toast.error('Error signing out');
        console.error('Sign out error:', error);
      } else {
        // Call the parent's onSignOut immediately to prevent loading state
        onSignOut();
        toast.success('Signed out successfully');
      }
    } catch (error) {
      toast.error('Error signing out');
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
      setIsDropdownOpen(false);
    }
  };

  const getDisplayName = () => {
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  const getInitials = () => {
    const name = getDisplayName();
    if (name.includes(' ')) {
      const parts = name.split(' ');
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-xs font-medium text-white">
            {getInitials()}
          </span>
        </div>
        
        {/* User Info */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-900 truncate max-w-32">
            {getDisplayName()}
          </p>
          <p className="text-xs text-gray-500 truncate max-w-32">
            {user.email}
          </p>
        </div>
        
        {/* Dropdown Arrow */}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
          isDropdownOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
          >
            {/* User Info Section */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {getInitials()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getDisplayName()}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {/* Profile Settings (placeholder for future) */}
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setIsDropdownOpen(false);
                  toast('Profile settings coming soon!', { icon: '⚙️' });
                }}
              >
                <Settings className="w-4 h-4 mr-3 text-gray-400" />
                Profile Settings
              </button>

              {/* Divider */}
              <div className="border-t border-gray-100 my-1" />

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 mr-3" />
                {isLoading ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default UserProfile; 