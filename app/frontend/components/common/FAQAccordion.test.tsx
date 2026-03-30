import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FAQAccordion } from './FAQAccordion';

describe('FAQAccordion', () => {
  const mockItems = [
    {
      id: 'faq-1',
      question: 'First Question',
      answer: 'First Answer',
    },
    {
      id: 'faq-2',
      question: 'Second Question',
      answer: 'Second Answer',
    },
    {
      id: 'faq-3',
      question: 'Third Question',
      answer: 'Third Answer',
    },
  ];

  describe('Rendering', () => {
    it('renders all FAQ items', () => {
      render(<FAQAccordion items={mockItems} />);

      expect(screen.getByText('First Question')).toBeInTheDocument();
      expect(screen.getByText('Second Question')).toBeInTheDocument();
      expect(screen.getByText('Third Question')).toBeInTheDocument();
    });

    it('renders buttons with correct labels', () => {
      render(<FAQAccordion items={mockItems} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
      expect(buttons[0]).toHaveTextContent('First Question');
    });

    it('renders with all items closed by default', () => {
      render(<FAQAccordion items={mockItems} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('renders with specified default open items', () => {
      render(<FAQAccordion items={mockItems} defaultOpenIds={['faq-1', 'faq-3']} allowMultipleOpen={true} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
      expect(buttons[2]).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Single Open Mode (Default)', () => {
    it('opens item when clicked', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      await user.click(firstButton);

      expect(firstButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('First Answer')).toBeVisible();
    });

    it('closes previous item when opening new item', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      const secondButton = screen.getByText('Second Question');

      // Open first item
      await user.click(firstButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');

      // Open second item
      await user.click(secondButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
      expect(secondButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes item when clicked again', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');

      await user.click(firstButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');

      await user.click(firstButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Multiple Open Mode', () => {
    it('allows multiple items to be open', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} allowMultipleOpen={true} />);

      const firstButton = screen.getByText('First Question');
      const secondButton = screen.getByText('Second Question');

      await user.click(firstButton);
      await user.click(secondButton);

      expect(firstButton).toHaveAttribute('aria-expanded', 'true');
      expect(secondButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('First Answer')).toBeVisible();
      expect(screen.getByText('Second Answer')).toBeVisible();
    });

    it('allows independent toggle of items', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} allowMultipleOpen={true} />);

      const firstButton = screen.getByText('First Question');
      const secondButton = screen.getByText('Second Question');

      await user.click(firstButton);
      await user.click(secondButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');
      expect(secondButton).toHaveAttribute('aria-expanded', 'true');

      // Close first, second stays open
      await user.click(firstButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
      expect(secondButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Keyboard Navigation', () => {
    it('toggles item with Enter key', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      firstButton.focus();

      await user.keyboard('{Enter}');
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Enter}');
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggles item with Space key', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      firstButton.focus();

      await user.keyboard(' ');
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard(' ');
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('navigates with ArrowDown key', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      const secondButton = screen.getByText('Second Question');

      firstButton.focus();
      await user.keyboard('{ArrowDown}');

      expect(secondButton).toHaveFocus();
    });

    it('navigates with ArrowUp key', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      const secondButton = screen.getByText('Second Question');

      secondButton.focus();
      await user.keyboard('{ArrowUp}');

      expect(firstButton).toHaveFocus();
    });

    it('navigates to first item with Home key', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      const thirdButton = screen.getByText('Third Question');

      thirdButton.focus();
      await user.keyboard('{Home}');

      expect(firstButton).toHaveFocus();
    });

    it('navigates to last item with End key', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      const thirdButton = screen.getByText('Third Question');

      firstButton.focus();
      await user.keyboard('{End}');

      expect(thirdButton).toHaveFocus();
    });

    it('does not navigate beyond bounds with ArrowDown', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const thirdButton = screen.getByText('Third Question');

      thirdButton.focus();
      await user.keyboard('{ArrowDown}');

      expect(thirdButton).toHaveFocus();
    });

    it('does not navigate beyond bounds with ArrowUp', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');

      firstButton.focus();
      await user.keyboard('{ArrowUp}');

      expect(firstButton).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria attributes', () => {
      render(<FAQAccordion items={mockItems} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button, index) => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAttribute('aria-controls', `faq-content-faq-${index + 1}`);
      });
    });

    it('has content wrapper with role="region"', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      const firstButton = screen.getByText('First Question');
      await user.click(firstButton);

      const contentWrapper = screen.getByRole('region');
      expect(contentWrapper).toBeInTheDocument();
    });

    it('has data-faq-id attributes', () => {
      render(<FAQAccordion items={mockItems} />);

      mockItems.forEach((item) => {
        const button = screen.getByText(item.question).closest('button');
        expect(button).toHaveAttribute('data-faq-id', item.id);
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onItemToggle when item is toggled', async () => {
      const user = userEvent.setup();
      const onItemToggle = jest.fn();

      render(<FAQAccordion items={mockItems} onItemToggle={onItemToggle} />);

      const firstButton = screen.getByText('First Question');
      await user.click(firstButton);

      expect(onItemToggle).toHaveBeenCalledWith('faq-1', true);
    });

    it('calls onItemToggle with correct state when closing', async () => {
      const user = userEvent.setup();
      const onItemToggle = jest.fn();

      render(<FAQAccordion items={mockItems} onItemToggle={onItemToggle} />);

      const firstButton = screen.getByText('First Question');
      await user.click(firstButton);
      await user.click(firstButton);

      expect(onItemToggle).toHaveBeenLastCalledWith('faq-1', false);
    });

    it('calls onItemToggle for each item toggle in multiple open mode', async () => {
      const user = userEvent.setup();
      const onItemToggle = jest.fn();

      render(
        <FAQAccordion items={mockItems} allowMultipleOpen={true} onItemToggle={onItemToggle} />
      );

      const firstButton = screen.getByText('First Question');
      const secondButton = screen.getByText('Second Question');

      await user.click(firstButton);
      await user.click(secondButton);

      expect(onItemToggle).toHaveBeenNthCalledWith(1, 'faq-1', true);
      expect(onItemToggle).toHaveBeenNthCalledWith(2, 'faq-2', true);
    });
  });

  describe('Edge Cases', () => {
    it('renders with empty array', () => {
      render(<FAQAccordion items={[]} />);

      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });

    it('renders with single item', async () => {
      const user = userEvent.setup();
      const singleItem = [mockItems[0]];

      render(<FAQAccordion items={singleItem} />);

      const button = screen.getByText('First Question');
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('handles updates to items prop', () => {
      const { rerender } = render(<FAQAccordion items={mockItems.slice(0, 2)} />);

      expect(screen.getByText('First Question')).toBeInTheDocument();
      expect(screen.queryByText('Third Question')).not.toBeInTheDocument();

      rerender(<FAQAccordion items={mockItems} />);

      expect(screen.getByText('Third Question')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <FAQAccordion items={mockItems} className="custom-class" />
      );

      const root = container.firstChild;
      expect(root).toHaveClass('custom-class');
    });
  });

  describe('Content Display', () => {
    it('displays answer content when item is open', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} />);

      expect(screen.queryByText('First Answer')).not.toBeVisible();

      const firstButton = screen.getByText('First Question');
      await user.click(firstButton);

      expect(screen.getByText('First Answer')).toBeVisible();
    });

    it('hides answer content when item is closed', async () => {
      const user = userEvent.setup();
      render(<FAQAccordion items={mockItems} defaultOpenIds={['faq-1']} />);

      expect(screen.getByText('First Answer')).toBeVisible();

      const firstButton = screen.getByText('First Question');
      await user.click(firstButton);

      expect(screen.queryByText('First Answer')).not.toBeVisible();
    });
  });
});
