import type React from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

interface FormFieldListProps {
  children: ReactNode;
  onSubmit?: () => void | Promise<void>;
}

export function FormFieldList({ children, onSubmit }: FormFieldListProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit?.();
  };

  return (
    <form className="flex w-full max-w-3xl flex-col items-center justify-start gap-spacing-400" onSubmit={handleSubmit}>
      {children}
    </form>
  );
}

interface FormFieldProps {
  title: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ title, description, required, children }: FormFieldProps) {
  return (
    <div className="flex w-full flex-col items-start justify-center gap-spacing-400 rounded-radius-400 border border-line-outline bg-components-fill-standard-primary px-spacing-500 py-spacing-400">
      <div className="flex w-full flex-col items-start justify-center gap-spacing-50">
        <span className="font-semibold text-title">
          {title}
          <span className="text-core-accent">{required && "*"}</span>
        </span>
        {description && (
          <span className="whitespace-pre-wrap text-content-standard-secondary text-label">{description}</span>
        )}
      </div>
      {children}
    </div>
  );
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  type?: string;
  onChange?: (value: string) => void;
}

export function TextInput({ type = "text", onChange, ...props }: TextInputProps) {
  return (
    <input
      className={
        "w-full cursor-pointer rounded-radius-400 border border-line-outline bg-components-fill-standard-secondary px-spacing-400 py-spacing-300 text-body text-content-standard-primary outline-none duration-100 placeholder:text-content-standard-tertiary focus:border-core-accent focus:ring-1 focus:ring-core-accent"
      }
      type={type}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    />
  );
}

interface RichTextInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  onChange?: (value: string) => void;
}

export function RichTextInput({ onChange, ...props }: RichTextInputProps) {
  return (
    <textarea
      className={
        "min-h-[180px] w-full cursor-pointer resize-none rounded-radius-400 border border-line-outline bg-components-fill-standard-secondary px-spacing-400 py-spacing-300 text-body text-content-standard-primary leading-6 outline-none duration-100 placeholder:text-content-standard-tertiary focus:border-core-accent focus:ring-1 focus:ring-core-accent"
      }
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    />
  );
}

interface SelectOptionProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: string[];
  onChange?: (value: string) => void;
}

export function SelectOption({ options, onChange, ...props }: SelectOptionProps) {
  return (
    <select
      className={
        "w-full cursor-pointer appearance-none rounded-radius-400 border border-line-outline bg-components-fill-standard-secondary px-spacing-400 py-spacing-300 text-body outline-none duration-100 placeholder:text-content-standard-tertiary focus:border-core-accent focus:ring-1 focus:ring-core-accent"
      }
      onChange={(e) => onChange?.(e.target.value)}
      {...props}>
      <option value="" hidden>
        선택해 주세요.
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

interface RadioOptionProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  options: string[];
  onChange?: (value: string) => void;
  value?: string;
}

export function RadioOption({ options, onChange, value, name, ...props }: RadioOptionProps) {
  return (
    <div className="flex w-full flex-col gap-spacing-200">
      {options.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-spacing-300 rounded-radius-400 border border-line-outline bg-components-fill-standard-secondary px-spacing-400 py-spacing-300 text-body duration-100 hover:border-core-accent hover:ring-1 hover:ring-core-accent">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={(e) => onChange?.(e.target.value)}
            className="accent-core-accent"
            {...props}
          />
          <span className="text-body">{option}</span>
        </label>
      ))}
    </div>
  );
}

interface CheckboxOptionProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  label: string;
  onChange?: (checked: boolean) => void;
  checked?: boolean;
}

export function CheckboxOption({ label, onChange, checked, ...props }: CheckboxOptionProps) {
  return (
    <label className="flex w-full cursor-pointer items-center gap-spacing-300 rounded-radius-400 border border-line-outline bg-components-fill-standard-secondary px-spacing-400 py-spacing-300 text-body duration-100 hover:border-core-accent hover:ring-1 hover:ring-core-accent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="accent-core-accent"
        {...props}
      />
      <span className="text-body">{label}</span>
    </label>
  );
}
