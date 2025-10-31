// Redemption-related type definitions

export interface Redemption {
  id: string;
  points_used: number;
  status: string;
  shipping_address: string | null;
  tracking_number: string | null;
  created_at: string;
  rewards: {
    name: string;
    image_url: string | null;
  };
}

export interface RedemptionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
