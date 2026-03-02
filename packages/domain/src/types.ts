export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}
