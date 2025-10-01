interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = 'กำลังโหลด...' }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}
