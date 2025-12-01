// Component Type Definitions
// Based on specs/001-form-config-generator/data-model.md

import type { FieldType } from './formConfig'

// Component prop types for base components
export interface BaseInputProps {
  modelValue: string | number;
  type: Extract<FieldType, 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export interface BaseTextareaProps {
  modelValue: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  required?: boolean;
  rows?: number;
  autoResize?: boolean;
}

export interface BaseSelectProps {
  modelValue: string | string[];
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  required?: boolean;
  multiple?: boolean;
  loading?: boolean;
  onRetry?: () => void;
}

export interface SelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface BaseCheckboxProps {
  modelValue: boolean;
  label: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
}

export interface BaseRadioProps {
  modelValue: string | number;
  options: RadioOption[];
  name: string;
  label?: string;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export interface RadioOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface BaseLabelProps {
  text: string;
  required?: boolean;
  for?: string;
}

export interface BaseButtonProps {
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
}

export interface ValidationErrorProps {
  message: string;
  id?: string;
}
