import React from 'react';
import { motion } from 'framer-motion';

export const GlobalSkeleton = () => {
  return (
    <div className="min-h-screen bg-muted flex w-full overflow-hidden">
      {/* Sidebar Skeleton */}
      <div className="hidden lg:block w-64 bg-card border-r border-border h-full p-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded bg-muted animate-pulse" />
          <div className="w-24 h-6 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-muted animate-pulse" />
              <div className="w-32 h-4 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Header Skeleton */}
        <div className="h-16 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6">
          <div className="w-8 h-8 rounded bg-muted animate-pulse lg:hidden" />
          <div className="flex items-center gap-4 ml-auto">
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          </div>
        </div>

        {/* Content Skeleton */}
        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <div className="space-y-2">
            <div className="w-48 h-8 rounded bg-muted animate-pulse" />
            <div className="w-64 h-4 rounded bg-muted animate-pulse" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card h-32 rounded-xl border border-border p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="w-24 h-4 rounded bg-muted animate-pulse" />
                  <div className="w-8 h-8 rounded bg-muted animate-pulse" />
                </div>
                <div className="w-16 h-8 rounded bg-muted animate-pulse mt-auto" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-card h-64 rounded-xl border border-border col-span-2 p-5 animate-pulse" />
            <div className="bg-card h-64 rounded-xl border border-border col-span-1 p-5 animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  );
};
