import { useState } from 'react'
import { axiosAdmin } from '@/lib/axios-admin'

export interface UserNote {
  id: string
  note_content: string
  created_at: string
  updated_at: string | null
  created_by: string
  created_by_admin_id: string | null
  created_by_admin?: {
    id: string
    full_name: string | null
    email: string | null
  } | null
  user_profiles: {
    id: string
    display_name: string | null
    picture_url: string | null
  }
}

export interface NotesPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function useUserNotes() {
  const [notes, setNotes] = useState<UserNote[]>([])
  const [pagination, setPagination] = useState<NotesPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [submittingNote, setSubmittingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editNoteContent, setEditNoteContent] = useState('')

  const fetchNotes = async (userId: string, page: number = 1) => {
    setLoadingNotes(true)
    try {
      const response = await axiosAdmin.get(
        `/api/admin/users/${userId}/notes?page=${page}&limit=${pagination.limit}`
      )

      setNotes(response.data.notes || [])
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching notes:', error)
      alert('ไม่สามารถโหลดบันทึกได้')
    } finally {
      setLoadingNotes(false)
    }
  }

  const addNote = async (userId: string, onSuccess?: () => void) => {
    if (!newNoteContent.trim()) {
      alert('กรุณากรอกข้อความบันทึก')
      return
    }

    setSubmittingNote(true)
    setSubmittingNote(true)
    try {
      const response = await axiosAdmin.post(`/api/admin/users/${userId}/notes`, {
        note_content: newNoteContent
      })

      const data = response.data

      // Add new note to the beginning of the list
      setNotes([data.note, ...notes])
      setNewNoteContent('')

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('ไม่สามารถเพิ่มบันทึกได้')
    } finally {
      setSubmittingNote(false)
    }
  }

  const updateNote = async (userId: string, noteId: string, onSuccess?: () => void) => {
    if (!editNoteContent.trim()) {
      alert('กรุณากรอกข้อความบันทึก')
      return
    }

    setSubmittingNote(true)
    setSubmittingNote(true)
    try {
      const response = await axiosAdmin.patch(`/api/admin/users/${userId}/notes/${noteId}`, {
        note_content: editNoteContent
      })

      const data = response.data

      // Update note in the list
      setNotes(notes.map(note =>
        note.id === noteId ? data.note : note
      ))

      setEditingNoteId(null)
      setEditNoteContent('')

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error updating note:', error)
      alert('ไม่สามารถแก้ไขบันทึกได้')
    } finally {
      setSubmittingNote(false)
    }
  }

  const deleteNote = async (userId: string, noteId: string, onSuccess?: () => void) => {
    if (!confirm('คุณต้องการลบบันทึกนี้ใช่หรือไม่?')) {
      return
    }

    try {
      await axiosAdmin.delete(`/api/admin/users/${userId}/notes/${noteId}`)

      // Remove note from the list
      setNotes(notes.filter(note => note.id !== noteId))

      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('ไม่สามารถลบบันทึกได้')
    }
  }

  const startEditing = (note: UserNote) => {
    setEditingNoteId(note.id)
    setEditNoteContent(note.note_content)
  }

  const cancelEditing = () => {
    setEditingNoteId(null)
    setEditNoteContent('')
  }

  const handlePageChange = async (userId: string, newPage: number) => {
    await fetchNotes(userId, newPage)
  }

  return {
    notes,
    pagination,
    loadingNotes,
    submittingNote,
    newNoteContent,
    setNewNoteContent,
    editingNoteId,
    editNoteContent,
    setEditNoteContent,
    fetchNotes,
    addNote,
    updateNote,
    deleteNote,
    startEditing,
    cancelEditing,
    handlePageChange,
  }
}
