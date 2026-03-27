'use client';

import React, { useRef } from 'react';
import { UploadCloud, X, Trash2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { UploadedFileInfo, FileUploadProps } from '@/types/fileUpload';
import { useFileUpload } from '@/hooks/useFileUpload';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(type: string, previewUrl?: string): React.ReactNode {
  if (type.startsWith('image/') && previewUrl) {
    return <img src={previewUrl} alt="preview" className="h-8 w-8 rounded-sm object-cover" />;
  }
  if (type.startsWith('video/')) return <FileText className="h-8 w-8 text-blue-500" />;
  if (type.startsWith('image/')) return <FileText className="h-8 w-8 text-green-500" />;
  return <FileText className="h-8 w-8 text-gray-500" />;
}

export default function FileUpload({
  accept = 'image/*,video/*,application/pdf',
  maxFileSizeBytes = 20 * 1024 * 1024,
  maxFiles = 5,
  autoUpload = true,
  uploadEndpoint = '/api/upload',
  additionalFormData = {},
  headers = {},
  onFilesChanged,
  onUploadComplete,
  onError,
  className = '',
  dropzoneClassName = '',
  listClassName = '',
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    status,
    error,
    addFiles,
    removeFile,
    clearFiles,
    startUpload,
  } = useFileUpload({
    accept,
    maxFileSizeBytes,
    maxFiles,
    onError,
    onUploadComplete,
    uploadEndpoint,
    additionalFormData,
    headers,
    autoUpload,
    onFilesAdded: (filesAdded) => {
      const updated = [...files, ...filesAdded.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}`,
        name: f.name,
        size: f.size,
        type: f.type,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        progress: 0,
        status: 'idle' as const,
      }))];
      onFilesChanged?.(updated);
    },
  });

  const onSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    addFiles(event.target.files);
    event.target.value = '';
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.dataTransfer.files) return;
    addFiles(event.dataTransfer.files);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        className={`border-2 border-dashed border-gray-300 bg-white rounded-lg p-6 text-center transition-colors cursor-pointer ${dropzoneClassName}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        aria-label="File upload drop zone"
      >
        <UploadCloud className="mx-auto h-10 w-10 text-blue-500" />
        <p className="text-sm font-medium text-gray-700 mt-2">Drag & drop files here, or click to select files</p>
        <p className="text-xs text-gray-500">Allowed types: {accept}. Max file size: {formatBytes(maxFileSizeBytes)}.</p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={accept}
        multiple
        onChange={onSelectFiles}
      />

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className={`space-y-2 ${listClassName}`}>
        {files.map((file: UploadedFileInfo) => (
          <article key={file.id} className="flex items-center gap-3 border rounded-lg p-2 bg-gray-50">
            <span>{getFileIcon(file.type, file.previewUrl)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm text-gray-800 truncate">{file.name}</p>
                <button
                  onClick={() => removeFile(file.id)}
                  type="button"
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${file.progress}%` }} />
              </div>
              <p className="text-xs mt-1">Status: {file.status}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearFiles}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          aria-label="Clear selected files"
        >
          <Trash2 className="inline-block h-4 w-4 mr-1" /> Clear
        </button>
        <button
          type="button"
          onClick={startUpload}
          disabled={status === 'uploading' || files.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          aria-label="Start upload"
        >
          <span className="inline-flex items-center gap-1">
            <UploadCloud className="h-4 w-4" />
            {status === 'uploading' ? 'Uploading...' : 'Upload'}
          </span>
        </button>
      </div>

      {status === 'success' && (
        <div className="text-green-600 text-sm flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4" /> Upload complete
        </div>
      )}

      {status === 'error' && (
        <div className="text-red-600 text-sm flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" /> Upload failed
        </div>
      )}
    </div>
  );
}
