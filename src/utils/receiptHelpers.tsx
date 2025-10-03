export function getStatusBadge(status: string) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    processing: 'bg-blue-100 text-blue-800'
  }

  const labels = {
    pending: 'รอการอนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธแล้ว',
    processing: 'กำลังประมวลผล'
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        styles[status as keyof typeof styles]
      }`}
    >
      {labels[status as keyof typeof labels]}
    </span>
  )
}

export function extractStoreName(ocrData: any): string {
  let storeName = 'ไม่ระบุร้าน'

  if (ocrData && typeof ocrData === 'object') {
    const storeField = (ocrData as any).ชื่อร้าน || (ocrData as any)['ชื่อร้าน']
    if (storeField === true) {
      storeName = 'ตั้งหง่วงเซ้ง'
    } else if (storeField === false) {
      storeName = 'ไม่ใช่ของร้าน ตั้งหง่วงเซ้ง'
    }
  }

  return storeName
}

export function calculatePoints(totalAmount: number, bahtPerPoint: number): number {
  if (!totalAmount || !bahtPerPoint) return 0
  return Math.floor(totalAmount / bahtPerPoint)
}
