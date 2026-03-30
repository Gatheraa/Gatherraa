import type { Meta, StoryObj } from '@storybook/react';
import { z } from 'zod';
import { FormValidator } from './FormValidator';
import FormInput from '../FormInput';

const meta = {
  title: 'Forms/FormValidator',
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

type Story = StoryObj;

const demoSchema = z.object({
  title: z.string().min(3, 'At least 3 characters'),
});

type DemoValues = z.infer<typeof demoSchema>;

export const WithZodSchema: Story = {
  render: () => (
    <FormValidator<DemoValues>
      zodSchema={demoSchema}
      defaultValues={{ title: '' }}
    >
      {({ register, formState: { errors }, handleSubmit }) => (
        <form
          onSubmit={handleSubmit(() => undefined)}
          className="max-w-md space-y-4 p-4 rounded-xl border border-[#1e2333] bg-[#0a0c10]"
        >
          <FormInput
            label="Title"
            name="title"
            error={errors.title}
            placeholder="Event title"
            {...register('title')}
          />
          <button
            type="submit"
            className="rounded-lg bg-[#3d5afe] px-4 py-2 text-sm font-medium text-white"
          >
            Submit
          </button>
        </form>
      )}
    </FormValidator>
  ),
};
