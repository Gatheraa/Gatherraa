/**
 * FileUpload Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileUpload from './FileUpload';

describe('FileUpload Component', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the drop zone with instructions', () => {
    render(<FileUpload uploadEndpoint="/api/upload" />);
    expect(screen.getByText(/Drag & drop files here/i)).toBeInTheDocument();
    expect(screen.getByText(/click to select files/i)).toBeInTheDocument();
  });

  it('allows file selection via input click', () => {
    render(<FileUpload uploadEndpoint="/api/upload" />);
    const input = screen.getByLabelText('File upload drop zone').querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
  });

  it('displays file info after selection', () => {
    render(<FileUpload uploadEndpoint="/api/upload" autoUpload={false} />);
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText('File upload drop zone').querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [file],
    });

    fireEvent.change(input);
    expect(screen.getByText('test.png')).toBeInTheDocument();
  });

  it('limits number of files by maxFiles', () => {
    const onError = vi.fn();
    render(<FileUpload uploadEndpoint="/api/upload" maxFiles={1} onError={onError} />);
    const file1 = new File(['1'], 'one.png', { type: 'image/png' });
    const file2 = new File(['2'], 'two.png', { type: 'image/png' });

    const input = screen.getByLabelText('File upload drop zone').querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file1, file2] });

    fireEvent.change(input);
    expect(onError).toHaveBeenCalled();
  });

  it('validates file type and size before adding', () => {
    const onError = vi.fn();
    render(<FileUpload uploadEndpoint="/api/upload" accept="image/*" maxFileSizeBytes={100} onError={onError} autoUpload={false} />);

    const file = new File(['dummy'], 'video.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText('File upload drop zone').querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });

    fireEvent.change(input);
    expect(onError).toHaveBeenCalled();
  });

  it('displays thumbnail preview for image file', () => {
    render(<FileUpload uploadEndpoint="/api/upload" autoUpload={false} />);
    const file = new File(['test'], 'sample.png', { type: 'image/png' });
    const input = screen.getByLabelText('File upload drop zone').querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });

    fireEvent.change(input);
    expect(screen.getByText('sample.png')).toBeInTheDocument();
  });

  it('calls onFilesChanged when files are added', () => {
    const onFilesChanged = vi.fn();
    render(<FileUpload uploadEndpoint="/api/upload" onFilesChanged={onFilesChanged} autoUpload={false} />);

    const file = new File(['test'], 'sample.png', { type: 'image/png' });
    const input = screen.getByLabelText('File upload drop zone').querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });

    fireEvent.change(input);
    expect(onFilesChanged).toHaveBeenCalledTimes(1);
  });

  it('renders upload and clear buttons', () => {
    render(<FileUpload uploadEndpoint="/api/upload" />);
    expect(screen.getByLabelText('Clear selected files')).toBeInTheDocument();
    expect(screen.getByLabelText('Start upload')).toBeInTheDocument();
  });
});