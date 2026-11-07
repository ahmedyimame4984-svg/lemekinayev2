'use client';

import React, {
  DragEvent,
  useState,
  useImperativeHandle,
  forwardRef,
  useEffect,
} from 'react';
import { Upload, X, AlertCircle, Loader2 } from 'lucide-react';

export interface ImageUploadRef {
  resetUpload: () => void;
  getFile: () => File | null;
  hasFile: () => boolean;
}

interface ImageUploadProps {
  file: File | null;
  setFile: (file: File | null) => void;
  maxFileSize?: number; // in MB
  onFileSelected?: (file: File | null) => void;
  isUploading?: boolean;
  uploadProgress?: number;
  initialImageUrl?: string | null;
}

const ACCEPTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const ACCEPTED_FILE_TYPES_STRING = ACCEPTED_FILE_TYPES.join(',');

export const ImageUpload = forwardRef<ImageUploadRef, ImageUploadProps>(
  (
    {
      file,
      setFile,
      maxFileSize = 5,
      onFileSelected,
      isUploading = false,
      uploadProgress = 0,
      initialImageUrl = null,
    },
    ref,
  ) => {
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [initialImageCleared, setInitialImageCleared] = useState(false);

    useEffect(() => {
      if (file) {
        if (previewUrl && previewUrl !== initialImageUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        const newPreviewUrl = URL.createObjectURL(file);
        setPreviewUrl(newPreviewUrl);
        setInitialImageCleared(false);
      } else if (!file && initialImageUrl && !initialImageCleared) {
        setPreviewUrl(initialImageUrl);
      } else if (!file && (!initialImageUrl || initialImageCleared)) {
        setPreviewUrl(null);
      }
    }, [file, initialImageUrl, initialImageCleared]);

    const handleReset = () => {
      if (previewUrl && previewUrl !== initialImageUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setFile(null);
      setPreviewUrl(null);
      setError(null);
      setInitialImageCleared(true);
      onFileSelected?.(null);
    };

    const handleFileSelect = (selectedFile: File) => {
      if (selectedFile.size > maxFileSize * 1024 * 1024) {
        setError(`File size exceeds ${maxFileSize}MB limit`);
        return;
      }
      if (!ACCEPTED_FILE_TYPES.includes(selectedFile.type)) {
        setError('Invalid file type. Please upload JPEG, PNG, WEBP, or GIF');
        return;
      }
      setError(null);
      setFile(selectedFile);
      onFileSelected?.(selectedFile);
    };

    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    useImperativeHandle(ref, () => ({
      resetUpload: handleReset,
      getFile: () => file,
      hasFile: () => !!file || (!!initialImageUrl && !initialImageCleared),
    }));

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFileSelect(droppedFile);
    };
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFileSelect(selectedFile);
    };

    useEffect(() => {
      return () => {
        if (previewUrl && previewUrl !== initialImageUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, []);

    const displayImage = previewUrl;

    return (
      <div className="w-full">
        {!displayImage ? (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50 scale-[0.99]'
                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-gray-100'
            }`}
            onClick={() => document.getElementById('image-file-input')?.click()}
          >
            <input
              id="image-file-input"
              type="file"
              className="hidden"
              accept={ACCEPTED_FILE_TYPES_STRING}
              onChange={handleFileInputChange}
            />
            <div className="flex flex-col items-center gap-3">
              <div
                className={`p-4 rounded-full transition-all duration-200 ${
                  isDragging ? 'bg-blue-100 scale-110' : 'bg-gray-100'
                }`}
              >
                <Upload
                  className={`w-8 h-8 transition-all duration-200 ${
                    isDragging ? 'text-blue-600' : 'text-gray-500'
                  }`}
                />
              </div>
              <div>
                <p className="text-base font-medium text-gray-700">
                  {isDragging
                    ? 'Drop your image here'
                    : 'Drag & drop your image here'}
                </p>
                <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Maximum file size: {maxFileSize}MB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative group">
              <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                <img
                  src={displayImage}
                  alt="Preview"
                  className="w-full h-64 object-contain"
                />

                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 rounded-xl">
                    <div className="relative">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="4"
                          fill="none"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="white"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${
                            2 * Math.PI * 28 * (1 - uploadProgress / 100)
                          }`}
                          className="transition-all duration-300 ease-out"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      </div>
                    </div>
                    <p className="text-white text-sm font-medium">
                      Uploading {uploadProgress}%
                    </p>
                  </div>
                )}

                <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                  <button
                    onClick={handleReset}
                    type="button"
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-lg transition-all duration-200 hover:scale-105 z-20 cursor-pointer"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {file && (
                    <div className="bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg font-medium">
                      {formatFileSize(file.size)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>
    );
  },
);

ImageUpload.displayName = 'ImageUpload';
export default ImageUpload;
