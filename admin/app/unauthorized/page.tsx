import React from 'react'

export default function UnauthorizedPage() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md text-center">
          <h1 className="text-3xl text-red-600 mb-4">Unauthorized Access</h1>
          <p className="mb-4">You do not have permission to access this page.</p>
          <a 
            href="/dashboard/login" 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Return to Login
          </a>
        </div>
      </div>
    );
  }