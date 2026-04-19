import { apiClient } from './client'
import type { EmailTemplateDTO, UpdateEmailTemplateRequest } from '@/lib/types'

export const emailTemplateApi = {
  list: async (): Promise<EmailTemplateDTO[]> => {
    const res = await apiClient.get('/email-templates')
    return res.data
  },

  update: async (templateId: number, data: UpdateEmailTemplateRequest): Promise<EmailTemplateDTO> => {
    const res = await apiClient.put(`/email-templates/${templateId}`, data)
    return res.data
  },

  preview: async (templateId: number): Promise<string> => {
    const res = await apiClient.get(`/email-templates/${templateId}/preview`)
    return res.data
  },
}
