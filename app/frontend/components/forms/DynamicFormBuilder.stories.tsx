import type { Meta, StoryObj } from '@storybook/react';
import { DynamicFormBuilder } from './DynamicFormBuilder';
import { userRegistrationSchema, contactSchema } from './exampleSchemas';

const meta: Meta<typeof DynamicFormBuilder> = {
  title: 'Forms/DynamicFormBuilder',
  component: DynamicFormBuilder,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: {
      control: 'object',
      description: 'Form schema defining structure and validation',
    },
    onSubmit: {
      action: 'submitted',
      description: 'Form submission handler',
    },
    onFieldChange: {
      action: 'fieldChanged',
      description: 'Field change handler',
    },
    onValidationError: {
      action: 'validationError',
      description: 'Validation error handler',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable entire form',
    },
    readonly: {
      control: 'boolean',
      description: 'Make form readonly',
    },
    showValidationErrors: {
      control: 'boolean',
      description: 'Show validation error summary',
    },
    validateOnChange: {
      control: 'boolean',
      description: 'Validate fields on change',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const mockSubmit = async (data: any) => {
  console.log('Form submitted:', data);
  await new Promise(resolve => setTimeout(resolve, 1000));
};

export const UserRegistration: Story = {
  args: {
    schema: userRegistrationSchema,
    onSubmit: mockSubmit,
    validateOnChange: true,
    showValidationErrors: true,
  },
};

export const ContactForm: Story = {
  args: {
    schema: contactSchema,
    onSubmit: mockSubmit,
    validateOnChange: true,
    showValidationErrors: true,
  },
};

export const WithInitialValues: Story = {
  args: {
    schema: contactSchema,
    onSubmit: mockSubmit,
    initialValues: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      subject: 'general',
      priority: 'medium',
      message: 'This is a pre-filled message.',
    },
    validateOnChange: true,
  },
};

export const Disabled: Story = {
  args: {
    schema: contactSchema,
    onSubmit: mockSubmit,
    disabled: true,
    initialValues: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      subject: 'general',
      priority: 'medium',
      message: 'This form is disabled.',
    },
  },
};

export const Readonly: Story = {
  args: {
    schema: contactSchema,
    onSubmit: mockSubmit,
    readonly: true,
    initialValues: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      subject: 'general',
      priority: 'medium',
      message: 'This form is readonly.',
    },
  },
};

export const WithoutValidationErrors: Story = {
  args: {
    schema: userRegistrationSchema,
    onSubmit: mockSubmit,
    validateOnChange: true,
    showValidationErrors: false,
  },
};

// Simple schema for testing individual features
const simpleSchema = {
  id: 'simple-form',
  title: 'Simple Form',
  sections: [
    {
      id: 'basic',
      fields: [
        {
          id: 'name',
          type: 'text' as const,
          label: 'Name',
          name: 'name',
          placeholder: 'Enter your name',
          validation: [
            { type: 'required' as const, message: 'Name is required' },
            { type: 'minLength' as const, value: 2, message: 'Name must be at least 2 characters' },
          ],
        },
        {
          id: 'email',
          type: 'email' as const,
          label: 'Email',
          name: 'email',
          placeholder: 'your.email@example.com',
          validation: [
            { type: 'required' as const, message: 'Email is required' },
          ],
        },
      ],
    },
  ],
  submitButton: {
    text: 'Submit Simple Form',
  },
};

export const SimpleForm: Story = {
  args: {
    schema: simpleSchema,
    onSubmit: mockSubmit,
    validateOnChange: true,
  },
};

// Schema with conditional fields
const conditionalSchema = {
  id: 'conditional-form',
  title: 'Conditional Form',
  description: 'Form with conditional field visibility',
  sections: [
    {
      id: 'conditional-section',
      fields: [
        {
          id: 'hasAccount',
          type: 'radio' as const,
          label: 'Do you have an account?',
          name: 'hasAccount',
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ],
          validation: [
            { type: 'required' as const, message: 'Please select an option' },
          ],
        },
        {
          id: 'email',
          type: 'email' as const,
          label: 'Email Address',
          name: 'email',
          placeholder: 'your.email@example.com',
          conditional: {
            field: 'hasAccount',
            value: 'yes',
          },
          validation: [
            { type: 'required' as const, message: 'Email is required' },
          ],
        },
        {
          id: 'newEmail',
          type: 'email' as const,
          label: 'New Email Address',
          name: 'newEmail',
          placeholder: 'your.email@example.com',
          conditional: {
            field: 'hasAccount',
            value: 'no',
          },
          validation: [
            { type: 'required' as const, message: 'Email is required' },
          ],
        },
      ],
    },
  ],
  submitButton: {
    text: 'Submit Conditional Form',
  },
};

