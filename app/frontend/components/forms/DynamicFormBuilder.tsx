"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui";
import { Badge } from "@/components/ui";

// ─── Schema Types ────────────────────────────────────────────────────────────────

export type FieldType = 
  | "text" 
  | "email" 
  | "password" 
  | "number" 
  | "tel" 
  | "url" 
  | "textarea"
  | "select" 
  | "multiselect"
  | "checkbox" 
  | "radio" 
  | "date" 
  | "time" 
  | "datetime-local"
  | "file"
  | "range";

export interface ValidationRule {
  type: "required" | "min" | "max" | "minLength" | "maxLength" | "pattern" | "email" | "url" | "custom";
  value?: string | number;
  message: string;
  regex?: string;
  customValidator?: (value: any) => boolean | string;
}

export interface FieldOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  options?: FieldOption[];
  validation?: ValidationRule[];
  disabled?: boolean;
  readonly?: boolean;
  className?: string;
  containerClassName?: string;
  dependsOn?: {
    field: string;
    value: any;
    operator?: "equals" | "not_equals" | "contains" | "not_contains";
  };
  conditional?: {
    field: string;
    value: any;
    operator?: "equals" | "not_equals";
  };
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  accept?: string; // for file inputs
  multiple?: boolean; // for file and multiselect
}

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
  className?: string;
}

export interface DynamicFormSchema {
  id: string;
  title: string;
  description?: string;
  sections: FormSection[];
  submitButton?: {
    text: string;
    className?: string;
    disabled?: boolean;
  };
  resetButton?: {
    text: string;
    className?: string;
  };
  className?: string;
}

export interface DynamicFormBuilderProps {
  schema: DynamicFormSchema;
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  initialValues?: Record<string, any>;
  onFieldChange?: (fieldName: string, value: any, allValues: Record<string, any>) => void;
  onValidationError?: (errors: Record<string, string>) => void;
  className?: string;
  disabled?: boolean;
  readonly?: boolean;
  showValidationErrors?: boolean;
  validateOnChange?: boolean;
}

// ─── Validation Schema Builder ─────────────────────────────────────────────────────

const buildZodSchema = (fields: FormField[]): z.ZodObject<any> => {
  const shape: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let schema: z.ZodTypeAny;

    // Base schema based on field type
    switch (field.type) {
      case "text":
      case "textarea":
        schema = z.string();
        break;
      case "email":
        schema = z.string().email("Invalid email address");
        break;
      case "password":
        schema = z.string();
        break;
      case "number":
      case "range":
        schema = z.number();
        break;
      case "tel":
        schema = z.string().regex(/^[+]?[\d\s\-\(\)]+$/, "Invalid phone number");
        break;
      case "url":
        schema = z.string().url("Invalid URL");
        break;
      case "checkbox":
        schema = z.boolean();
        break;
      case "date":
      case "time":
      case "datetime-local":
        schema = z.string();
        break;
      case "select":
        schema = z.string();
        break;
      case "multiselect":
        schema = z.array(z.string());
        break;
      case "radio":
        schema = z.string();
        break;
      case "file":
        schema = field.multiple ? z.array(z.any()) : z.any();
        break;
      default:
        schema = z.string();
    }

    // Apply validation rules
    if (field.validation) {
      field.validation.forEach((rule) => {
        switch (rule.type) {
          case "required":
            if (field.type === "checkbox") {
              schema = (schema as z.ZodBoolean).refine((val: boolean) => val === true, {
                message: rule.message,
              });
            } else if (field.type === "multiselect") {
              schema = (schema as z.ZodArray<any>).min(1, { message: rule.message });
            } else {
              schema = (schema as z.ZodString).min(1, { message: rule.message });
            }
            break;
          case "min":
            if (field.type === "number" || field.type === "range") {
              schema = (schema as z.ZodNumber).min(rule.value as number, { message: rule.message });
            } else {
              schema = (schema as z.ZodString).min(rule.value as number, { message: rule.message });
            }
            break;
          case "max":
            if (field.type === "number" || field.type === "range") {
              schema = (schema as z.ZodNumber).max(rule.value as number, { message: rule.message });
            } else {
              schema = (schema as z.ZodString).max(rule.value as number, { message: rule.message });
            }
            break;
          case "minLength":
            schema = (schema as z.ZodString).min(rule.value as number, { message: rule.message });
            break;
          case "maxLength":
            schema = (schema as z.ZodString).max(rule.value as number, { message: rule.message });
            break;
          case "pattern":
            if (rule.regex) {
              schema = (schema as z.ZodString).regex(new RegExp(rule.regex), { message: rule.message });
            }
            break;
          case "custom":
            if (rule.customValidator) {
              schema = schema.refine((val: any) => {
                const result = rule.customValidator!(val);
                return result === true || result === "";
              }, { message: rule.message });
            }
            break;
        }
      });
    }

    // Handle optional fields
    if (!field.validation?.some(rule => rule.type === "required")) {
      schema = schema.optional();
    }

    // Set default value
    if (field.defaultValue !== undefined) {
      schema = schema.default(field.defaultValue);
    }

    shape[field.name] = schema;
  });

  return z.object(shape);
};

