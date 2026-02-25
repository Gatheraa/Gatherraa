import { useForm as useRHF, UseFormProps, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';

interface UseAppFormProps<T extends FieldValues> extends UseFormProps<T> {
  schema: ZodSchema<T>;
}

/**
 * Thin wrapper around React Hook Form with Zod resolver pre-wired.
 * Usage: const methods = useAppForm({ schema: myZodSchema });
 */
export function useAppForm<T extends FieldValues>({
  schema,
  ...rest
}: UseAppFormProps<T>) {
  return useRHF<T>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    ...rest,
  });
}