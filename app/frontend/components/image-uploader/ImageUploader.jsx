import React, { useState, useRef } from "react";
import ImagePreview from "./ImagePreview";

const ImageUploader = ({ onUpload }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef();

  const handleFile = (selectedFile) => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) return;

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    uploadFile(selectedFile);
  };

  const uploadFile = async (file) => {
    if (!onUpload) {
      let value = 0;
      const interval = setInterval(() => {
        value += 10;
        setProgress(value);
        if (value >= 100) clearInterval(interval);
      }, 200);
    } else {
      await onUpload(file, setProgress);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Dropzone */}
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-300
          ${isDragging 
            ? "border-green-400 bg-green-900/20 scale-[1.02]" 
            : "border-gray-600 hover:border-green-500 hover:bg-gray-800/40"}
        `}
      >
        <p className="text-gray-300 text-sm">
          Drag & drop an image here, or{" "}
          <span className="text-green-400 font-semibold">click to upload</span>
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* Preview */}
      {preview && (
        <ImagePreview preview={preview} progress={progress} />
      )}
    </div>
  );
};

export default ImageUploader;