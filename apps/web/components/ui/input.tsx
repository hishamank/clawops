import * as React from "react"

import { cn } from "@/lib/utils"

const inputStyles = `
  flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm 
  ring-offset-background placeholder:text-muted-foreground 
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
  disabled:cursor-not-allowed disabled:opacity-50
  file:border-0 file:bg-transparent file:text-sm file:font-medium
`

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputStyles, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

const textareaStyles = `
  flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm 
  ring-offset-background placeholder:text-muted-foreground 
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
  disabled:cursor-not-allowed disabled:opacity-50
  resize-none
`

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaStyles, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

const selectStyles = `
  flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm 
  ring-offset-background 
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 
  disabled:cursor-not-allowed disabled:opacity-50
`

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(selectStyles, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Select.displayName = "Select"

export { Input, Textarea, Select }
