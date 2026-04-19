import { http, HttpResponse } from 'msw'
import { mockEmailTemplates } from '../fixtures'

let emailTemplates = [...mockEmailTemplates]

export const emailTemplateHandlers = [
  http.get('/api/v1/email-templates', () => {
    return HttpResponse.json(emailTemplates)
  }),

  http.put('/api/v1/email-templates/:templateId', async ({ params, request }) => {
    const { templateId } = params
    const body = await request.json() as { subject: string; bodyHtml: string }
    const template = emailTemplates.find((t) => t.id === Number(templateId))
    if (!template) {
      return HttpResponse.json({ message: '模板不存在' }, { status: 404 })
    }
    template.subject = body.subject
    template.bodyHtml = body.bodyHtml
    template.updatedAt = new Date().toISOString()
    return HttpResponse.json(template)
  }),

  http.get('/api/v1/email-templates/:templateId/preview', ({ params }) => {
    const { templateId } = params
    const template = emailTemplates.find((t) => t.id === Number(templateId))
    if (!template) {
      return HttpResponse.json({ message: '模板不存在' }, { status: 404 })
    }
    const previewHtml = template.bodyHtml
      .replace(/\{\{customerName\}\}/g, '測試顧客')
      .replace(/\{\{orderNumber\}\}/g, 'OP20260401TEST')
      .replace(/\{\{totalAmount\}\}/g, '1460')
      .replace(/\{\{websiteName\}\}/g, '豐收農場 線上商店')
      .replace(/\{\{contactInfo\}\}/g, '聯絡我們：farm@example.com | 02-1234-5678')
    return new HttpResponse(previewHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }),

  http.get('/api/v1/system/time', () => {
    return HttpResponse.json({ serverTime: new Date().toISOString() })
  }),
]
