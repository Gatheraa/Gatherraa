'use client';

import {
  FormProvider,
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodSchema } from 'zod';
import type { ReactNode } from 'react';

export type FormValidatorProps<T extends FieldValues> = Omit<UseFormProps<T>, 'resolver'> & {
  /**
   * Custom resolver — use for Yup (`yupResolver`), async Zod refinements, or other engines.
   * Takes precedence over `zodSchema`.
   */
  resolver?: Resolver<T>;
  /** Zod schema; wired with `zodResolver`. Ignored if `resolver` is set. */
  zodSchema?: ZodSchema<T>;
  children: (methods: UseFormReturn<T>) => ReactNode;
};

function resolveResolver<T extends FieldValues>(
  resolver: Resolver<T> | undefined,
  zodSchema: ZodSchema<T> | undefined
): Resolver<T> {
  if (resolver) return resolver;
  if (zodSchema) return zodResolver(zodSchema) as Resolver<T>;
  throw new Error('FormValidator: pass `resolver` and/or `zodSchema` (at least one required).');
}

/**
 * Wraps React Hook Form with `FormProvider` and a single validation entry point.
 * Supports Zod via `zodSchema`, or any resolver (including Yup and async validation).
 *
 * @example Zod
 * ```tsx
 * <FormValidator zodSchema={mySchema} defaultValues={{ email: '' }}>
 *   {({ register, formState: { errors }, handleSubmit }) => (
 *     <form onSubmit={handleSubmit(onSave)}>
 *       <FormInput label="Email" name="email" error={errors.email} {...register('email')} />
 *     </form>
 *   )}
 * </FormValidator>
 * ```
 *
 * @example Custom / async resolver (Yup, async Zod, etc.)
 * ```tsx
 * import { yupResolver } from '@hookform/resolvers/yup';
 * import * as yup from 'yup';
 *
 * const schema = yup.object({ email: yup.string().email().required() });
 *
 * <FormValidator resolver={yupResolver(schema)} defaultValues={{ email: '' }}>
 *   {(methods) => <form>...</form>}
 * </FormValidator>
 * ```
 *
 * Nested field components can call `useFormContext()` from `react-hook-form` (same provider).
 */
export function FormValidator<T extends FieldValues>({
  children,
  resolver,
  zodSchema,
  mode = 'onChange',
  ...rest
}: FormValidatorProps<T>) {
  const methods = useForm<T>({
    ...rest,
    mode,
    resolver: resolveResolver(resolver, zodSchema),
  });

  return <FormProvider {...methods}>{children(methods)}</FormProvider>;
}
