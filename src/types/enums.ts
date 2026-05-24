export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// TreePosition हटा दिया (अब left/right नहीं)

export enum OtpPurpose {
  SIGNUP = 'signup',
  FORGOT = 'forgot',
}

export enum PaymentStatus {
  CREATED = 'created',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum ProductCategory {
  BANNER = 'banner',
  FEATURED = 'featured',
  NEW_ARRIVAL = 'new_arrival',
}