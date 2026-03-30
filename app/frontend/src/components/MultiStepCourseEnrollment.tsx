'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  User, 
  CreditCard, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  Loader2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  BookOpen,
  DollarSign,
  Shield,
  AlertCircle
} from 'lucide-react';

// Types
interface StepConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  validationSchema?: z.ZodSchema;
}

interface CourseEnrollmentProps {
  steps: StepConfig[];
  onSubmit: (data: any) => Promise<void>;
  onStepChange?: (currentStep: number, data: any) => void;
  className?: string;
  initialData?: any;
}

// Validation schemas
const personalInfoSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  address: z.object({
    street: z.string().min(5, 'Street address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    zipCode: z.string().min(5, 'ZIP code must be at least 5 characters'),
    country: z.string().min(2, 'Country is required'),
  }),
});

const paymentSchema = z.object({
  paymentMethod: z.enum(['credit-card', 'paypal', 'bank-transfer', 'crypto']),
  cardNumber: z.string().optional(),
  cardExpiry: z.string().optional(),
  cardCvv: z.string().optional(),
  cardholderName: z.string().optional(),
  billingAddress: z.object({
    sameAsShipping: z.boolean(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms and conditions'),
});

const confirmationSchema = z.object({
  confirmDetails: z.boolean().refine(val => val === true, 'Please confirm your details are correct'),
  marketingConsent: z.boolean().optional(),
  dataProcessingConsent: z.boolean().refine(val => val === true, 'You must consent to data processing'),
});

// Step components
const PersonalInfoStep: React.FC = () => {
  const { register, formState: { errors } } = useFormContext();

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <User className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-2xl font-bold text-gray-900">Personal Information</h3>
        <p className="text-gray-600 mt-2">Please provide your personal details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>
          <input
            {...register('firstName')}
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your first name"
          />
          {errors.firstName && (
            <p className="text-red-500 text-sm mt-1">{errors.firstName.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>
          <input
            {...register('lastName')}
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your last name"
          />
          {errors.lastName && (
            <p className="text-red-500 text-sm mt-1">{errors.lastName.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              {...register('email')}
              type="email"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="your.email@example.com"
            />
          </div>
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              {...register('phone')}
              type="tel"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone.message as string}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date of Birth *
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              {...register('dateOfBirth')}
              type="date"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {errors.dateOfBirth && (
            <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth.message as string}</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Address Information
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address *
            </label>
            <input
              {...register('address.street')}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="123 Main Street"
            />
            {errors.address?.street && (
              <p className="text-red-500 text-sm mt-1">{errors.address.street.message as string}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City *
            </label>
            <input
              {...register('address.city')}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="New York"
            />
            {errors.address?.city && (
              <p className="text-red-500 text-sm mt-1">{errors.address.city.message as string}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State *
            </label>
            <input
              {...register('address.state')}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="NY"
            />
            {errors.address?.state && (
              <p className="text-red-500 text-sm mt-1">{errors.address.state.message as string}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ZIP Code *
            </label>
            <input
              {...register('address.zipCode')}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="10001"
            />
            {errors.address?.zipCode && (
              <p className="text-red-500 text-sm mt-1">{errors.address.zipCode.message as string}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Country *
            </label>
            <input
              {...register('address.country')}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="United States"
            />
            {errors.address?.country && (
              <p className="text-red-500 text-sm mt-1">{errors.address.country.message as string}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const PaymentStep: React.FC = () => {
  const { register, watch, formState: { errors } } = useFormContext();
  const paymentMethod = watch('paymentMethod');
  const sameAsShipping = watch('billingAddress.sameAsShipping');

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <CreditCard className="w-16 h-16 mx-auto text-blue-600 mb-4" />
        <h3 className="text-2xl font-bold text-gray-900">Payment Method</h3>
        <p className="text-gray-600 mt-2">Choose your preferred payment method</p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Payment Method *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { value: 'credit-card', label: 'Credit Card', icon: <CreditCard className="w-5 h-5" /> },
            { value: 'paypal', label: 'PayPal', icon: <DollarSign className="w-5 h-5" /> },
            { value: 'bank-transfer', label: 'Bank Transfer', icon: <Shield className="w-5 h-5" /> },
            { value: 'crypto', label: 'Cryptocurrency', icon: <DollarSign className="w-5 h-5" /> },
          ].map((method) => (
            <label
              key={method.value}
              className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500"
            >
              <input
                {...register('paymentMethod')}
                type="radio"
                value={method.value}
                className="mr-3"
              />
              <div className="flex items-center gap-2">
                {method.icon}
                <span className="font-medium">{method.label}</span>
              </div>
            </label>
          ))}
        </div>
        {errors.paymentMethod && (
          <p className="text-red-500 text-sm mt-1">{errors.paymentMethod.message as string}</p>
        )}
      </div>

      {paymentMethod === 'credit-card' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 bg-gray-50 p-6 rounded-lg"
        >
          <h4 className="font-semibold text-gray-900">Credit Card Information</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Card Number *
            </label>
            <input
              {...register('cardNumber')}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1234 5678 9012 3456"
            />
            {errors.cardNumber && (
              <p className="text-red-500 text-sm mt-1">{errors.cardNumber.message as string}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expiry Date *
              </label>
              <input
                {...register('cardExpiry')}
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="MM/YY"
              />
              {errors.cardExpiry && (
                <p className="text-red-500 text-sm mt-1">{errors.cardExpiry.message as string}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CVV *
              </label>
              <input
                {...register('cardCvv')}
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123"
              />
              {errors.cardCvv && (
                <p className="text-red-500 text-sm mt-1">{errors.cardCvv.message as string}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cardholder Name *
            </label>
            <input
              {...register('cardholderName')}
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
            />
            {errors.cardholderName && (
              <p className="text-red-500 text-sm mt-1">{errors.cardholderName.message as string}</p>
            )}
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        <h4 className="font-semibold text-gray-900">Billing Address</h4>
        
        <label className="flex items-center gap-2">
          <input
            {...register('billingAddress.sameAsShipping')}
            type="checkbox"
            className="rounded"
          />
          <span className="text-sm text-gray-700">Same as shipping address</span>
        </label>

        {!sameAsShipping && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Street Address
                </label>
                <input
                  {...register('billingAddress.street')}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Billing Street"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing City
                </label>
                <input
                  {...register('billingAddress.city')}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Billing City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing State
                </label>
                <input
                  {...register('billingAddress.state')}
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="State"
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-2">
          <input
            {...register('agreeToTerms')}
            type="checkbox"
            className="rounded mt-1"
          />
          <span className="text-sm text-gray-700">
            I agree to the Terms and Conditions and Privacy Policy *
          </span>
        </label>
        {errors.agreeToTerms && (
          <p className="text-red-500 text-sm mt-1">{errors.agreeToTerms.message as string}</p>
        )}
      </div>
    </motion.div>
  );
};

const ConfirmationStep: React.FC = () => {
  const { watch, register, formState: { errors } } = useFormContext();
  const formData = watch();

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
        <h3 className="text-2xl font-bold text-gray-900">Review & Confirm</h3>
        <p className="text-gray-600 mt-2">Please review your enrollment details</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-6">
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Name:</span>
              <span className="ml-2 font-medium">{formData.firstName} {formData.lastName}</span>
            </div>
            <div>
              <span className="text-gray-600">Email:</span>
              <span className="ml-2 font-medium">{formData.email}</span>
            </div>
            <div>
              <span className="text-gray-600">Phone:</span>
              <span className="ml-2 font-medium">{formData.phone}</span>
            </div>
            <div>
              <span className="text-gray-600">Date of Birth:</span>
              <span className="ml-2 font-medium">{formData.dateOfBirth}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Address
          </h4>
          <div className="text-sm">
            <p>{formData.address.street}</p>
            <p>{formData.address.city}, {formData.address.state} {formData.address.zipCode}</p>
            <p>{formData.address.country}</p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Method
          </h4>
          <div className="text-sm">
            <p className="capitalize">{formData.paymentMethod?.replace('-', ' ')}</p>
            {formData.paymentMethod === 'credit-card' && (
              <p className="text-gray-600">Card ending in ****{formData.cardNumber?.slice(-4)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-2">
          <input
            {...register('confirmDetails')}
            type="checkbox"
            className="rounded mt-1"
          />
          <span className="text-sm text-gray-700">
            I confirm that all the information provided is accurate and complete *
          </span>
        </label>
        {errors.confirmDetails && (
          <p className="text-red-500 text-sm mt-1">{errors.confirmDetails.message as string}</p>
        )}

        <label className="flex items-start gap-2">
          <input
            {...register('dataProcessingConsent')}
            type="checkbox"
            className="rounded mt-1"
          />
          <span className="text-sm text-gray-700">
            I consent to the processing of my personal data for course enrollment purposes *
          </span>
        </label>
        {errors.dataProcessingConsent && (
          <p className="text-red-500 text-sm mt-1">{errors.dataProcessingConsent.message as string}</p>
        )}

        <label className="flex items-start gap-2">
          <input
            {...register('marketingConsent')}
            type="checkbox"
            className="rounded mt-1"
          />
          <span className="text-sm text-gray-700">
            I would like to receive marketing communications about new courses and special offers
          </span>
        </label>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Important Information</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Once submitted, you will receive a confirmation email within 24 hours</li>
              <li>Course access will be granted upon successful payment verification</li>
              <li>You can modify your enrollment details within 48 hours of submission</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main component
const MultiStepCourseEnrollment: React.FC<CourseEnrollmentProps> = ({
  steps,
  onSubmit,
  onStepChange,
  className = '',
  initialData = {}
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Create combined validation schema
  const combinedSchema = z.object({
    ...personalInfoSchema.shape,
    ...paymentSchema.shape,
    ...confirmationSchema.shape,
  });

  const methods = useForm({
    resolver: zodResolver(combinedSchema),
    defaultValues: initialData,
    mode: 'onChange'
  });

  const { trigger, handleSubmit, watch } = methods;
  const formData = watch();

  // Get current step validation schema
  const getCurrentStepSchema = useCallback(() => {
    const stepId = steps[currentStep]?.id;
    switch (stepId) {
      case 'personal-info':
        return personalInfoSchema;
      case 'payment':
        return paymentSchema;
      case 'confirmation':
        return confirmationSchema;
      default:
        return z.object({});
    }
  }, [currentStep, steps]);

  // Validate current step
  const validateCurrentStep = useCallback(async () => {
    const schema = getCurrentStepSchema();
    const result = await trigger();
    return result;
  }, [trigger, getCurrentStepSchema]);

  // Handle next step
  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < steps.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      onStepChange?.(newStep, formData);
    }
  }, [currentStep, steps.length, validateCurrentStep, onStepChange, formData]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      onStepChange?.(newStep, formData);
    }
  }, [currentStep, onStepChange, formData]);

  // Handle form submission
  const handleFormSubmit = useCallback(async (data: any) => {
    setIsSubmitting(true);
    setSubmissionError(null);
    
    try {
      await onSubmit(data);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'An error occurred during submission');
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit]);

  // Render step content
  const renderStepContent = useCallback(() => {
    const stepId = steps[currentStep]?.id;
    switch (stepId) {
      case 'personal-info':
        return <PersonalInfoStep />;
      case 'payment':
        return <PaymentStep />;
      case 'confirmation':
        return <ConfirmationStep />;
      default:
        return <div>Step not found</div>;
    }
  }, [currentStep, steps]);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index <= currentStep
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-500'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${
                  index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="bg-white rounded-lg shadow-lg p-6">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>

          {/* Error Message */}
          {submissionError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-800">{submissionError}</p>
              </div>
            </motion.div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={isFirstStep || isSubmitting}
              className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <button
              type={isLastStep ? 'submit' : 'button'}
              onClick={isLastStep ? undefined : handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : isLastStep ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Submit Enrollment
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export default MultiStepCourseEnrollment;

// Default step configuration
export const defaultEnrollmentSteps: StepConfig[] = [
  {
    id: 'personal-info',
    title: 'Personal Info',
    description: 'Your personal details',
    icon: <User className="w-5 h-5" />,
    validationSchema: personalInfoSchema,
  },
  {
    id: 'payment',
    title: 'Payment',
    description: 'Payment method',
    icon: <CreditCard className="w-5 h-5" />,
    validationSchema: paymentSchema,
  },
  {
    id: 'confirmation',
    title: 'Confirmation',
    description: 'Review & submit',
    icon: <CheckCircle className="w-5 h-5" />,
    validationSchema: confirmationSchema,
  },
];
