import { memo, ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  className?: string
}

export const EmptyState = memo(({
  icon,
  title,
  description,
  className = ''
}: EmptyStateProps) => {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <p className="text-gray-500 text-lg font-medium mb-2">{title}</p>
      {description && (
        <p className="text-gray-400 text-sm">{description}</p>
      )}
    </div>
  )
})
EmptyState.displayName = 'EmptyState'
