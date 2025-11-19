import { GoogleGenAI } from '@google/genai'
import mime from 'mime'

interface OCRResult {
  ชื่อร้าน: boolean
  ยอดรวม: number
  วันที่: string
  ความถูกต้อง: number
}

async function processReceiptInternal(base64: string, mimeType: string): Promise<OCRResult> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  try {
    // Initialize Google GenAI
    const ai = new GoogleGenAI({
      apiKey: apiKey,
    })

    // Configure the model
    const config = {
      thinkingConfig: {
        thinkingBudget: 0,
      },
    }

    const model = 'gemini-2.5-pro'

    // Prepare the content
    const contents = [
      {
        role: 'user' as const,
        parts: [
          {
            text: `คุณเป็น AI ผู้เชี่ยวชาญในการอ่านข้อมูลจากใบเสร็จภาษาไทย กรุณาวิเคราะห์ภาพใบเสร็จที่ให้มาอย่างละเอียด และสรุปข้อมูลเป็น JSON เท่านั้น

**คำแนะนำสำคัญ:**
- อ่านข้อความทั้งหมดในรูปภาพอย่างละเอียด แม้ว่ารูปจะไม่ชัด เบลอ หรือมีแสงสะท้อน
- ถ้ารูปหมุนหรือเอียง ให้พยายามอ่านข้อความให้ได้
- มองหา "ยอดรวม", "รวมทั้งสิ้น", "Total", "TOTAL" เพื่อหายอดเงินสุดท้าย
- ตรวจสอบชื่อร้านว่าเป็น "ตั้งหง่วงเซ้ง" หรือมีคำว่า "TH" / "th" หรือไม่
- วันที่อาจอยู่ในรูปแบบ dd/mm/yyyy (พ.ศ. หรือ ค.ศ.) หรือ "วันที่ xx เดือน xxxx ปี xxxx"

**รูปแบบ JSON ที่ต้องการ:**
{
  "ชื่อร้าน": true/false,
  "ยอดรวม": <ตัวเลขยอดรวมสุดท้าย เช่น 1040.00 (ห้ามใส่เครื่องหมายบาทหรือคอมม่า)>,
  "วันที่": "<วันที่จากใบเสร็จ ในรูปแบบ dd/mm/yyyy หรือ dd/mm/พ.ศ.>",
  "ความถูกต้อง": <ความมั่นใจ 0.0-1.0 เช่น 0.95>
}

**ตัวอย่าง Output:**
{
  "ชื่อร้าน": true,
  "ยอดรวม": 1250.50,
  "วันที่": "15/03/2567",
  "ความถูกต้อง": 0.92
}

กรุณาส่งคืนเฉพาะ JSON เท่านั้น ไม่ต้องมีคำอธิบายเพิ่มเติม`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64
            }
          }
        ]
      }
    ]

    // Generate content
    const response = await ai.models.generateContent({
      model,
      config,
      contents,
    })

    // Extract text response from Gemini API
    let textResponse: string
    if (response.candidates &&
        response.candidates[0] &&
        response.candidates[0].content &&
        response.candidates[0].content.parts &&
        response.candidates[0].content.parts[0] &&
        response.candidates[0].content.parts[0].text) {
      textResponse = response.candidates[0].content.parts[0].text
    } else {
      throw new Error('No valid response from API')
    }

    if (!textResponse) {
      throw new Error('No response text from API')
    }

    // Parse JSON from response
    let ocrResult: OCRResult
    try {
      // Clean the response to extract JSON
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      ocrResult = JSON.parse(jsonMatch[0])
    } catch (parseError) {
      console.error('Failed to parse response:', textResponse)
      throw new Error('Invalid JSON response')
    }

    // Validate the response structure
    if (
      typeof ocrResult.ชื่อร้าน !== 'boolean' ||
      typeof ocrResult.ยอดรวม !== 'number' ||
      typeof ocrResult.วันที่ !== 'string' ||
      typeof ocrResult.ความถูกต้อง !== 'number'
    ) {
      throw new Error('Invalid response structure')
    }

    // Ensure confidence is between 0 and 1
    if (ocrResult.ความถูกต้อง > 1) {
      ocrResult.ความถูกต้อง = ocrResult.ความถูกต้อง / 100
    }

    return ocrResult

  } catch (error) {
    console.error('OCR error:')
    throw error
  }
}

// Main function that accepts File object
export async function processReceiptWithGemini(imageFile: File): Promise<OCRResult> {
  try {
    // Convert file to base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Get MIME type
    const mimeType = imageFile.type || mime.getType(imageFile.name) || 'image/jpeg'

    return await processReceiptInternal(base64, mimeType)
  } catch (error) {
    console.error('OCR error from file:')
    throw error
  }
}

// Function that accepts Buffer (for re-processing from storage)
export async function processReceiptFromBuffer(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<OCRResult> {
  try {
    // Convert buffer to base64
    const base64 = imageBuffer.toString('base64')

    return await processReceiptInternal(base64, mimeType)
  } catch (error) {
    console.error('OCR error from buffer:')
    throw error
  }
}

export function convertThaiDateToISO(thaiDate: string): string | null {
  try {
    // Handle different Thai date formats
    // Examples: "15/09/2567", "15-09-2567", "15 ก.ย. 2567"

    // Simple dd/mm/yyyy or dd-mm-yyyy format
    const simpleMatch = thaiDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)

    if (simpleMatch) {
      const [, day, month, year] = simpleMatch
      const gregorianYear = parseInt(year) > 2400 ? parseInt(year) - 543 : parseInt(year)

      // Create ISO date string (YYYY-MM-DD)
      const isoDate = `${gregorianYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

      // Validate the date
      const dateObj = new Date(isoDate)
      if (dateObj.toISOString().slice(0, 10) === isoDate) {
        return isoDate
      }
    }

    return null
  } catch (error) {
    console.error('Date conversion error:', error)
    return null
  }
}