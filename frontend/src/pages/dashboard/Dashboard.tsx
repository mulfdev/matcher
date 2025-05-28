import { useState, useCallback, useEffect } from 'react';
import Dropzone from 'react-dropzone';

import ArrowUpTrayIcon from '@heroicons/react/24/outline/ArrowUpTrayIcon';
import DocumentIcon from '@heroicons/react/24/outline/DocumentIcon';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';

import { fetcher } from '~/core';
import { ResumeData } from '~/types';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/card';
import { Button } from '~/components/button';
import clsx from 'clsx';

export default function Dashboard() {
  const [files, setFiles] = useState<File[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [data, setData] = useState<ResumeData | null>(null);
  const [profile, setProfile] = useState<ResumeData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await fetcher<{ data: ResumeData }>({ url: '/profile' });
        setProfile(res.data);
        setProcessed(true);
        setData(res.data);
      } catch (e) {
        setProfile(null);
        setProcessed(false);
        setData(null);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  const uploadFile = async () => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
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
      setProfile(res.data);
    } catch (error) {
      if (error instanceof Error) {
        setError('Upload error: ' + error.message);
      } else {
        setError('Upload failed. Please try again.');
      }
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
  }, []);

  const removeFile = () => {
    setFiles(null);
  };

  // Format years of experience
  const formatYears = (years: number) =>
    years === 1 ? '1 year' : `${years} years`;

  // Main render
  return (
    <div className="max-w-4xl mx-auto p-2 md:p-6">
      {loadingProfile ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-purple-400 text-xl font-semibold tracking-wide">
            Loading your profile...
          </div>
        </div>
      ) : !processed ? (
        <div>
          <h1 className="text-white text-4xl font-extrabold mb-8 tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-lg">
              Get Matched
            </span>
            <span className="inline-block animate-bounce text-2xl">✨</span>
          </h1>
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
          {error && (
            <div className="mt-4 text-red-400 font-semibold">{error}</div>
          )}
        </div>
      ) : profile ? (
        <div>
          <h1 className="text-white text-4xl font-extrabold mb-8 tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-lg">
              Welcome Back!
            </span>
            <span className="inline-block animate-bounce text-2xl">👋</span>
          </h1>
          <Card className="mb-8 bg-gradient-to-br from-zinc-900/80 via-zinc-950/90 to-purple-950/60 border-2 border-zinc-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl text-white font-bold flex items-center gap-2">
                <span>What would you like to do next?</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-6 mt-2">
                <Button
                  color="indigo"
                  className="flex-1 py-6 text-lg font-semibold shadow-md hover:scale-105 transition-transform duration-150"
                  href="/dashboard/matches"
                >
                  🔎 View Your Matches
                </Button>
                <Button
                  color="green"
                  className="flex-1 py-6 text-lg font-semibold shadow-md hover:scale-105 transition-transform duration-150"
                  href="/dashboard/liked"
                >
                  💜 See Liked Jobs
                </Button>
                <Button
                  color="purple"
                  className="flex-1 py-6 text-lg font-semibold shadow-md hover:scale-105 transition-transform duration-150"
                  href="/dashboard/profile"
                >
                  👤 View Profile
                </Button>
              </div>
              <div className="mt-8 text-zinc-300 text-center text-base">
                <span>
                  Want to update your resume?{' '}
                  <button
                    className="underline text-purple-300 hover:text-purple-200 transition"
                    onClick={() => {
                      setProcessed(false);
                      setFiles(null);
                      setProfile(null);
                      setData(null);
                    }}
                  >
                    Click here to upload a new one.
                  </button>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
