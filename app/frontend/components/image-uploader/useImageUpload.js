import { useState } from "react";

const useImageUpload = () => {
  const [progress, setProgress] = useState(0);

  const upload = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);

    // Example using fetch (basic)
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.open("POST", "/api/upload");

      xhr.upload.onprogress = (event) => {
        const percent = Math.round((event.loaded / event.total) * 100);
        setProgress(percent);
        onProgress(percent);
      };

      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = reject;

      xhr.send(formData);
    });
  };

  return { upload, progress };
};

export default useImageUpload;