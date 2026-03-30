import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicFormBuilder } from './DynamicFormBuilder';

// Mock schemas
const simpleSchema = {
  id: 'test-form',
  title: 'Test Form',
  sections: [
    {
      id: 'basic-section',
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
    text: 'Submit Form',
  },
};

const conditionalSchema = {
  id: 'conditional-form',
  title: 'Conditional Form',
  sections: [
    {
      id: 'conditional-section',
      fields: [
        {
          id: 'showEmail',
          type: 'checkbox' as const,
          label: 'Show email field',
          name: 'showEmail',
        },
        {
          id: 'email',
          type: 'email' as const,
          label: 'Email',
          name: 'email',
          placeholder: 'your.email@example.com',
          conditional: {
            field: 'showEmail',
            value: true,
          },
          validation: [
            { type: 'required' as const, message: 'Email is required' },
          ],
        },
      ],
    },
  ],
  submitButton: {
    text: 'Submit Form',
  },
};

const multiSelectSchema = {
  id: 'multiselect-form',
  title: 'Multi-select Form',
  sections: [
    {
      id: 'multiselect-section',
      fields: [
        {
          id: 'interests',
          type: 'multiselect' as const,
          label: 'Interests',
          name: 'interests',
          options: [
            { label: 'Music', value: 'music' },
            { label: 'Sports', value: 'sports' },
            { label: 'Technology', value: 'technology' },
          ],
          validation: [
            { type: 'required' as const, message: 'Please select at least one interest' },
          ],
        },
      ],
    },
  ],
  submitButton: {
    text: 'Submit Form',
  },
};

describe('DynamicFormBuilder', () => {
  const mockSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form title and description', () => {
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockSubmit} />);
    
    expect(screen.getByText('Test Form')).toBeInTheDocument();
  });

  it('renders form fields correctly', () => {
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockSubmit} />);
    
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup();
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockSubmit} />);
    
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockSubmit} />);
    
    const nameInput = screen.getByLabelText('Name');
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john.doe@example.com');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john.doe@example.com',
      });
    });
  });

  it('validates minimum length', async () => {
    const user = userEvent.setup();
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockSubmit} />);
    
    const nameInput = screen.getByLabelText('Name');
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    
    await user.type(nameInput, 'J');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
    });
  });

  it('handles conditional field visibility', async () => {
    const user = userEvent.setup();
    render(<DynamicFormBuilder schema={conditionalSchema} onSubmit={mockSubmit} />);
    
    const checkbox = screen.getByLabelText('Show email field');
    
    // Initially email field should not be visible
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    
    // Check the checkbox
    await user.click(checkbox);
    
    // Now email field should be visible
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
    
    // Uncheck the checkbox
    await user.click(checkbox);
    
    // Email field should be hidden again
    await waitFor(() => {
      expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    });
  });

  it('handles multi-select fields', async () => {
    const user = userEvent.setup();
    render(<DynamicFormBuilder schema={multiSelectSchema} onSubmit={mockSubmit} />);
    
    const musicCheckbox = screen.getByLabelText('Music');
    const sportsCheckbox = screen.getByLabelText('Sports');
    
    await user.click(musicCheckbox);
    await user.click(sportsCheckbox);
    
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        interests: ['music', 'sports'],
      });
    });
  });

  it('validates multi-select required field', async () => {
    const user = userEvent.setup();
    render(<DynamicFormBuilder schema={multiSelectSchema} onSubmit={mockSubmit} />);
    
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please select at least one interest')).toBeInTheDocument();
    });
  });

  it('calls onFieldChange when field values change', async () => {
    const user = userEvent.setup();
    const mockFieldChange = jest.fn();
    
    render(
      <DynamicFormBuilder 
        schema={simpleSchema} 
        onSubmit={mockSubmit}
        onFieldChange={mockFieldChange}
      />
    );
    
    const nameInput = screen.getByLabelText('Name');
    await user.type(nameInput, 'John');
    
    await waitFor(() => {
      expect(mockFieldChange).toHaveBeenCalledWith('name', 'John', expect.any(Object));
    });
  });

  it('calls onValidationError when validation fails', async () => {
    const user = userEvent.setup();
    const mockValidationError = jest.fn();
    
    render(
      <DynamicFormBuilder 
        schema={simpleSchema} 
        onSubmit={mockSubmit}
        onValidationError={mockValidationError}
        showValidationErrors={false}
      />
    );
    
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockValidationError).toHaveBeenCalledWith({
        name: 'Name is required',
        email: 'Email is required',
      });
    });
  });

  it('respects disabled state', () => {
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockSubmit} disabled />);
    
    const nameInput = screen.getByLabelText('Name');
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    
    expect(nameInput).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('respects readonly state', () => {
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockSubmit} readonly />);
    
    const nameInput = screen.getByLabelText('Name');
    const emailInput = screen.getByLabelText('Email');
    
    expect(nameInput).toHaveAttribute('readonly');
    expect(emailInput).toHaveAttribute('readonly');
  });

  it('applies initial values', () => {
    const initialValues = {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    };
    
    render(
      <DynamicFormBuilder 
        schema={simpleSchema} 
        onSubmit={mockSubmit}
        initialValues={initialValues}
      />
    );
    
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    
    expect(nameInput.value).toBe('Jane Doe');
    expect(emailInput.value).toBe('jane.doe@example.com');
  });

  it('handles reset button', async () => {
    const user = userEvent.setup();
    const initialValues = {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    };
    
    const schemaWithReset = {
      ...simpleSchema,
      resetButton: {
        text: 'Reset Form',
      },
    };
    
    render(
      <DynamicFormBuilder 
        schema={schemaWithReset} 
        onSubmit={mockSubmit}
        initialValues={initialValues}
      />
    );
    
    const nameInput = screen.getByLabelText('Name');
    const resetButton = screen.getByRole('button', { name: 'Reset Form' });
    
    // Change the value
    await user.clear(nameInput);
    await user.type(nameInput, 'John Smith');
    
    // Click reset
    await user.click(resetButton);
    
    // Value should be reset to initial value
    await waitFor(() => {
      expect((nameInput as HTMLInputElement).value).toBe('Jane Doe');
    });
  });

  it('shows loading state during submission', async () => {
    const user = userEvent.setup();
    const mockAsyncSubmit = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
    
    render(<DynamicFormBuilder schema={simpleSchema} onSubmit={mockAsyncSubmit} />);
    
    const nameInput = screen.getByLabelText('Name');
    const emailInput = screen.getByLabelText('Email');
    const submitButton = screen.getByRole('button', { name: 'Submit Form' });
    
    await user.type(nameInput, 'John Doe');
    await user.type(emailInput, 'john.doe@example.com');
    await user.click(submitButton);
    
    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
    
    // After submission completes
    await waitFor(() => {
      expect(screen.getByText('Submit Form')).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    }, { timeout: 2000 });
  });
});
