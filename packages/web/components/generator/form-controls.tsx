'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

/** DOM id of the control bound to a form path, such as `tools.0.url`. */
export const controlId = (path: string): string => `field-${path}`;

function describedBy(path: string, hint: ReactNode, error: string | undefined): string | undefined {
  const ids = [
    hint === undefined ? '' : `${controlId(path)}-hint`,
    error === undefined ? '' : `${controlId(path)}-error`,
  ];
  return ids.filter(Boolean).join(' ') || undefined;
}

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'id' | 'name'> {
  path: string;
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  error: string | undefined;
  onValueChange: (value: string) => void;
}

/** A labelled text input. Its `name` is the form path, so blurring it marks that path as visited. */
export function TextField({ path, label, hint, value, error, onValueChange, ...inputProps }: TextFieldProps) {
  const id = controlId(path);
  return (
    <Field data-invalid={error === undefined ? undefined : true}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={path}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy(path, hint, error)}
        {...inputProps}
      />
      {hint === undefined ? null : <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

interface SelectFieldProps<Value extends string> {
  path: string;
  label: ReactNode;
  value: Value;
  options: readonly Value[];
  /** Shown instead of the raw values, when they are not meant to be read as code. */
  labels?: Record<Value, string>;
  error?: string | undefined;
  onValueChange: (value: Value) => void;
}

export function SelectField<Value extends string>({
  path,
  label,
  value,
  options,
  labels,
  error,
  onValueChange,
}: SelectFieldProps<Value>) {
  const id = controlId(path);
  const items = options.map((option) => ({ label: labels?.[option] ?? option, value: option }));
  return (
    <Field data-invalid={error === undefined ? undefined : true}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={error === undefined ? undefined : true}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

interface SwitchFieldProps {
  path: string;
  label: ReactNode;
  hint: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function SwitchField({ path, label, hint, checked, onCheckedChange }: SwitchFieldProps) {
  const id = controlId(path);
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} aria-describedby={`${id}-hint`} />
    </Field>
  );
}
