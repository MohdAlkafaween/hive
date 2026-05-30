'use client'
import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface Student {
  id: number
  fullName: string
  phone: string
  major: string | null
  rfidUuid: string | null
}

interface SearchBarProps {
  onSelect: (student: Student) => void
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (query.trim().length >= 2) {
      fetch(`/api/students/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          setStudents(data)
          setIsOpen(true)
        })
    } else {
      setStudents([])
      setIsOpen(false)
    }
  }, [query])

  const handleSelect = (student: Student) => {
    onSelect(student)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-full z-50">
      <Search className="w-5 h-5 text-gray-500 absolute left-4 top-3.5" />
      <input
        ref={inputRef}
        type="text"
        placeholder={t('dash.searchPlaceholderLong')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (query.trim().length >= 2) setIsOpen(true) }}
        className="w-full bg-[#1A1A1A] border-2 border-[#2C2C2C] focus:border-[#F5C518] hover:border-[#444] rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none placeholder-gray-500 font-medium tracking-wide shadow-lg transition-all focus:shadow-[0_0_0_4px_rgba(245,197,24,0.12),0_0_20px_rgba(245,197,24,0.08)]"
        autoComplete="off"
      />

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1E1E1E] border-2 border-[#F5C518]/30 rounded-xl shadow-2xl overflow-hidden max-h-[290px] overflow-y-auto">
          <div className="px-4 py-2 bg-black/20 border-b border-[#2C2C2C] text-[10px] font-mono text-gray-400 select-none uppercase tracking-wide">
            {t('dash.matchedStudents')} ({students.length}) • {t('dash.clickToSelect')}
          </div>

          {students.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-xs font-mono">
              {t('dash.noMatchFound')}
            </div>
          ) : (
            <div className="divide-y divide-[#2C2C2C]">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleSelect(student)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#282828] transition-all text-left"
                >
                  <div className="flex flex-col truncate pr-4 leading-tight">
                    <span className="font-bold text-gray-200 text-sm">{student.fullName}</span>
                    <div className="flex items-center gap-2 mt-1 font-mono text-[9px] text-gray-500 font-semibold uppercase">
                      <span>{t('dash.phone')}: {student.phone}</span>
                      {student.major && (
                        <>
                          <span>•</span>
                          <span>{t('dash.major')}: {student.major}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
