import { API_URL } from '../api/client'

export function getImageUrl(image) {
  if (!image) {
    return `${API_URL}/uploads/products/hero1.jpeg`
  }

  if (image.startsWith('http')) {
    return image
  }

  if (image.startsWith('images/')) {
    return `/${image}`
  }

  return `${API_URL}/${image.replace(/^\/+/, '')}`
}
