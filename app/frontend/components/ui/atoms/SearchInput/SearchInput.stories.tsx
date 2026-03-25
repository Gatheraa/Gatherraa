import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchInput } from './SearchInput';

const meta: Meta<typeof SearchInput> = {
  title: 'UI/Atoms/SearchInput',
  component: SearchInput,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A reusable search input component with built-in debounce logic, clear button, and loading states.'
      }
    }
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Search events...',
    onSearch: (value) => console.log('Search:', value),
  },
};

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'Initial search value',
    placeholder: 'Search events...',
    onSearch: (value) => console.log('Search:', value),
  },
};

export const WithClearButton: Story = {
  args: {
    placeholder: 'Search events...',
    showClear: true,
    onSearch: (value) => console.log('Search:', value),
  },
};

export const WithoutClearButton: Story = {
  args: {
    placeholder: 'Search events...',
    showClear: false,
    onSearch: (value) => console.log('Search:', value),
  },
};

export const Loading: Story = {
  args: {
    placeholder: 'Search events...',
    loading: true,
    onSearch: (value) => console.log('Search:', value),
  },
};

export const CustomDebounce: Story = {
  args: {
    placeholder: 'Search events...',
    debounceMs: 500,
    onSearch: (value) => console.log('Search:', value),
  },
};

export const WithMinChars: Story = {
  args: {
    placeholder: 'Search events (min 3 chars)...',
    minChars: 3,
    onSearch: (value) => console.log('Search:', value),
  },
};

export const IconRight: Story = {
  args: {
    placeholder: 'Search events...',
    iconPosition: 'right',
    onSearch: (value) => console.log('Search:', value),
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Search events...',
    disabled: true,
    onSearch: (value) => console.log('Search:', value),
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState('');
    
    return (
      <SearchInput
        {...args}
        value={value}
        onSearch={(searchValue) => {
          setValue(searchValue);
          args.onSearch?.(searchValue);
        }}
      />
    );
  },
  args: {
    placeholder: 'Search events...',
    onSearch: (value) => console.log('Search:', value),
  },
};

export const WithCustomIcons: Story = {
  args: {
    placeholder: 'Search events...',
    searchIcon: <span>🔍</span>,
    clearIcon: <span>❌</span>,
    onSearch: (value) => console.log('Search:', value),
  },
};

export const Interactive: Story = {
  render: (args) => {
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const handleSearch = async (value: string) => {
      if (value.length < 2) {
        setSearchResults([]);
        return;
      }
      
      setIsLoading(true);
      
      // Simulate API call
      setTimeout(() => {
        const mockResults = [
          'Event 1: ' + value,
          'Event 2: ' + value,
          'Event 3: ' + value,
        ].slice(0, Math.floor(Math.random() * 3) + 1);
        
        setSearchResults(mockResults);
        setIsLoading(false);
      }, 500);
    };
    
    return (
      <div className="w-96 space-y-4">
        <SearchInput
          {...args}
          loading={isLoading}
          onSearch={handleSearch}
        />
        {searchResults.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--border-default)] rounded-lg p-4">
            <h4 className="font-medium mb-2">Search Results:</h4>
            <ul className="space-y-1">
              {searchResults.map((result, index) => (
                <li key={index} className="text-sm text-[var(--text-secondary)]">
                  {result}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  },
  args: {
    placeholder: 'Search for events...',
    debounceMs: 300,
  },
};
