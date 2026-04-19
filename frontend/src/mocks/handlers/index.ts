import { authHandlers } from './auth'
import { productHandlers } from './products'
import { websiteHandlers } from './websites'
import { storefrontHandlers } from './storefront'
import { orderHandlers } from './orders'
import { invoiceHandlers } from './invoices'
import { inventoryHandlers } from './inventory'
import { emailTemplateHandlers } from './email-templates'

export const handlers = [
  ...authHandlers,
  ...productHandlers,
  ...websiteHandlers,
  ...storefrontHandlers,
  ...orderHandlers,
  ...invoiceHandlers,
  ...inventoryHandlers,
  ...emailTemplateHandlers,
]