// ─── Field Components ─────────────────────────────────────────────────────────────

const FieldRenderer: React.FC<{
  field: FormField;
  control: any;
  errors: any;
  watch: any;
  setValue: any;
  disabled?: boolean;
  readonly?: boolean;
}> = ({ field, control, errors, watch, setValue, disabled, readonly }) => {
  const error = errors[field.name];
  const watchedValue = watch(field.name);

  // Check conditional visibility
  const isVisible = !field.conditional || 
    (() => {
      const dependentValue = watch(field.conditional.field);
      const operator = field.conditional.operator || "equals";
      
      switch (operator) {
        case "equals":
          return dependentValue === field.conditional.value;
        case "not_equals":
          return dependentValue !== field.conditional.value;
        default:
          return true;
      }
    })();

  if (!isVisible) {
    return null;
  }

  const renderField = () => {
    const commonProps = {
      disabled: disabled || field.disabled,
      readOnly: readonly || field.readonly,
      className: field.className,
    };

    switch (field.type) {
      case "text":
      case "email":
      case "password":
      case "tel":
      case "url":
      case "date":
      case "time":
      case "datetime-local":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <Input
                {...controllerField}
                {...commonProps}
                type={field.type}
                label={field.label}
                placeholder={field.placeholder}
                error={!!error}
                fullWidth
                containerClassName={field.containerClassName}
              />
            )}
          />
        );

      case "number":
      case "range":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className={field.containerClassName}>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {field.label}
                </label>
                <input
                  {...controllerField}
                  {...commonProps}
                  type={field.type}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className={`w-full px-4 py-2 border rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-default)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${error ? 'border-[var(--color-error)]' : ''} ${field.className || ''}`}
                  onChange={(e) => {
                    const value = field.type === "range" ? Number(e.target.value) : e.target.value;
                    controllerField.onChange(value);
                  }}
                />
              </div>
            )}
          />
        );

      case "textarea":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className={field.containerClassName}>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {field.label}
                </label>
                <textarea
                  {...controllerField}
                  {...commonProps}
                  placeholder={field.placeholder}
                  rows={field.rows || 4}
                  className={`w-full px-4 py-2 border rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-default)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 resize-none ${error ? 'border-[var(--color-error)]' : ''} ${field.className || ''}`}
                />
              </div>
            )}
          />
        );

      case "select":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className={field.containerClassName}>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {field.label}
                </label>
                <select
                  {...controllerField}
                  {...commonProps}
                  className={`w-full px-4 py-2 border rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-default)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 ${error ? 'border-[var(--color-error)]' : ''} ${field.className || ''}`}
                >
                  {field.placeholder && (
                    <option value="">{field.placeholder}</option>
                  )}
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          />
        );

      case "multiselect":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className={field.containerClassName}>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {field.label}
                </label>
                <div className="space-y-2">
                  {field.options?.map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={(controllerField.value || []).includes(option.value)}
                        onChange={(e) => {
                          const currentValue = controllerField.value || [];
                          if (e.target.checked) {
                            controllerField.onChange([...currentValue, option.value]);
                          } else {
                            controllerField.onChange(currentValue.filter((val: any) => val !== option.value));
                          }
                        }}
                        disabled={disabled || field.disabled || option.disabled}
                        className="rounded border-[var(--border-default)] bg-[var(--surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          />
        );

      case "checkbox":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className={field.containerClassName}>
                <label className="flex items-center space-x-2">
                  <input
                    {...controllerField}
                    {...commonProps}
                    type="checkbox"
                    className="rounded border-[var(--border-default)] bg-[var(--surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                  <span className="text-sm font-medium text-[var(--text-primary)]">{field.label}</span>
                </label>
              </div>
            )}
          />
        );

      case "radio":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className={field.containerClassName}>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {field.label}
                </label>
                <div className="space-y-2">
                  {field.options?.map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value={option.value}
                        checked={controllerField.value === option.value}
                        onChange={() => controllerField.onChange(option.value)}
                        disabled={disabled || field.disabled || option.disabled}
                        className="border-[var(--border-default)] bg-[var(--surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          />
        );

      case "file":
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <div className={field.containerClassName}>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  {field.label}
                </label>
                <input
                  {...controllerField}
                  {...commonProps}
                  type="file"
                  accept={field.accept}
                  multiple={field.multiple}
                  className={`w-full px-4 py-2 border rounded-lg bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-default)] file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:bg-[var(--color-primary-hover)] ${error ? 'border-[var(--color-error)]' : ''} ${field.className || ''}`}
                  value={undefined} // Reset file input
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    controllerField.onChange(field.multiple ? files : files[0]);
                  }}
                />
              </div>
            )}
          />
        );

      default:
        return (
          <Controller
            name={field.name}
            control={control}
            render={({ field: controllerField }) => (
              <Input
                {...controllerField}
                {...commonProps}
                type="text"
                label={field.label}
                placeholder={field.placeholder}
                error={!!error}
                fullWidth
                containerClassName={field.containerClassName}
              />
            )}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      {renderField()}
      {field.description && (
        <p className="text-xs text-[var(--text-muted)] mt-1">{field.description}</p>
      )}
      {error && (
        <p className="text-xs text-[var(--color-error)] mt-1">{error.message}</p>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export function DynamicFormBuilder({
  schema,
  onSubmit,
  initialValues = {},
  onFieldChange,
  onValidationError,
  className = "",
  disabled = false,
  readonly = false,
  showValidationErrors = true,
  validateOnChange = false,
}: DynamicFormBuilderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Collect all fields from all sections
  const allFields = schema.sections.flatMap(section => section.fields);
  
  // Build validation schema
  const validationSchema = buildZodSchema(allFields);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid, isDirty },
    trigger,
  } = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues: initialValues,
    mode: validateOnChange ? "onChange" : "onSubmit",
  });

  const watchedValues = watch();

  // Handle field changes
  useEffect(() => {
    if (onFieldChange) {
      const subscription = watch((value, { name, type }) => {
        if (name && type === "change") {
          onFieldChange(name, value[name], value);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [watch, onFieldChange]);

  // Handle validation errors
  useEffect(() => {
    if (showValidationErrors && Object.keys(errors).length > 0) {
      const errorMessages: Record<string, string> = {};
      Object.entries(errors).forEach(([key, error]) => {
        errorMessages[key] = (error as any)?.message || "Invalid value";
      });
      onValidationError?.(errorMessages);
    }
  }, [errors, showValidationErrors, onValidationError]);

  const onFormSubmit = async (data: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onReset = () => {
    Object.keys(initialValues).forEach(key => {
      setValue(key, initialValues[key]);
    });
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className={`space-y-6 ${className}`}>
      {schema.title && (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{schema.title}</h2>
          {schema.description && (
            <p className="mt-2 text-[var(--text-muted)]">{schema.description}</p>
          )}
        </div>
      )}

      {schema.sections.map((section) => (
        <div key={section.id} className={`space-y-4 ${section.className || ""}`}>
          {section.title && (
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{section.title}</h3>
          )}
          {section.description && (
            <p className="text-sm text-[var(--text-muted)] mb-4">{section.description}</p>
          )}
          
          <div className="space-y-4">
            {section.fields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                control={control}
                errors={errors}
                watch={watch}
                setValue={setValue}
                disabled={disabled}
                readonly={readonly}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-4 pt-6">
        {schema.submitButton && (
          <button
            type="submit"
            disabled={
              isSubmitting ||
              disabled ||
              (schema.submitButton.disabled !== false && !isValid) ||
              !isDirty
            }
            className={`px-6 py-2 rounded-lg font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${schema.submitButton.className || ""}`}
          >
            {isSubmitting ? "Submitting..." : schema.submitButton.text || "Submit"}
          </button>
        )}

        {schema.resetButton && (
          <button
            type="button"
            onClick={onReset}
            disabled={isSubmitting || disabled}
            className={`px-6 py-2 rounded-lg font-medium text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border-default)] hover:bg-[var(--surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${schema.resetButton.className || ""}`}
          >
            {schema.resetButton.text || "Reset"}
          </button>
        )}
      </div>

      {showValidationErrors && Object.keys(errors).length > 0 && (
        <div className="mt-4 p-4 bg-[var(--color-error-muted)] border border-[var(--color-error)] rounded-lg">
          <h4 className="font-medium text-[var(--color-error)] mb-2">Please fix the following errors:</h4>
          <ul className="space-y-1 text-sm text-[var(--color-error)]">
            {Object.entries(errors).map(([key, error]) => (
              <li key={key}>• {(error as any)?.message}</li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export default DynamicFormBuilder;
