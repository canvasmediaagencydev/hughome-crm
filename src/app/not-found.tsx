export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">ไม่พบหน้าที่ต้องการ</h2>
        <p className="text-gray-600 mb-4">หน้าที่คุณค้นหาไม่มีอยู่</p>
        <a 
          href="/" 
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
        >
          กลับหน้าหลัก
        </a>
      </div>
    </div>
  )
}