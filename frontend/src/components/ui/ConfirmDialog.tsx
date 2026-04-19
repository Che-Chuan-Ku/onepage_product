'use client'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
  variant = 'primary',
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-olive-900/50" onClick={onCancel} />
      <div className="relative bg-white w-full max-w-sm mx-4 shadow-xl p-6">
        <h3 className="font-display text-lg font-semibold text-olive-900 mb-2">{title}</h3>
        <p className="text-olive-600 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary text-sm px-4 py-2'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
