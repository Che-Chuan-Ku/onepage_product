import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/lib/types'

interface CartState {
  items: CartItem[]
  websiteId: number | null
  addItem: (item: CartItem) => void
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  subtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      websiteId: null,

      addItem: (item: CartItem) => {
        const { items } = get()
        const existing = items.find((i) => i.productId === item.productId)

        if (existing) {
          set({
            items: items.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          })
        } else {
          set({
            items: [...items, item],
            websiteId: item.websiteId,
          })
        }
      },

      removeItem: (productId: number) => {
        const { items } = get()
        const newItems = items.filter((i) => i.productId !== productId)
        set({ items: newItems, websiteId: newItems.length > 0 ? get().websiteId : null })
      },

      updateQuantity: (productId: number, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        })
      },

      clearCart: () => set({ items: [], websiteId: null }),

      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      subtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    {
      name: 'cart-storage',
    }
  )
)
