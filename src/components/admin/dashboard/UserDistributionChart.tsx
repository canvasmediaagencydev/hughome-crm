import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartData } from '@/hooks/useDashboard'

interface UserDistributionChartProps {
  data: ChartData[]
}

const COLORS = ['#3B82F6', '#10B981']

export function UserDistributionChart({ data }: UserDistributionChartProps) {
  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">การกระจายตัวผู้ใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: any) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
