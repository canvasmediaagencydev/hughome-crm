import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { TimeSeriesData } from '@/hooks/useDashboard'

interface TimeSeriesChartProps {
  data: TimeSeriesData[]
}

const COLORS = {
  users: '#3B82F6',
  receipts: '#10B981'
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  return (
    <Card className="bg-gradient-to-br from-white to-slate-50 rounded-xl border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-slate-900 flex items-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
          แนวโน้ม 30 วันล่าสุด
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.users} stopOpacity={0.8} />
                <stop offset="95%" stopColor={COLORS.users} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="receiptGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.receipts} stopOpacity={0.8} />
                <stop offset="95%" stopColor={COLORS.receipts} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px' }} />
            <Line
              type="monotone"
              dataKey="users"
              stroke="url(#userGradient)"
              strokeWidth={3}
              name="ผู้ใช้ใหม่"
              dot={{ fill: COLORS.users, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="receipts"
              stroke="url(#receiptGradient)"
              strokeWidth={3}
              name="ใบเสร็จ"
              dot={{ fill: COLORS.receipts, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
