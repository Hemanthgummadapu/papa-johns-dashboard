interface StatusBadgeProps {
  isGood: boolean
  label?: string
}

export default function StatusBadge({ isGood, label }: StatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full ${
          isGood ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      {label && (
        <span className={`text-sm ${isGood ? 'text-green-400' : 'text-red-400'}`}>
          {label}
        </span>
      )}
    </div>
  )
}

