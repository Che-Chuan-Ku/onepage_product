import { z } from 'zod'

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const LoginRequestSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  password: z.string().min(1, '請輸入密碼'),
})

// ─── Product Category Schemas ─────────────────────────────────────────────────

export const CreateProductCategorySchema = z.object({
  name: z.string().min(1, '請輸入分類名稱').max(100, '名稱不可超過100字'),
  parentId: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? null : Number(val)),
    z.number().nullable().optional()
  ),
})

// ─── Product Schemas ──────────────────────────────────────────────────────────

const CreateProductBaseSchema = z.object({
    name: z.string().min(1, '請輸入商品名稱'),
    description: z.string().optional(),
    price: z.number().min(0.01, '價格必須大於0'),
    priceUnit: z.enum(['KG', 'CATTY']),
    packaging: z.string().optional(),
    categoryId: z.number().min(1, '請選擇商品分類'),
    stockQuantity: z.number().min(0, '庫存不可為負數'),
    isBundle: z.boolean().default(false),
    bundleDiscountPercent: z.number().min(0).max(100).optional(),
    bundleProductIds: z.array(z.number()).optional(),
    isPreorder: z.boolean().default(false),
    preorderStartDate: z.string().optional(),
    preorderEndDate: z.string().optional(),
    preorderDiscountPercent: z.number().min(0).max(100).optional(),
  })

export const CreateProductSchema = CreateProductBaseSchema
  .refine(
    (data) => {
      if (data.isBundle && (!data.bundleProductIds || data.bundleProductIds.length === 0)) {
        return false
      }
      return true
    },
    { message: '組合包必須選擇包含的商品', path: ['bundleProductIds'] }
  )
  .refine(
    (data) => {
      if (data.isPreorder && !data.preorderEndDate) {
        return false
      }
      return true
    },
    { message: '預購商品必須設定預購結束日', path: ['preorderEndDate'] }
  )

export const UpdateProductSchema = CreateProductBaseSchema.omit({ stockQuantity: true }).extend({
  shippingDeadline: z.string().optional(),
})

// ─── Website Schemas ──────────────────────────────────────────────────────────

export const CreateWebsiteSchema = z.object({
  name: z.string().min(1, '請輸入網站名稱'),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  browserTitle: z.string().optional(),
  subscriptionPlan: z.string().optional(),
  publishStartAt: z.string().optional(),
  publishEndAt: z.string().optional(),
  freeShippingThreshold: z.number().min(0).default(1500),
  footerTitle: z.string().optional(),
  footerSubtitle: z.string().optional(),
})

export const UpdateWebsiteSchema = CreateWebsiteSchema

// ─── Create User Schema ───────────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  email: z.string().email('請輸入有效的 Email'),
  name: z.string().min(1, '請輸入姓名'),
  password: z.string().min(8, '密碼至少需要 8 個字元'),
  role: z.enum(['ADMIN', 'GENERAL_USER']),
  sendWelcomeEmail: z.boolean().default(true),
})

// ─── Order Schemas ────────────────────────────────────────────────────────────

export const CreateOrderSchema = z
  .object({
    websiteId: z.number(),
    customerName: z.string().min(1, '請輸入姓名'),
    customerPhone: z.string().min(1, '請輸入電話'),
    customerEmail: z.string().email('請輸入有效的 Email'),
    shippingAddress: z.string().optional(),
    shippingMethod: z.enum(['DELIVERY', 'PICKUP']),
    note: z.string().optional(),
    taxId: z
      .string()
      .regex(/^\d{8}$/, '統一編號必須為8碼數字')
      .optional()
      .or(z.literal('')),
    items: z.array(
      z.object({
        productId: z.number(),
        quantity: z.number().min(1),
      })
    ).min(1, '購物車不可為空'),
  })
  .refine(
    (data) => {
      if (data.shippingMethod === 'DELIVERY' && !data.shippingAddress) {
        return false
      }
      return true
    },
    { message: '宅配必須填寫地址', path: ['shippingAddress'] }
  )

// ─── Payment Schemas ──────────────────────────────────────────────────────────

export const CreatePaymentSchema = z
  .object({
    paymentMethod: z.enum(['CREDIT_CARD', 'LINE_PAY', 'BANK_TRANSFER']),
    invoiceType: z.enum(['TWO_COPIES', 'THREE_COPIES']),
    carrierType: z.enum(['MOBILE_BARCODE', 'CITIZEN_CERTIFICATE']).nullable().optional(),
    carrierNumber: z.string().nullable().optional(),
    buyerTaxId: z
      .string()
      .regex(/^\d{8}$/, '統一編號必須為8碼數字')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.invoiceType === 'THREE_COPIES' && !data.buyerTaxId) {
        return false
      }
      return true
    },
    { message: '三聯式發票必須填寫買方統一編號', path: ['buyerTaxId'] }
  )

// ─── Inventory Schemas ────────────────────────────────────────────────────────

export const UpdateInventorySchema = z.object({
  stockQuantity: z.number().min(0, '庫存不可為負數'),
})

export const UpdateLowStockThresholdSchema = z.object({
  threshold: z.number().min(0, '門檻不可為負數'),
})

// ─── Email Template Schemas ───────────────────────────────────────────────────

export const UpdateEmailTemplateSchema = z.object({
  subject: z.string().min(1, '請輸入主旨'),
  bodyHtml: z.string().min(1, '請輸入內容'),
})

export type LoginRequestInput = z.infer<typeof LoginRequestSchema>
export type CreateProductCategoryInput = z.infer<typeof CreateProductCategorySchema>
export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type CreateWebsiteInput = z.infer<typeof CreateWebsiteSchema>
export type UpdateWebsiteInput = z.infer<typeof UpdateWebsiteSchema>
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
export type UpdateInventoryInput = z.infer<typeof UpdateInventorySchema>
export type UpdateLowStockThresholdInput = z.infer<typeof UpdateLowStockThresholdSchema>
export type UpdateEmailTemplateInput = z.infer<typeof UpdateEmailTemplateSchema>
export type CreateUserInput = z.infer<typeof CreateUserSchema>
