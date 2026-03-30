import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagSelector } from './TagSelector';

describe('TagSelector', () => {
  it('adds tags with Enter key', () => {
    const onChange = vi.fn();
    render(<TagSelector label="Tags" value={[]} onChange={onChange} />);

    const input = screen.getByLabelText('Tags');
    fireEvent.change(input, { target: { value: 'Stellar' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['Stellar']);
  });

  it('prevents duplicate tags', () => {
    const onChange = vi.fn();
    render(<TagSelector label="Tags" value={['Stellar']} onChange={onChange} />);

    const input = screen.getByLabelText('Tags');
    fireEvent.change(input, { target: { value: 'stellar' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Tag already added')).toBeInTheDocument();
  });

  it('removes last tag on Backspace when input is empty', () => {
    const onChange = vi.fn();
    render(<TagSelector label="Tags" value={['Web3', 'Stellar']} onChange={onChange} />);

    const input = screen.getByLabelText('Tags');
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onChange).toHaveBeenCalledWith(['Web3']);
  });

  it('shows suggestions and allows selecting one', () => {
    const onChange = vi.fn();
    render(
      <TagSelector
        label="Tags"
        value={[]}
        onChange={onChange}
        suggestions={['Hackathon', 'Workshop']}
      />
    );

    const input = screen.getByLabelText('Tags');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'work' } });

    const suggestion = screen.getByRole('option', { name: 'Workshop' });
    fireEvent.mouseDown(suggestion);

    expect(onChange).toHaveBeenCalledWith(['Workshop']);
  });
});