export const ConditionalFields: Story = {
  args: {
    schema: conditionalSchema,
    onSubmit: mockSubmit,
    validateOnChange: true,
  },
};

// Schema with all field types
const allFieldsSchema = {
  id: 'all-fields-form',
  title: 'All Field Types',
  description: 'Demonstrates all supported field types',
  sections: [
    {
      id: 'text-fields',
      title: 'Text-based Fields',
      fields: [
        {
          id: 'textInput',
          type: 'text' as const,
          label: 'Text Input',
          name: 'textInput',
          placeholder: 'Enter text',
        },
        {
          id: 'emailInput',
          type: 'email' as const,
          label: 'Email Input',
          name: 'emailInput',
          placeholder: 'email@example.com',
        },
        {
          id: 'passwordInput',
          type: 'password' as const,
          label: 'Password Input',
          name: 'passwordInput',
          placeholder: 'Enter password',
        },
        {
          id: 'telInput',
          type: 'tel' as const,
          label: 'Phone Input',
          name: 'telInput',
          placeholder: '+1 (555) 123-4567',
        },
        {
          id: 'urlInput',
          type: 'url' as const,
          label: 'URL Input',
          name: 'urlInput',
          placeholder: 'https://example.com',
        },
        {
          id: 'textareaInput',
          type: 'textarea' as const,
          label: 'Textarea',
          name: 'textareaInput',
          placeholder: 'Enter multiple lines of text',
          rows: 4,
        },
      ],
    },
    {
      id: 'selection-fields',
      title: 'Selection Fields',
      fields: [
        {
          id: 'selectInput',
          type: 'select' as const,
          label: 'Select Dropdown',
          name: 'selectInput',
          placeholder: 'Choose an option',
          options: [
            { label: 'Option 1', value: 'option1' },
            { label: 'Option 2', value: 'option2' },
            { label: 'Option 3', value: 'option3' },
          ],
        },
        {
          id: 'multiselectInput',
          type: 'multiselect' as const,
          label: 'Multi-select',
          name: 'multiselectInput',
          options: [
            { label: 'Item 1', value: 'item1' },
            { label: 'Item 2', value: 'item2' },
            { label: 'Item 3', value: 'item3' },
          ],
        },
        {
          id: 'radioInput',
          type: 'radio' as const,
          label: 'Radio Buttons',
          name: 'radioInput',
          options: [
            { label: 'Choice A', value: 'a' },
            { label: 'Choice B', value: 'b' },
            { label: 'Choice C', value: 'c' },
          ],
        },
        {
          id: 'checkboxInput',
          type: 'checkbox' as const,
          label: 'Single Checkbox',
          name: 'checkboxInput',
        },
      ],
    },
    {
      id: 'numeric-fields',
      title: 'Numeric Fields',
      fields: [
        {
          id: 'numberInput',
          type: 'number' as const,
          label: 'Number Input',
          name: 'numberInput',
          placeholder: 'Enter a number',
          min: 0,
          max: 100,
          step: 1,
        },
        {
          id: 'rangeInput',
          type: 'range' as const,
          label: 'Range Slider',
          name: 'rangeInput',
          min: 0,
          max: 10,
          step: 1,
        },
      ],
    },
    {
      id: 'date-fields',
      title: 'Date & Time Fields',
      fields: [
        {
          id: 'dateInput',
          type: 'date' as const,
          label: 'Date Input',
          name: 'dateInput',
        },
        {
          id: 'timeInput',
          type: 'time' as const,
          label: 'Time Input',
          name: 'timeInput',
        },
        {
          id: 'datetimeInput',
          type: 'datetime-local' as const,
          label: 'Date & Time',
          name: 'datetimeInput',
        },
      ],
    },
    {
      id: 'file-fields',
      title: 'File Fields',
      fields: [
        {
          id: 'fileInput',
          type: 'file' as const,
          label: 'File Upload',
          name: 'fileInput',
          accept: '.jpg,.jpeg,.png,.pdf',
        },
        {
          id: 'multiFileInput',
          type: 'file' as const,
          label: 'Multiple Files',
          name: 'multiFileInput',
          multiple: true,
          accept: '.jpg,.jpeg,.png,.pdf,.doc,.docx',
        },
      ],
    },
  ],
  submitButton: {
    text: 'Submit All Fields',
  },
};

export const AllFieldTypes: Story = {
  args: {
    schema: allFieldsSchema,
    onSubmit: mockSubmit,
    validateOnChange: false, // Disabled for performance in Storybook
  },
};
