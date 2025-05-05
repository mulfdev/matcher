import { useState, useCallback } from "react"
import Dropzone from "react-dropzone"
import { ArrowUpTrayIcon, DocumentIcon, XMarkIcon } from "@heroicons/react/24/outline"

export default function Dashboard() {
  const [files, setFiles] = useState([])

  const onDrop = useCallback((acceptedFiles) => {
    setFiles(acceptedFiles)
    console.log(acceptedFiles)
  }, [])

  const removeFile = (fileToRemove) => {
    setFiles(files.filter((file) => file !== fileToRemove))
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-white text-3xl font-bold mb-6">Get Matched</h1>

      <Dropzone onDrop={onDrop}>
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
              ${isDragActive
                ? "border-purple-500 bg-purple-900/20"
                : "border-gray-600 hover:border-purple-400 hover:bg-gray-800/50"
              }
              ${files.length > 0 ? "bg-gray-800/30" : ""}
            `}
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
                ${isDragActive ? "scale-110" : ""}
              `}
              >
                <ArrowUpTrayIcon className="h-8 w-8" />
              </div>

              <div className="text-center">
                <p className="text-white text-lg mb-1">
                  {isDragActive ? "Drop files here..." : "Drag 'n' drop files here, or click to select"}
                </p>
                <p className="text-gray-400 text-sm">Upload your resume PDF to get matched</p>
              </div>
            </div>
          </div>
        )}
      </Dropzone>

      {files.length > 0 && (
        <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-medium">Selected Files</h3>
            <button onClick={() => setFiles([])} className="text-gray-400 hover:text-white text-sm">
              Clear all
            </button>
          </div>

          <ul className="space-y-2">
            {files.map((file, index) => (
              <li key={index} className="flex items-center justify-between bg-gray-800 rounded-md p-3">
                <div className="flex items-center gap-3">
                  <DocumentIcon className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-white text-sm truncate max-w-xs">{file.name}</p>
                    <p className="text-gray-400 text-xs">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button onClick={() => removeFile(file)} className="text-gray-400 hover:text-white">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

