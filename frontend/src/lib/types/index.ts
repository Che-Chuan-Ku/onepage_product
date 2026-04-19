// ─── Auth ───────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  role: 'ADMIN' | 'GENERAL_USER'
  userName: string
}

export interface TokenResponse {
  accessToken: string
}

export interface UserDTO {
  id: number
  email: string
  name: string
  role: 'ADMIN' | 'GENERAL_USER'
}

// ─── Product Category ────────────────────────────────────────────────────────

export interface ProductCategoryDTO {
  id: number
  name: string
  parentId: number | null
  children: ProductCategoryDTO[]
}

export interface CreateProductCategoryRequest {
  name: string
  parentId?: number | null
}

// ─── Product ─────────────────────────────────────────────────────────────────

export type PriceUnit = 'KG' | 'CATTY'
export type ProductStatus = 'ACTIVE' | 'INACTIVE'

export interface ProductImageDTO {
  id: number
  imageUrl: string
  sortOrder: number
}

export interface BundleItemDTO {
  productId: number
  productName: string
  price: number
}

export interface ProductDTO {
  id: number
  name: string
  slug: string
  description: string
  price: number
  priceUnit: PriceUnit
  packaging: string
  categoryId: number
  categoryName: string
  status: ProductStatus
  isBundle: boolean
  bundleDiscountPercent: number | null
  bundleItems: BundleItemDTO[]
  isPreorder: boolean
  preorderStartDate: string | null
  preorderEndDate: string | null
  preorderDiscountPercent: number | null
  shippingDeadline: string | null
  stockQuantity: number
  images: ProductImageDTO[]
  ownerUserId?: number   // REQ-034: RBAC 資料隔離
  createdAt: string
  updatedAt: string
}

export interface CreateProductRequest {
  name: string
  description?: string
  price: number
  priceUnit: PriceUnit
  packaging?: string
  categoryId: number
  stockQuantity: number
  images?: File[]
  isBundle?: boolean
  bundleDiscountPercent?: number
  bundleProductIds?: number[]
  isPreorder?: boolean
  preorderStartDate?: string
  preorderEndDate?: string
  preorderDiscountPercent?: number
}

export interface UpdateProductRequest {
  name: string
  description?: string
  price: number
  priceUnit: PriceUnit
  packaging?: string
  categoryId: number
  images?: File[]
  isBundle?: boolean
  bundleDiscountPercent?: number
  bundleProductIds?: number[]
  isPreorder?: boolean
  preorderStartDate?: string
  preorderEndDate?: string
  preorderDiscountPercent?: number
  shippingDeadline?: string
}

