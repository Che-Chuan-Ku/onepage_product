import { http, HttpResponse } from 'msw'
import { mockWebsites, mockWebsiteProducts, mockUsers } from '../fixtures'
import { getRoleFromRequest, getEmailFromRequest } from '../rbac'
import type { WebsiteDTO, WebsiteProductDTO, WebsiteProductInput } from '@/lib/types'

let websites = [...mockWebsites]
let websiteProducts = [...mockWebsiteProducts]
let nextWebsiteId = 10

export const websiteHandlers = [
  http.get('/api/v1/websites', ({ request }) => {
    let result = [...websites]
    const role = getRoleFromRequest(request)
    if (role === 'GENERAL_USER') {
      const email = getEmailFromRequest(request)
      const user = mockUsers.find((u) => u.email === email)
      result = user ? result.filter((w) => w.ownerUserId === user.id) : []
    }
    return HttpResponse.json(result)
  }),

  http.get('/api/v1/websites/:websiteId', ({ params }) => {
    const { websiteId } = params
    const website = websites.find((w) => w.id === Number(websiteId))
    if (!website) {
      return HttpResponse.json({ message: '網站不存在' }, { status: 404 })
    }
    return HttpResponse.json(website)
  }),

  http.post('/api/v1/websites', async ({ request }) => {
    const formData = await request.formData()
    const newWebsite: WebsiteDTO = {
      id: nextWebsiteId++,
      name: formData.get('name') as string,
      title: (formData.get('title') as string) || null,
      subtitle: (formData.get('subtitle') as string) || null,
      browserTitle: (formData.get('browserTitle') as string) || null,
      subscriptionPlan: (formData.get('subscriptionPlan') as string) ?? '',
      publishStartAt: (formData.get('publishStartAt') as string) || null,
      publishEndAt: (formData.get('publishEndAt') as string) || null,
      bannerImageUrl: formData.has('bannerImage') ? `https://via.placeholder.com/1200x400?text=banner-${nextWebsiteId - 1}` : null,
      promoImageUrl: formData.has('promoImage') ? `https://via.placeholder.com/1200x300?text=promo-${nextWebsiteId - 1}` : null,
      footerTitle: (formData.get('footerTitle') as string) || null,
      footerSubtitle: (formData.get('footerSubtitle') as string) || null,
      freeShippingThreshold: Number(formData.get('freeShippingThreshold') ?? 1500),
      status: 'DRAFT',
      storefrontUrl: `/project/${nextWebsiteId - 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    websites.push(newWebsite)
    return HttpResponse.json(newWebsite, { status: 201 })
  }),

  http.put('/api/v1/websites/:websiteId', async ({ params, request }) => {
    const { websiteId } = params
    const website = websites.find((w) => w.id === Number(websiteId))
    if (!website) {
      return HttpResponse.json({ message: '網站不存在' }, { status: 404 })
    }
    const formData = await request.formData()
    website.name = (formData.get('name') as string) ?? website.name
    website.title = formData.has('title') ? ((formData.get('title') as string) || null) : website.title
    website.subtitle = formData.has('subtitle') ? ((formData.get('subtitle') as string) || null) : website.subtitle
    website.browserTitle = formData.has('browserTitle') ? ((formData.get('browserTitle') as string) || null) : website.browserTitle
    website.subscriptionPlan = (formData.get('subscriptionPlan') as string) ?? website.subscriptionPlan
    website.freeShippingThreshold = formData.get('freeShippingThreshold')
      ? Number(formData.get('freeShippingThreshold'))
      : website.freeShippingThreshold
    website.footerTitle = formData.has('footerTitle') ? ((formData.get('footerTitle') as string) || null) : website.footerTitle
    website.footerSubtitle = formData.has('footerSubtitle') ? ((formData.get('footerSubtitle') as string) || null) : website.footerSubtitle
    if (formData.has('bannerImage')) {
      website.bannerImageUrl = `https://via.placeholder.com/1200x400?text=banner-${websiteId}`
    }
    if (formData.has('promoImage')) {
      website.promoImageUrl = `https://via.placeholder.com/1200x300?text=promo-${websiteId}`
    }
    website.updatedAt = new Date().toISOString()
    return HttpResponse.json(website)
  }),

  http.post('/api/v1/websites/:websiteId/publish', ({ params }) => {
    const { websiteId } = params
    const website = websites.find((w) => w.id === Number(websiteId))
    if (!website) {
      return HttpResponse.json({ message: '網站不存在' }, { status: 404 })
    }
    if (website.status !== 'DRAFT') {
      return HttpResponse.json({ message: '狀態轉換不合法' }, { status: 400 })
    }
    website.status = 'PUBLISHED'
    website.publishStartAt = new Date().toISOString()
    website.updatedAt = new Date().toISOString()
    return HttpResponse.json(website)
  }),

  http.post('/api/v1/websites/:websiteId/unpublish', ({ params }) => {
    const { websiteId } = params
    const website = websites.find((w) => w.id === Number(websiteId))
    if (!website) {
      return HttpResponse.json({ message: '網站不存在' }, { status: 404 })
    }
    if (website.status !== 'PUBLISHED') {
      return HttpResponse.json({ message: '狀態轉換不合法' }, { status: 400 })
    }
    website.status = 'OFFLINE'
    website.publishEndAt = new Date().toISOString()
    website.updatedAt = new Date().toISOString()
    return HttpResponse.json(website)
  }),

  http.post('/api/v1/websites/:websiteId/republish', ({ params }) => {
    const { websiteId } = params
    const website = websites.find((w) => w.id === Number(websiteId))
    if (!website) {
      return HttpResponse.json({ message: '網站不存在' }, { status: 404 })
    }
    if (website.status !== 'OFFLINE') {
      return HttpResponse.json({ message: '只有已下線網站可重新上線' }, { status: 400 })
    }
    website.status = 'PUBLISHED'
    website.publishStartAt = new Date().toISOString()
    website.publishEndAt = null
    website.updatedAt = new Date().toISOString()
    return HttpResponse.json(website)
  }),

  http.get('/api/v1/websites/:websiteId/products', ({ params }) => {
    const { websiteId } = params
    const wps = websiteProducts.filter((wp) => wp.websiteId === Number(websiteId))
    return HttpResponse.json(wps)
  }),

  http.put('/api/v1/websites/:websiteId/products', async ({ params, request }) => {
    const { websiteId } = params
    const inputs = await request.json() as WebsiteProductInput[]
    // Remove existing and replace
    websiteProducts = websiteProducts.filter((wp) => wp.websiteId !== Number(websiteId))
    const newEntries: WebsiteProductDTO[] = inputs.map((input) => ({
      websiteId: Number(websiteId),
      productId: input.productId,
      productName: `商品 ${input.productId}`,
      productSlug: `product-${input.productId}`,
      publishAt: input.publishAt,
    }))
    websiteProducts.push(...newEntries)
    return HttpResponse.json(newEntries)
  }),
]
