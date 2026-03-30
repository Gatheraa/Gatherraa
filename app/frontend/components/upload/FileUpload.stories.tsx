import type { Meta, StoryObj } from '@storybook/react';
import FileUpload from './FileUpload';

const meta = {
  title: 'Components/FileUpload',
  component: FileUpload,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Drag-and-drop or click-to-upload component with progress and validation',
      },
    },
  },
  tags: ['autodocs'],
} as Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload uploadEndpoint="/api/upload" />
    </div>
  ),
};

export const CustomAcceptAndSize: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload
        uploadEndpoint="/api/upload"
        accept="image/*,video/*"
        maxFileSizeBytes={5 * 1024 * 1024}
        maxFiles={3}
      />
    </div>
  ),
};

export const MultiTypeFiles: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload uploadEndpoint="/api/upload" accept="image/*,video/*,application/pdf" />
    </div>
  ),
};

export const NoAutoUpload: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload uploadEndpoint="/api/upload" autoUpload={false} />
    </div>
  ),
};

export const ErrorCallback: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload
        uploadEndpoint="/api/missing" // expected to fail
        onError={(err) => console.log('Upload error', err)}
      />
    </div>
  ),
};

export const WithFileChangeCallback: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload
        uploadEndpoint="/api/upload"
        onFilesChanged={(files) => console.log('Selected files', files)}
      />
    </div>
  ),
};

export const CustomStyling: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload
        uploadEndpoint="/api/upload"
        className="bg-white p-4 rounded-xl"
        dropzoneClassName="border-blue-500"
        listClassName="space-y-2"
      />
    </div>
  ),
};

export const MaxFilesReached: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload uploadEndpoint="/api/upload" maxFiles={1} />
    </div>
  ),
};

export const SmallMaxSize: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload uploadEndpoint="/api/upload" maxFileSizeBytes={1024 * 50} />
    </div>
  ),
};

export const FullExample: Story = {
  render: () => (
    <div className="p-8">
      <FileUpload
        uploadEndpoint="/api/upload"
        accept="image/*,video/*,application/pdf"
        maxFileSizeBytes={10 * 1024 * 1024}
        maxFiles={5}
        onFilesChanged={(files) => console.log('files changed', files)}
        onUploadComplete={(files) => console.log('upload complete', files)}
        onError={(err) => console.log('error', err)}
      />
    </div>
  ),
};
