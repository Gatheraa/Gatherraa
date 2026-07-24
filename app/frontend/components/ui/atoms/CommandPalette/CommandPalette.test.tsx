import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from './CommandPalette';
import { CommandPaletteProvider, CommandPaletteContext } from './CommandPaletteContext';
import { useCommandPalette } from './useCommandPalette';
import { fuzzySearch, filterCommands } from './fuzzySearch';
import type { CommandGroup } from './types';

const sampleGroups: CommandGroup[] = [
  {
    id: 'navigation',
    label: 'Navigation',
    commands: [
      { id: 'home', label: 'Go to Home', action: jest.fn() },
      { id: 'events', label: 'Go to Events', action: jest.fn() },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    commands: [
      { id: 'new-event', label: 'Create New Event', action: jest.fn(), keywords: ['create', 'add'] },
      { id: 'save', label: 'Save Changes', action: jest.fn(), shortcut: ['⌘', 'S'] },
    ],
  },
];

function renderPalette(groups: CommandGroup[] = sampleGroups, props = {}) {
  const onClose = jest.fn();
  const result = render(
    <CommandPaletteProvider initialGroups={groups}>
      <CommandPalette isOpen={true} onClose={onClose} {...props} />
    </CommandPaletteProvider>
  );
  return { ...result, onClose };
}

describe('CommandPalette', () => {
  describe('Rendering', () => {
    it('renders the dialog with correct ARIA attributes', () => {
      renderPalette();

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Command palette');
    });

    it('renders all command groups', () => {
      renderPalette();

      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('renders all commands within groups', () => {
      renderPalette();

      expect(screen.getByText('Go to Home')).toBeInTheDocument();
      expect(screen.getByText('Go to Events')).toBeInTheDocument();
      expect(screen.getByText('Create New Event')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
    });

    it('renders keyboard shortcut badges', () => {
      renderPalette();

      expect(screen.getByText('⌘')).toBeInTheDocument();
      expect(screen.getByText('S')).toBeInTheDocument();
    });

    it('renders search input with correct attributes', () => {
      renderPalette();

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-controls', 'command-palette-listbox');
      expect(input).toHaveAttribute('aria-label', 'Search commands');
    });

    it('renders empty state when no groups provided', () => {
      renderPalette([], { emptyMessage: 'No commands available.' });

      expect(screen.getByText('No commands available.')).toBeInTheDocument();
    });
  });

  describe('Fuzzy Search', () => {
    it('filters commands by label', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByRole('combobox');
      await user.type(input, 'home');

      expect(screen.getByText('Go to Home')).toBeInTheDocument();
      expect(screen.queryByText('Go to Events')).not.toBeInTheDocument();
      expect(screen.queryByText('Create New Event')).not.toBeInTheDocument();
    });

    it('filters commands by keywords', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByRole('combobox');
      await user.type(input, 'create');

      expect(screen.getByText('Create New Event')).toBeInTheDocument();
      expect(screen.queryByText('Go to Home')).not.toBeInTheDocument();
    });

    it('shows no results message when nothing matches', async () => {
      const user = userEvent.setup();
      renderPalette([], { emptyMessage: 'No results found.' });

      const input = screen.getByRole('combobox');
      await user.type(input, 'zzzzz');

      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });

    it('clears filter when query is emptied', async () => {
      const user = userEvent.setup();
      renderPalette();

      const input = screen.getByRole('combobox');
      await user.type(input, 'home');
      expect(screen.queryByText('Go to Events')).not.toBeInTheDocument();

      await user.clear(input);
      expect(screen.getByText('Go to Events')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates down with ArrowDown key', async () => {
      const user = userEvent.setup();
      renderPalette();

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');

      // First item should be selected by default
      expect(options[0]).toHaveAttribute('aria-selected', 'true');

      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
    });

    it('navigates up with ArrowUp key', async () => {
      const user = userEvent.setup();
      renderPalette();

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');

      // Move down first
      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');

      // Move back up
      await user.keyboard('{ArrowUp}');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps around when navigating past the end', async () => {
      const user = userEvent.setup();
      renderPalette();

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      const lastIndex = options.length - 1;

      // Navigate to last item
      for (let i = 0; i < lastIndex; i++) {
        await user.keyboard('{ArrowDown}');
      }
      expect(options[lastIndex]).toHaveAttribute('aria-selected', 'true');

      // Wrap to first
      await user.keyboard('{ArrowDown}');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('executes command with Enter key', async () => {
      const user = userEvent.setup();
      const action = jest.fn();
      const groups: CommandGroup[] = [
        {
          id: 'test',
          label: 'Test',
          commands: [{ id: 'test-cmd', label: 'Test Command', action }],
        },
      ];
      renderPalette(groups);

      await user.keyboard('{Enter}');

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape key', async () => {
      const user = userEvent.setup();
      const { onClose } = renderPalette();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('jumps to first item with Home key', async () => {
      const user = userEvent.setup();
      renderPalette();

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      expect(options[2]).toHaveAttribute('aria-selected', 'true');

      await user.keyboard('{Home}');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('jumps to last item with End key', async () => {
      const user = userEvent.setup();
      renderPalette();

      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      const lastIndex = options.length - 1;

      await user.keyboard('{End}');
      expect(options[lastIndex]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Command Execution', () => {
    it('executes command when clicked', async () => {
      const user = userEvent.setup();
      const action = jest.fn();
      const groups: CommandGroup[] = [
        {
          id: 'test',
          label: 'Test',
          commands: [{ id: 'test-cmd', label: 'Test Command', action }],
        },
      ];
      renderPalette(groups);

      await user.click(screen.getByText('Test Command'));

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('does not execute disabled commands', async () => {
      const user = userEvent.setup();
      const action = jest.fn();
      const groups: CommandGroup[] = [
        {
          id: 'test',
          label: 'Test',
          commands: [{ id: 'test-cmd', label: 'Disabled Command', action, disabled: true }],
        },
      ];
      renderPalette(groups);

      const option = screen.getByText('Disabled Command').closest('[role="option"]');
      expect(option).toHaveAttribute('aria-disabled', 'true');

      await user.click(screen.getByText('Disabled Command'));
      expect(action).not.toHaveBeenCalled();
    });

    it('calls onClose before executing command', async () => {
      const user = userEvent.setup();
      const action = jest.fn();
      const { onClose } = renderPalette([
        {
          id: 'test',
          label: 'Test',
          commands: [{ id: 'test-cmd', label: 'Test Command', action }],
        },
      ]);

      await user.click(screen.getByText('Test Command'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has listbox with correct role and label', () => {
      renderPalette();

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Commands');
      expect(listbox).toHaveAttribute('id', 'command-palette-listbox');
    });

    it('has group labels with correct aria-labelledby', () => {
      renderPalette();

      const groups = screen.getAllByRole('group');
      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]).toHaveAttribute('aria-labelledby', 'group-navigation');
    });

    it('has options with correct aria-selected state', () => {
      renderPalette();

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
      // First option should be selected
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      // Rest should not
      for (let i = 1; i < options.length; i++) {
        expect(options[i]).toHaveAttribute('aria-selected', 'false');
      }
    });

    it('input has aria-activedescendant pointing to active option', () => {
      renderPalette();

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-option-0');
    });

    it('has close button with aria-label', () => {
      renderPalette();

      const closeBtn = screen.getByRole('button', { name: /close command palette/i });
      expect(closeBtn).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('renders custom placeholder', () => {
      renderPalette([], { placeholder: 'Search something...' });

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('placeholder', 'Search something...');
    });

    it('renders custom empty message', async () => {
      const user = userEvent.setup();
      renderPalette([], { emptyMessage: 'Nothing here!' });

      const input = screen.getByRole('combobox');
      await user.type(input, 'nonexistent');

      expect(screen.getByText('Nothing here!')).toBeInTheDocument();
    });
  });
});

describe('Fuzzy Search Utility', () => {
  it('returns match for exact text', () => {
    const result = fuzzySearch('home', 'Go to Home');
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });

  it('returns match for partial text', () => {
    const result = fuzzySearch('hm', 'Go to Home');
    expect(result).not.toBeNull();
  });

  it('returns null for non-matching text', () => {
    const result = fuzzySearch('xyz', 'Go to Home');
    expect(result).toBeNull();
  });

  it('returns null for empty query', () => {
    const result = fuzzySearch('', 'Go to Home');
    expect(result).not.toBeNull();
    expect(result!.indices).toHaveLength(0);
  });

  it('filterCommands returns all items for empty query', () => {
    const items = [{ label: 'Home' }, { label: 'Events' }];
    const result = filterCommands('', items);
    expect(result).toHaveLength(2);
  });

  it('filterCommands filters by label', () => {
    const items = [{ label: 'Go to Home' }, { label: 'Go to Events' }];
    const result = filterCommands('home', items);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Go to Home');
  });

  it('filterCommands filters by keywords', () => {
    const items = [
      { label: 'Create Event', keywords: ['new', 'add'] },
      { label: 'Delete Event', keywords: ['remove'] },
    ];
    const result = filterCommands('new', items);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Create Event');
  });
});

describe('CommandPaletteProvider', () => {
  function TestConsumer() {
    const { register, unregister, groups, open, close, toggle, isOpen } = useCommandPalette();
    return (
      <div>
        <span data-testid="is-open">{String(isOpen)}</span>
        <span data-testid="groups-count">{groups.length}</span>
        <button onClick={open}>Open</button>
        <button onClick={close}>Close</button>
        <button onClick={toggle}>Toggle</button>
        <button onClick={() => register({ id: 'new', label: 'New', commands: [] })}>Register</button>
        <button onClick={() => unregister('new')}>Unregister</button>
      </div>
    );
  }

  it('provides context values', async () => {
    const user = userEvent.setup();
    render(
      <CommandPaletteProvider>
        <TestConsumer />
      </CommandPaletteProvider>
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('groups-count')).toHaveTextContent('0');

    await user.click(screen.getByText('Open'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    await user.click(screen.getByText('Close'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');

    await user.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    await user.click(screen.getByText('Toggle'));
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('registers and unregisters groups', async () => {
    const user = userEvent.setup();
    render(
      <CommandPaletteProvider>
        <TestConsumer />
      </CommandPaletteProvider>
    );

    expect(screen.getByTestId('groups-count')).toHaveTextContent('0');

    await user.click(screen.getByText('Register'));
    expect(screen.getByTestId('groups-count')).toHaveTextContent('1');

    await user.click(screen.getByText('Unregister'));
    expect(screen.getByTestId('groups-count')).toHaveTextContent('0');
  });
});
