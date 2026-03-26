import React from "react";

const ImagePreview = ({ preview, progress }) => {
  return (
    <div className="mt-6 space-y-3">
      {/* Image */}
      <div className="relative rounded-xl overflow-hidden border border-gray-700">
        <img
          src={preview}
          alt="preview"
          className="w-full h-64 object-cover"
        />
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Percentage */}
      <p className="text-xs text-gray-400 text-right">
        {progress}%
      </p>
    </div>
  );
};

export default ImagePreview;