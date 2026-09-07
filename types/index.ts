export interface ColorImages {
  cover?: string;
  gallery?: string[];
}

export interface ProductImages {
  cover: string;            // default cover shown on shop listing cards
  gallery: string[];        // default gallery — used when no colour-specific images exist
  colors?: Record<string, ColorImages>;  // per-colour overrides
}

export interface Product {
  id: string;
  name: string;
  price: number;            // pence (e.g. 2000 = £20.00)
  description: string;
  details: string[];
  images: ProductImages;
  category: string;
  sizes: string[];
  colors: string[];
  colorHex?: Record<string, string>;  // per-colour accent hex, e.g. { "Forest Green": "#2A4A1E" }
  featured: boolean;
  stripePriceId?: string;   // optional — set once you've created the product in Stripe
  // ERPNext parent item name, e.g. "Staple Tee" — combined with the selected
  // colour/size ("Staple Tee-Grass-S") to look up live stock. Leave unset to
  // skip stock checks entirely for this product (always purchasable).
  erpItemPrefix?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  cover: string;
  description: string;
  lat?: number;
  lng?: number;
}

export interface Review {
  id: string;
  productId: string;
  name: string;
  rating: number;   // 0.5 increments, 0.5–5.0
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

export type SocialContentType = 'photo' | 'video' | 'carousel';

export interface SocialPlatforms {
  instagram: boolean;
  tiktok: boolean;
  youtube: boolean;
  x: boolean;
  mastodon: boolean;
  pinterest: boolean;
}

export interface SocialSlide {
  url: string;
  thumbnailUrl?: string; // JPEG still for videos
}

export interface SocialPost {
  id: string;
  title: string;
  caption: string;
  type: SocialContentType;
  date: string;
  fileUrl?: string;      // photo/video: the file; carousel: first slide url (for list thumbnail)
  thumbnailUrl?: string; // video/carousel: still frame of first slide
  slides?: SocialSlide[]; // carousel only
  platforms: SocialPlatforms;
  notes: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  size: string;
  color: string;
}

export interface Promotion {
  id: string;
  label: string;
  discountPercent: number;
  scope: 'all' | 'products';
  productIds?: string[];   // only used when scope === 'products'
  startDate: string;       // 'YYYY-MM-DD'
  endDate: string;         // 'YYYY-MM-DD', inclusive
}

export interface UniversitySubmission {
  id: string;
  studentName: string;
  studentEmail: string;
  garment: string;
  placement: string;
  photo?: string;
  colour: string;
  note?: string;
  completed: boolean;
  createdAt: string;
}
