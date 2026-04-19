export function StorefrontFooter() {
  return (
    <footer className="bg-white border-t-2 border-cream-300 py-4 mt-auto">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <p className="font-body text-olive-400 text-xs">
          由 OnePage 提供技術支援
        </p>
        <a
          href="https://onepage.example.com/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-olive-400 text-xs hover:text-olive-600 underline transition-colors"
        >
          聯絡 OnePage
        </a>
      </div>
    </footer>
  )
}
