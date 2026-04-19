'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'

interface UploadedImage {
  id: string
  file: File
  previewUrl: string
  isMain: boolean
}

interface ImageUploaderProps {
  images: UploadedImage[]
  onChange: (images: UploadedImage[]) => void
  maxImages?: number
}

const MAX_SIZE_MB = 2
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function ImageUploader({ images, onChange, maxImages = 5 }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}：僅支援 JPG、PNG、WebP 格式`
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `${file.name}：檔案大小不可超過 ${MAX_SIZE_MB}MB`
    }
    return null
  }

  const addFiles = (files: File[]) => {
    const remaining = maxImages - images.length
    const toAdd = files.slice(0, remaining)
    const errors: string[] = []
    const valid: UploadedImage[] = []

    toAdd.forEach((file) => {
      const err = validateFile(file)
      if (err) {
        errors.push(err)
      } else {
        valid.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
          isMain: images.length + valid.length === 0,
        })
      }
    })

    if (errors.length > 0) {
      alert(errors.join('\n'))
    }

    if (valid.length > 0) {
      onChange([...images, ...valid])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      ALLOWED_TYPES.includes(f.type)
    )
    addFiles(files)
  }

  const handleRemove = (id: string) => {
    const updated = images.filter((img) => img.id !== id)
    // Reassign main to first image if main was removed
    if (updated.length > 0 && !updated.some((img) => img.isMain)) {
      updated[0].isMain = true
    }
    onChange(updated)
  }

  const handleSetMain = (id: string) => {
    onChange(images.map((img) => ({ ...img, isMain: img.id === id })))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="label">商品圖片（最多 {maxImages} 張）</label>
        <span className="text-xs text-olive-400">{images.length} / {maxImages}</span>
      </div>

      {/* Preview thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {images.map((img) => (
            <div
              key={img.id}
              className={clsx(
                'relative w-24 h-24 overflow-hidden border-2 group cursor-pointer',
                img.isMain ? 'border-olive-700' : 'border-cream-300'
              )}
              onClick={() => handleSetMain(img.id)}
              title="點擊設為主圖"
            >
              <Image
                src={img.previewUrl}
                alt={img.file.name}
                fill
                className="object-cover"
                unoptimized
              />
              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(img.id) }}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-terra-600"
                title="移除"
              >
                ×
              </button>
              {/* Main badge */}
              {img.isMain && (
                <div className="absolute bottom-0 left-0 right-0 bg-olive-700/80 text-white text-center text-xs py-0.5">
                  主圖
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors',
            dragOver
              ? 'border-olive-500 bg-olive-50'
              : 'border-cream-300 hover:border-olive-400 hover:bg-olive-50/30'
          )}
        >
          <p className="text-sm text-olive-500">
            點擊或拖曳上傳圖片
          </p>
          <p className="text-xs text-olive-400 mt-1">
            JPG、PNG、WebP，每張不超過 {MAX_SIZE_MB}MB
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

export type { UploadedImage }
