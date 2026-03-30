"use client";

import React, { useState } from "react";
import { DynamicFormBuilder } from "./DynamicFormBuilder";
import { 
  userRegistrationSchema, 
  eventCreationSchema, 
  surveySchema, 
  contactSchema 
} from "./exampleSchemas";
import { Badge } from "@/components/ui";

type SchemaType = "registration" | "event" | "survey" | "contact";

interface FormData {
  [key: string]: any;
}

export function DynamicFormBuilderDemo() {
  const [selectedSchema, setSelectedSchema] = useState<SchemaType>("registration");
  const [submittedData, setSubmittedData] = useState<FormData | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const schemas = {
    registration: {
      schema: userRegistrationSchema,
      title: "User Registration",
      description: "Complete form with validation and conditional fields",
    },
    event: {
      schema: eventCreationSchema,
      title: "Event Creation",
      description: "Complex form with sections, conditional logic, and file uploads",
    },
    survey: {
      schema: surveySchema,
      title: "Survey Form",
      description: "Feedback form with various input types and validation",
    },
    contact: {
      schema: contactSchema,
      title: "Contact Form",
      description: "Simple contact form with attachments",
    },
  };

  const currentSchema = schemas[selectedSchema];

  const handleSubmit = async (data: FormData) => {
    console.log("Form submitted:", data);
    setSubmittedData(data);
    setValidationErrors({});
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Show success message
    alert(`Form submitted successfully!\n\nData:\n${JSON.stringify(data, null, 2)}`);
  };

  const handleFieldChange = (fieldName: string, value: any, allValues: FormData) => {
    console.log(`Field ${fieldName} changed to:`, value, "All values:", allValues);
  };

  const handleValidationError = (errors: Record<string, string>) => {
    console.log("Validation errors:", errors);
    setValidationErrors(errors);
  };

  const handleSchemaChange = (schemaType: SchemaType) => {
    setSelectedSchema(schemaType);
    setSubmittedData(null);
    setValidationErrors({});
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-[var(--text-primary)]">
          Dynamic Form Builder
        </h1>
        <p className="text-lg text-[var(--text-muted)] max-w-3xl mx-auto">
          A powerful form builder that creates dynamic forms from JSON schemas with 
          real-time validation, conditional fields, and multiple input types.
        </p>
      </div>

      {/* Schema Selector */}
      <div className="bg-[var(--surface-elevated)] rounded-xl p-6 border border-[var(--border-default)]">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          Select Form Type
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(schemas).map(([key, config]) => (
            <button
              key={key}
              onClick={() => handleSchemaChange(key as SchemaType)}
              className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                selectedSchema === key
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-muted)]"
                  : "border-[var(--border-default)] hover:border-[var(--color-primary)] hover:bg-[var(--surface)]"
              }`}
            >
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                {config.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                {config.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Current Form Info */}
      <div className="bg-[var(--surface-elevated)] rounded-xl p-6 border border-[var(--border-default)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {currentSchema.title}
            </h2>
            <p className="text-[var(--text-muted)] mt-1">
              {currentSchema.description}
            </p>
          </div>
          <Badge variant="info">
            {currentSchema.schema.sections.length} sections, {currentSchema.schema.sections.reduce((acc, section) => acc + section.fields.length, 0)} fields
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border-default)]">
            <DynamicFormBuilder
              schema={currentSchema.schema}
              onSubmit={handleSubmit}
              onFieldChange={handleFieldChange}
              onValidationError={handleValidationError}
              showValidationErrors={true}
              validateOnChange={true}
              className="space-y-6"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Validation Errors */}
          {Object.keys(validationErrors).length > 0 && (
            <div className="bg-[var(--color-error-muted)] border border-[var(--color-error)] rounded-xl p-4">
              <h3 className="font-semibold text-[var(--color-error)] mb-3">
                Validation Errors
              </h3>
              <div className="space-y-2">
                {Object.entries(validationErrors).map(([field, message]) => (
                  <div key={field} className="text-sm">
                    <span className="font-medium text-[var(--color-error)]">{field}:</span>
                    <span className="text-[var(--color-error)] ml-2">{message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submitted Data */}
          {submittedData && (
            <div className="bg-[var(--color-success-muted)] border border-[var(--color-success)] rounded-xl p-4">
              <h3 className="font-semibold text-[var(--color-success)] mb-3">
                Submitted Data
              </h3>
              <pre className="text-xs overflow-auto max-h-96 bg-[var(--surface)] p-3 rounded border border-[var(--border-default)]">
                {JSON.stringify(submittedData, null, 2)}
              </pre>
            </div>
          )}

          {/* Form Features */}
          <div className="bg-[var(--surface-elevated)] rounded-xl p-4 border border-[var(--border-default)]">
            <h3 className="font-semibold text-[var(--text-primary)] mb-3">
              Form Features
            </h3>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>
                Real-time validation
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>
                Conditional field visibility
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>
                Multiple input types
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>
                Custom validation rules
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>
                File upload support
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>
                Structured data output
              </li>
            </ul>
          </div>

          {/* Schema Info */}
          <div className="bg-[var(--surface-elevated)] rounded-xl p-4 border border-[var(--border-default)]">
            <h3 className="font-semibold text-[var(--text-primary)] mb-3">
              Schema Structure
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Sections:</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {currentSchema.schema.sections.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Total Fields:</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {currentSchema.schema.sections.reduce((acc, section) => acc + section.fields.length, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Required Fields:</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {currentSchema.schema.sections.reduce((acc, section) => 
                    acc + section.fields.filter(field => 
                      field.validation?.some(rule => rule.type === "required")
                    ).length, 0
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Conditional Fields:</span>
                <span className="text-[var(--text-primary)] font-medium">
                  {currentSchema.schema.sections.reduce((acc, section) => 
                    acc + section.fields.filter(field => field.conditional).length, 0
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-[var(--surface-elevated)] rounded-xl p-6 border border-[var(--border-default)]">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
          How to Use DynamicFormBuilder
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-[var(--text-primary)] mb-2">Basic Usage</h3>
            <pre className="text-xs bg-[var(--surface)] p-3 rounded border border-[var(--border-default)] overflow-auto">
{`import { DynamicFormBuilder } from './DynamicFormBuilder';

<DynamicFormBuilder
  schema={formSchema}
  onSubmit={handleSubmit}
  initialValues={defaultValues}
  onFieldChange={handleFieldChange}
  onValidationError={handleErrors}
/>`}
            </pre>
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)] mb-2">Schema Structure</h3>
            <pre className="text-xs bg-[var(--surface)] p-3 rounded border border-[var(--border-default)] overflow-auto">
{`interface DynamicFormSchema {
  id: string;
  title: string;
  sections: FormSection[];
}

interface FormSection {
  id: string;
  title?: string;
  fields: FormField[];
}

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  name: string;
  validation?: ValidationRule[];
  conditional?: ConditionalRule;
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DynamicFormBuilderDemo;
