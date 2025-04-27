// src/types/index.ts (Admin Panel Frontend)

// --- Generic API Response ---
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  count?: number; // Added count for lists
  total?: number; // Added total for pagination later
  error?: any;
  errors?: any;
}

// --- Basic Package Info (Populated in Order) ---
export enum PackageType { // Keep enum consistent
  TRIAL = "trial",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
}
export interface IOrderPackageInfo {
  _id: string;
  name: string;
  type: PackageType;
  // Add other fields if populated by backend (e.g., price, days)
}

// --- Basic Customer Info (Populated in Order) ---
export interface IOrderCustomerInfo {
  _id: string;
  fullName: string;
  email: string;
  mobile?: string | null; // Include mobile if populated
}

// --- Order Status Enum / Type ---
export type OrderStatus = "Active" | "Expired" | "Cancelled";

// --- Nested Address/Payment Types (Keep if needed for display) ---
export interface IDeliveryAddressFE {
  /* ... */
}
export interface IPaymentDetailsFE {
  /* ... */
}

// --- Order Type for Admin Panel ---
export interface IOrderAdminFE {
  _id: string;
  orderNumber: string;
  customer: IOrderCustomerInfo; // Populated customer info
  package: IOrderPackageInfo; // Populated package info
  packageName: string; // Denormalized
  packagePrice: number; // Denormalized
  deliveryDays: number; // Denormalized
  startDate: string; // ISO Date string
  endDate: string; // ISO Date string
  status: OrderStatus;
  deliveryAddress: IDeliveryAddressFE; // Full address might be needed
  paymentDetails: IPaymentDetailsFE; // Full payment details might be needed
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}

// Add other Admin Panel specific types (ICategoryFE, IPackageAdminFE, etc.)
