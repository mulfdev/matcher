import { useState, useCallback } from 'react';
import Dropzone from 'react-dropzone';
import { ArrowUpTrayIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fetcher } from '~/core';
import ResumeViz from './ResumeVis';
import { ResumeData } from '~/types';

export default function Dashboard() {
  const [files, setFiles] = useState<File[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [data, setData] = useState<ResumeData | null>(null);

  const uploadFile = async () => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const res: {
        data: ResumeData;
      } = await fetcher({
        url: '/upload',
        method: 'POST',
        body: formData,
      });
      setProcessed(true);
      setData(res.data);
    } catch (error) {
      if (error instanceof Error) {
        console.log('Upload error: ' + error.message);
      }
      console.log(error);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const maxSize = 5 * 1024 * 1024;
    const file = acceptedFiles[0];

    if (!file) {
      setFiles([]);
      return;
    }

    if (file.type !== 'application/pdf' || file.size > maxSize) {
      alert(`File rejected: ${file.name}. Only a single PDF file up to 5MB is allowed.`);
      setFiles([]);
      return;
    }

    setFiles([file]);
    console.log([file]);
  }, []);

  const removeFile = () => {
    setFiles(null);
  };

  return (
    <div className="max-w-3xl mx-auto p-2 md:p-6">
      {!processed ? (
        <div>
          <h1 className="text-white text-3xl font-bold mb-6">Get Matched</h1>

          <Dropzone onDrop={onDrop} multiple={false} maxFiles={1} disabled={files !== null}>
            {({ getRootProps, getInputProps, isDragActive }) => (
              <div
                {...getRootProps()}
                className={`
            relative
            border-2
            border-dashed
            rounded-xl
            p-8
            transition-all
            duration-300
            ease-in-out
            cursor-pointer
            ${files !== null ? 'opacity-50 cursor-not-allowed' : ''}
            ${isDragActive && files === null ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600 hover:border-purple-400 hover:bg-gray-800/50'}
            ${files !== null ? 'bg-gray-800/30' : ''}
          `}
                style={{ pointerEvents: files !== null ? 'none' : undefined }}
              >
                {' '}
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center gap-4">
                  <div
                    className={`
                p-4 
                rounded-full 
                bg-gray-800 
                text-purple-400
                transition-transform 
                duration-300
                ${isDragActive ? 'scale-110' : ''}
              `}
                  >
                    <ArrowUpTrayIcon className="h-8 w-8" />
                  </div>

                  <div className="text-center">
                    <p className="text-white text-lg mb-1">
                      {isDragActive
                        ? 'Drop files here...'
                        : "Drag 'n' drop files here, or click to select"}
                    </p>
                    <p className="text-gray-400 text-sm">Upload your resume PDF to get matched</p>
                  </div>
                </div>
              </div>
            )}
          </Dropzone>
          {files && files.length > 0 && (
            <button
              onClick={uploadFile}
              disabled={uploading}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
          )}

          {files && files.length > 0 && (
            <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-medium">Selected Files</h3>
                <button
                  onClick={() => setFiles(null)}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Clear all
                </button>
              </div>

              <ul className="space-y-2">
                {files?.map((file, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between bg-gray-800 rounded-md p-3"
                  >
                    <div className="flex items-center gap-3">
                      <DocumentIcon className="h-5 w-5 text-purple-400" />
                      <div>
                        <p className="text-white text-sm truncate max-w-xs">{file.name}</p>
                        <p className="text-gray-400 text-xs">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                    <button onClick={() => removeFile()} className="text-gray-400 hover:text-white">
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
      {processed && data ? <ResumeViz data={data} /> : null}
    </div>
  );
}
