import { http, HttpResponse } from 'msw'
import { mockInventory } from '../fixtures'

let inventory = [...mockInventory]

export const inventoryHandlers = [
  http.get('/api/v1/inventory', () => {
    return HttpResponse.json(inventory)
  }),

  http.put('/api/v1/inventory/:productId', async ({ params, request }) => {
    const { productId } = params
    const body = await request.json() as { stockQuantity: number }
    const item = inventory.find((i) => i.productId === Number(productId))
    if (!item) {
      return HttpResponse.json({ message: '商品不存在' }, { status: 404 })
    }
    item.stockQuantity = body.stockQuantity
    item.isLowStock = item.stockQuantity < item.lowStockThreshold
    return HttpResponse.json(item)
  }),

  http.put('/api/v1/inventory/:productId/threshold', async ({ params, request }) => {
    const { productId } = params
    const body = await request.json() as { threshold: number }
    const item = inventory.find((i) => i.productId === Number(productId))
    if (!item) {
      return HttpResponse.json({ message: '商品不存在' }, { status: 404 })
    }
    item.lowStockThreshold = body.threshold
    item.isLowStock = item.stockQuantity < item.lowStockThreshold
    return HttpResponse.json(item)
  }),
]
