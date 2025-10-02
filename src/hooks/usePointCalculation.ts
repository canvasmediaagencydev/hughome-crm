import { useState, useEffect } from 'react'
import { PointSetting } from '@/types'

export function usePointCalculation() {
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)

  useEffect(() => {
    const fetchPointSetting = async () => {
      try {
        const response = await fetch('/api/admin/point-settings')
        if (response.ok) {
          const data = await response.json()
          const bahtSetting = data.find((s: PointSetting) => s.setting_key === 'baht_per_point')
          setPointSetting(bahtSetting)
        }
      } catch (error) {
        console.error('Failed to fetch point setting:', error)
      }
    }

    fetchPointSetting()
  }, [])

  const calculatePoints = (totalAmount: number): number => {
    if (!pointSetting || !totalAmount) return 0
    return Math.floor(totalAmount / pointSetting.setting_value)
  }

  return {
    pointSetting,
    calculatePoints
  }
}
