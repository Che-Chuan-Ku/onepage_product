export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-8 h-8 border-2 border-olive-200 border-t-olive-700 rounded-full animate-spin" />
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100">
      <LoadingSpinner />
    </div>
  )
}
