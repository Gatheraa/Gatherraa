'use client';

import { useState, useCallback } from 'react';
import type { UploadedFileInfo, FileUploadOptions, UseFileUploadReturn } from '@/types/fileUpload';

const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const DEFAULT_MAX_FILES = 10;

const createPreview = (file: File): string => {
  if (file.type.startsWith('image/')) {
    return URL.createObjectURL(file);
  }
  return '';
};

const buildFileInfo = (file: File): UploadedFileInfo => ({
  id: `${file.name}-${file.size}-${Date.now()}`,
  name: file.name,
  size: file.size,
  type: file.type,
  previewUrl: createPreview(file),
  progress: 0,
  status: 'idle',
});

const uploadFile = async (
  fileInfo: UploadedFileInfo,
  file: File,
  options: FileUploadOptions,
  onProgress: (updated: UploadedFileInfo) => void
): Promise<UploadedFileInfo> => {
  const { uploadEndpoint = '/api/upload', additionalFormData = {}, headers = {} } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();

    form.append('file', file);
    Object.entries(additionalFormData).forEach(([key, value]) => form.append(key, value));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress({ ...fileInfo, progress, status: 'uploading' });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ...fileInfo, progress: 100, status: 'success' });
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.open('POST', uploadEndpoint);

    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));

    xhr.send(form);
  });
};

export function useFileUpload(options: FileUploadOptions = {}): UseFileUploadReturn {
  const {
    accept = '*/*',
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE,
    maxFiles = DEFAULT_MAX_FILES,
    onFilesAdded,
    onUploadProgress,
    onUploadComplete,
    onError,
    autoUpload = true,
  } = options;

  const [files, setFiles] = useState<UploadedFileInfo[]>([]);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileMap, setFileMap] = useState<Record<string, File>>({});

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const fileArray = Array.from(fileList);
      if (files.length + fileArray.length > maxFiles) {
        const msg = `Maximum ${maxFiles} files are allowed`;
        setError(msg);
        onError?.(msg);
        return;
      }

      const validFiles = fileArray.filter((file) => {
        if (accept !== '*/*' && !file.type.match(accept.replace(/\*/g, '.*'))) {
          onError?.(`Invalid file type: ${file.name}`, file);
          return false;
        }
        if (file.size > maxFileSizeBytes) {
          onError?.(`File is too large: ${file.name}`, file);
          return false;
        }
        return true;
      });

      const newFileInfos = validFiles.map((file) => buildFileInfo(file));
      const newFileMap = validFiles.reduce<Record<string, File>>((acc, file, index) => {
        const id = newFileInfos[index].id;
        acc[id] = file;
        return acc;
      }, {});

      const updatedFiles = [...files, ...newFileInfos];
      setFiles(updatedFiles);
      setFileMap((prev) => ({ ...prev, ...newFileMap }));
      onFilesAdded?.(validFiles);

      if (autoUpload && validFiles.length > 0) {
        void startUpload();
      }
    },
    [files, maxFiles, maxFileSizeBytes, accept, autoUpload, onError, onFilesAdded]
  );

  const removeFile = useCallback(
    (fileId: string) => {
      const updated = files.filter((f) => f.id !== fileId);
      setFiles(updated);
      setFileMap((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
    },
    [files]
  );

  const clearFiles = useCallback(() => {
    files.forEach((file) => {
      if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    });
    setFiles([]);
    setFileMap({});
    setStatus('idle');
    setError(null);
  }, [files]);

  const startUpload = useCallback(async () => {
    if (files.length === 0) {
      const msg = 'No files selected';
      setError(msg);
      onError?.(msg);
      return;
    }

    setStatus('uploading');
    setError(null);

    try {
      const updated: UploadedFileInfo[] = [];
      for (let i = 0; i < files.length; i++) {
        const fileInfo = files[i];
        const realFile = fileMap[fileInfo.id];

        if (!realFile) {
          throw new Error(`Cannot locate raw file data for ${fileInfo.name}`);
        }

        const progressHandler = (partial: UploadedFileInfo) => {
          setFiles((prevFiles) =>
            prevFiles.map((f) => (f.id === partial.id ? { ...f, progress: partial.progress, status: partial.status } : f))
          );
          onUploadProgress?.(partial);
        };

        const uploadedFile = await uploadFile(fileInfo, realFile, options, progressHandler);
        updated.push(uploadedFile);
      }

      setFiles(updated);
      setStatus('success');
      onUploadComplete?.(updated);
    } catch (err: any) {
      const msg = err?.message ?? 'Upload error';
      setError(msg);
      setStatus('error');
      onError?.(msg);
    }
  }, [files, onError, onUploadComplete, onUploadProgress, options]);

  return {
    files,
    status,
    error,
    addFiles,
    removeFile,
    clearFiles,
    startUpload,
    setError,
  };
}
