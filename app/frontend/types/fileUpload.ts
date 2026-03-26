/**
 * File Upload Type Definitions
 */

export type FileUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface UploadedFileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  progress: number;
  status: FileUploadStatus;
  error?: string;
}

export interface FileUploadOptions {
  accept?: string;
  maxFileSizeBytes?: number;
  maxFiles?: number;
  onFilesAdded?: (files: File[]) => void;
  onUploadProgress?: (file: UploadedFileInfo) => void;
  onUploadComplete?: (files: UploadedFileInfo[]) => void;
  onError?: (error: string, file?: File) => void;
  uploadEndpoint?: string;
  additionalFormData?: Record<string, string>;
  headers?: Record<string, string>;
  autoUpload?: boolean;
}

export interface UseFileUploadReturn {
  files: UploadedFileInfo[];
  status: FileUploadStatus;
  error: string | null;
  addFiles: (files: FileList | File[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  startUpload: () => Promise<void>;
  setError: (error: string) => void;
}

export interface FileUploadProps {
  accept?: string;
  maxFileSizeBytes?: number;
  maxFiles?: number;
  autoUpload?: boolean;
  uploadEndpoint: string;
  additionalFormData?: Record<string, string>;
  headers?: Record<string, string>;
  onFilesChanged?: (files: UploadedFileInfo[]) => void;
  onUploadComplete?: (files: UploadedFileInfo[]) => void;
  onError?: (error: string, file?: File) => void;
  className?: string;
  dropzoneClassName?: string;
  listClassName?: string;
}
