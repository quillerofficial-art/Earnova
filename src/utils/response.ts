import { Response } from 'express'
import { ApiResponse, PaginatedResponse } from '../types/api'

export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  status: number = 200
) => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  }
  return res.status(status).json(response)
}

export const errorResponse = (
  res: Response,
  message: string,
  status: number = 400,
  errors?: string[]
) => {
  const response: ApiResponse = {
    success: false,
    message,
    error: message,
    errors,
  }
  return res.status(status).json(response)
}

export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
) => {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
  return res.status(200).json(response)
}