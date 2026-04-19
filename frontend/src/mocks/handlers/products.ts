import { http, HttpResponse } from 'msw'
import { mockProducts, mockCategories, mockUsers } from '../fixtures'
import { getRoleFromRequest, getEmailFromRequest } from '../rbac'
import type { ProductDTO, ProductCategoryDTO } from '@/lib/types'

let products = [...mockProducts]
let categories = [...mockCategories]
let nextProductId = 10
let nextCategoryId = 10

export const productHandlers = [
  // ── Product Categories ──

  http.get('/api/v1/product-categories', () => {
    return HttpResponse.json(categories)
  }),

  http.post('/api/v1/product-categories', async ({ request }) => {
    const body = await request.json() as { name: string; parentId?: number | null }
    const newCategory: ProductCategoryDTO = {
      id: nextCategoryId++,
      name: body.name,
      parentId: body.parentId ?? null,
      children: [],
    }
    categories.push(newCategory)
    return HttpResponse.json(newCategory, { status: 201 })
  }),

  http.put('/api/v1/product-categories/:categoryId', async ({ params, request }) => {
    const { categoryId } = params
    const body = await request.json() as { name: string }
    const category = categories.find((c) => c.id === Number(categoryId))
    if (!category) {
      return HttpResponse.json({ message: '分類不存在' }, { status: 404 })
    }
    category.name = body.name
    return HttpResponse.json(category)
  }),

  // ── Products ──

  http.get('/api/v1/products', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const categoryId = url.searchParams.get('categoryId')
    const page = Number(url.searchParams.get('page') ?? 0)
    const size = Number(url.searchParams.get('size') ?? 20)

    let filtered = [...products]
    const role = getRoleFromRequest(request)
    if (role === 'GENERAL_USER') {
      const email = getEmailFromRequest(request)
      const user = mockUsers.find((u) => u.email === email)
      filtered = user ? filtered.filter((p) => p.ownerUserId === user.id) : []
    }
    if (status) filtered = filtered.filter((p) => p.status === status)
    if (categoryId) filtered = filtered.filter((p) => p.categoryId === Number(categoryId))

    const start = page * size
    const content = filtered.slice(start, start + size)

    return HttpResponse.json({
      content,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      page,
      size,
    })
  }),

  http.get('/api/v1/products/:productId', ({ params }) => {
    const { productId } = params
    const product = products.find((p) => p.id === Number(productId))
    if (!product) {
      return HttpResponse.json({ message: '商品不存在' }, { status: 404 })
    }
    return HttpResponse.json(product)
  }),

  http.post('/api/v1/products', async ({ request }) => {
    const formData = await request.formData()
    const newProduct: ProductDTO = {
      id: nextProductId++,
      name: formData.get('name') as string,
      slug: (formData.get('name') as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: (formData.get('description') as string) ?? '',
      price: Number(formData.get('price')),
      priceUnit: (formData.get('priceUnit') as 'KG' | 'CATTY') ?? 'KG',
      packaging: (formData.get('packaging') as string) ?? '',
      categoryId: Number(formData.get('categoryId')),
      categoryName: categories.find((c) => c.id === Number(formData.get('categoryId')))?.name ?? '',
      status: 'ACTIVE',
      isBundle: formData.get('isBundle') === 'true',
      bundleDiscountPercent: formData.get('bundleDiscountPercent') ? Number(formData.get('bundleDiscountPercent')) : null,
      bundleItems: [],
      isPreorder: formData.get('isPreorder') === 'true',
      preorderStartDate: (formData.get('preorderStartDate') as string) || null,
      preorderEndDate: (formData.get('preorderEndDate') as string) || null,
      preorderDiscountPercent: formData.get('preorderDiscountPercent') ? Number(formData.get('preorderDiscountPercent')) : null,
      shippingDeadline: null,
      stockQuantity: Number(formData.get('stockQuantity') ?? 0),
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    products.push(newProduct)
    return HttpResponse.json(newProduct, { status: 201 })
  }),

  http.put('/api/v1/products/:productId', async ({ params, request }) => {
    const { productId } = params
    const product = products.find((p) => p.id === Number(productId))
    if (!product) {
      return HttpResponse.json({ message: '商品不存在' }, { status: 404 })
    }
    const formData = await request.formData()
    product.name = (formData.get('name') as string) ?? product.name
    product.description = (formData.get('description') as string) ?? product.description
    product.price = formData.get('price') ? Number(formData.get('price')) : product.price
    product.updatedAt = new Date().toISOString()
    return HttpResponse.json(product)
  }),

  http.post('/api/v1/products/:productId/deactivate', ({ params }) => {
    const { productId } = params
    const product = products.find((p) => p.id === Number(productId))
    if (!product) {
      return HttpResponse.json({ message: '商品不存在' }, { status: 404 })
    }
    if (product.status !== 'ACTIVE') {
      return HttpResponse.json({ message: '僅已上架商品可被下架' }, { status: 400 })
    }
    product.status = 'INACTIVE'
    product.updatedAt = new Date().toISOString()
    return HttpResponse.json(product)
  }),

  http.post('/api/v1/products/:productId/images', async ({ params, request }) => {
    const { productId } = params
    const product = products.find((p) => p.id === Number(productId))
    if (!product) {
      return HttpResponse.json({ message: '商品不存在' }, { status: 404 })
    }
    const formData = await request.formData()
    const imageFiles = formData.getAll('images') as File[]
    let nextImgId = product.images.length > 0
      ? Math.max(...product.images.map((img) => img.id)) + 1
      : 100

    const newImages = imageFiles.map((file, idx) => ({
      id: nextImgId++,
      imageUrl: URL.createObjectURL ? URL.createObjectURL(file) : `https://via.placeholder.com/400?text=uploaded-${idx}`,
      sortOrder: product.images.length + idx,
    }))
    product.images = [...product.images, ...newImages].slice(0, 5)
    product.updatedAt = new Date().toISOString()
    return HttpResponse.json(product)
  }),
]