export interface PagedProducts {
  content: ProductDTO[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Website ─────────────────────────────────────────────────────────────────

export type WebsiteStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'

export interface WebsiteDTO {
  id: number
  name: string
  title: string | null
  subtitle: string | null
  browserTitle: string | null
  subscriptionPlan: string
  publishStartAt: string | null
  publishEndAt: string | null
  bannerImageUrl: string | null
  promoImageUrl: string | null
  footerTitle: string | null
  footerSubtitle: string | null
  freeShippingThreshold: number
  status: WebsiteStatus
  storefrontUrl: string
  ownerUserId?: number   // REQ-034: RBAC 資料隔離
  createdAt: string
  updatedAt: string
}

export interface CreateWebsiteRequest {
  name: string
  subscriptionPlan?: string
  publishStartAt?: string
  publishEndAt?: string
  bannerImage?: File
  promoImage?: File
  freeShippingThreshold?: number
  title?: string
  subtitle?: string
  browserTitle?: string
  footerTitle?: string
  footerSubtitle?: string
}

export interface UpdateWebsiteRequest {
  name: string
  subscriptionPlan?: string
  publishStartAt?: string
  publishEndAt?: string
  bannerImage?: File
  promoImage?: File
  freeShippingThreshold?: number
  title?: string
  subtitle?: string
  browserTitle?: string
  footerTitle?: string
  footerSubtitle?: string
}

export interface WebsiteProductDTO {
  websiteId: number
  productId: number
  productName: string
  productSlug: string
  publishAt: string
}

export interface WebsiteProductInput {
  productId: number
  publishAt: string
}

// ─── Storefront ──────────────────────────────────────────────────────────────

export interface StorefrontProductCardDTO {
  id: number
  name: string
  slug: string
  price: number
  imageUrl: string | null
  isPreorder: boolean
  preorderDiscountPercent: number | null
}

export interface StorefrontWebsiteDTO {
  id: number
  name: string
  title: string | null
  subtitle: string | null
  bannerImageUrl: string | null
  promoImageUrl: string | null
  footerTitle: string | null
  footerSubtitle: string | null
  freeShippingThreshold: number
  products: StorefrontProductCardDTO[]
}

export interface StorefrontProductDTO {
  id: number
  name: string
  slug: string
  description: string
  price: number
  priceUnit: PriceUnit
  packaging: string
  images: ProductImageDTO[]
  isPreorder: boolean
  preorderStartDate: string | null
  preorderEndDate: string | null
  preorderDiscountPercent: number | null
  isBundle: boolean
  bundleDiscountPercent: number | null
  bundleItems: BundleItemDTO[]
  websiteId: number
}

// ─── Shipping ────────────────────────────────────────────────────────────────

export type ShippingMethod = 'DELIVERY' | 'PICKUP'

export interface ShippingCalculateRequest {
  websiteId: number
  address?: string
  shippingMethod: ShippingMethod
  orderAmount?: number
}

export interface ShippingCalculateResponse {
  shippingFee: number
  isRemoteIsland: boolean
  freeShippingThreshold: number
  message: string | null
}

// ─── Order ───────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PROCESSING_PAYMENT'
  | 'PAID'
  | 'SHIPPED'
  | 'RETURNED'
  | 'PAYMENT_FAILED'

export interface OrderItemInput {
  productId: number
  quantity: number
}

export interface CreateOrderRequest {
  websiteId: number
  customerName: string
  customerPhone: string
  customerEmail: string
  shippingAddress?: string
  shippingMethod: ShippingMethod
  note?: string
  taxId?: string
  items: OrderItemInput[]
}

export interface OrderItemDTO {
  id: number
  productId: number
  productName: string
  productPrice: number
  quantity: number
  discountAmount: number
  subtotal: number
}

export interface OrderDTO {
  id: number
  orderNumber: string
  websiteId: number
  websiteName: string
  customerName: string
  customerPhone: string
  customerEmail: string
  shippingAddress: string
  shippingMethod: ShippingMethod
  shippingFee: number
  subtotal: number
  totalAmount: number
  note: string
  taxId: string
  status: OrderStatus
  isPreorder: boolean
  items: OrderItemDTO[]
  createdAt: string
  updatedAt: string
}

export interface PagedOrders {
  content: OrderDTO[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export type PaymentMethod = 'CREDIT_CARD' | 'LINE_PAY' | 'BANK_TRANSFER'
export type InvoiceType = 'TWO_COPIES' | 'THREE_COPIES'
export type CarrierType = 'MOBILE_BARCODE' | 'CITIZEN_CERTIFICATE'
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface CreatePaymentRequest {
  paymentMethod: PaymentMethod
  invoiceType: InvoiceType
  carrierType?: CarrierType | null
  carrierNumber?: string | null
  buyerTaxId?: string | null
}

export interface PaymentDTO {
  id: number
  orderId: number
  paymentMethod: PaymentMethod
  ecpayTradeNo: string
  ecpayPaymentUrl: string
  expireAt: string
  status: PaymentStatus
  createdAt: string
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'SYNCING' | 'ISSUED' | 'VOIDED' | 'ALLOWANCED'

export interface InvoiceDTO {
  id: number
  orderId: number
  orderNumber: string
  invoiceNumber: string | null
  randomCode: string | null
  invoiceDate: string | null
  amount: number
  invoiceType: InvoiceType
  carrierType: string | null
  carrierNumber: string | null
  buyerTaxId: string | null
  status: InvoiceStatus
  voidReason: string | null
  allowanceAmount: number | null
  allowanceNumber: string | null
  createdAt: string
  updatedAt: string
}

export interface PagedInvoices {
  content: InvoiceDTO[]
  totalElements: number
  totalPages: number
  page: number
  size: number
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export interface InventoryDTO {
  productId: number
  productName: string
  stockQuantity: number
  lowStockThreshold: number
  isLowStock: boolean
}

// ─── Email Template ──────────────────────────────────────────────────────────

export type EmailTemplateType =
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SHIPPED'

export interface TemplateVariableDTO {
  variable: string       // e.g. "{{customerName}}"
  description: string    // e.g. "顧客姓名"
}

export interface EmailTemplateDTO {
  id: number
  templateType: EmailTemplateType
  subject: string
  bodyHtml: string
  availableVariables: TemplateVariableDTO[]  // REQ-032
  updatedAt: string
}

export interface UpdateEmailTemplateRequest {
  subject: string
  bodyHtml: string
}

// ─── Cart (local state) ──────────────────────────────────────────────────────

export interface CartItem {
  productId: number
  productName: string
  productSlug: string
  price: number
  quantity: number
  imageUrl: string | null
  isPreorder: boolean
  websiteId: number
}

// ─── User Create ─────────────────────────────────────────────────────────────

export interface CreateUserRequest {
  email: string
  name: string
  password: string
  role: 'ADMIN' | 'GENERAL_USER'
  sendWelcomeEmail?: boolean
}

// ─── Common ──────────────────────────────────────────────────────────────────

export interface ErrorResponse {
  message: string
  code?: string
}

export interface PaginationParams {
  page?: number
  size?: number
}
