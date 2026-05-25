'use client'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variants = {
  primary:   'bg-[#FBBF24] text-[#070708] hover:bg-[#F59E0B] font-semibold',
  secondary: 'bg-[#27272A] text-[#F4F4F5] hover:bg-[#3F3F46] border border-[#3F3F46]',
  ghost:     'bg-transparent text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#F4F4F5]',
  danger:    'bg-[#EF4444] text-white hover:bg-[#DC2626] font-semibold',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, disabled, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-[4px] transition-all duration-200 cursor-pointer select-none
        ${variants[variant]} ${sizes[size]}
        ${disabled ? 'opacity-40 pointer-events-none' : 'hover:scale-[1.02] active:scale-[0.97]'}
        ${className}`}
      {...props}
    >
      {children}
    </button>
  )
)
Button.displayName = 'Button'
