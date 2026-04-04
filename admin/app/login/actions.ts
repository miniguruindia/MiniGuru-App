'use server'

import { setAuthCookie } from '@/utils/auth'
import { redirect } from 'next/navigation'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  console.log('Login action called with:', email)
  
  try {
    // Call the backend login
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
    
    console.log('Backend response status:', response.status)
    
    if (!response.ok) {
      console.log('Login failed with status:', response.status)
      throw new Error('Invalid credentials')
    }
    
    const data = await response.json()
    const accessToken = data.accessToken
    
    console.log('Token received, setting cookie')
    
    // Set the cookie
    await setAuthCookie(accessToken)
    
    console.log('Cookie set, redirecting to /')
    
    // Redirect to home
    redirect('/')
  } catch (error) {
    console.error('Login action error:', error)
    throw error
  }
}