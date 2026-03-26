import React, { useState } from "react";

// Step Components
const StepBasicInfo = ({ data, onChange, errors }) => (
  <div>
    <h2>Basic Info</h2>

    <input
      type="text"
      placeholder="Event Title"
      value={data.title || ""}
      onChange={(e) => onChange("title", e.target.value)}
    />
    {errors.title && <p className="error">{errors.title}</p>}

    <textarea
      placeholder="Description"
      value={data.description || ""}
      onChange={(e) => onChange("description", e.target.value)}
    />
    {errors.description && <p className="error">{errors.description}</p>}
  </div>
);

const StepDateLocation = ({ data, onChange, errors }) => (
  <div>
    <h2>Date & Location</h2>

    <input
      type="date"
      value={data.date || ""}
      onChange={(e) => onChange("date", e.target.value)}
    />
    {errors.date && <p className="error">{errors.date}</p>}

    <input
      type="text"
      placeholder="Location"
      value={data.location || ""}
      onChange={(e) => onChange("location", e.target.value)}
    />
    {errors.location && <p className="error">{errors.location}</p>}
  </div>
);

const StepReview = ({ data }) => (
  <div>
    <h2>Review</h2>
    <pre>{JSON.stringify(data, null, 2)}</pre>
  </div>
);

// Validation per step
const validators = [
  (data) => {
    const errors = {};
    if (!data.title) errors.title = "Title is required";
    if (!data.description) errors.description = "Description is required";
    return errors;
  },
  (data) => {
    const errors = {};
    if (!data.date) errors.date = "Date is required";
    if (!data.location) errors.location = "Location is required";
    return errors;
  },
  () => ({}) // review step has no validation
];

const steps = [
  StepBasicInfo,
  StepDateLocation,
  StepReview
];

export default function EventCreationWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const CurrentStepComponent = steps[currentStep];

  // Update form state
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  // Validate current step
  const validateStep = () => {
    const stepValidator = validators[currentStep];
    const validationErrors = stepValidator(formData);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  // Navigation
  const nextStep = () => {
    if (!validateStep()) return;
    setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = () => {
    if (!validateStep()) return;

    console.log("Submitting event:", formData);

    // TODO: API call
  };

  return (
    <div className="wizard">
      <h1>Create Event</h1>

      <CurrentStepComponent
        data={formData}
        onChange={handleChange}
        errors={errors}
      />

      <div className="navigation">
        {currentStep > 0 && (
          <button onClick={prevStep}>Back</button>
        )}

        {currentStep < steps.length - 1 && (
          <button onClick={nextStep}>Next</button>
        )}

        {currentStep === steps.length - 1 && (
          <button onClick={handleSubmit}>Submit</button>
        )}
      </div>

      <div className="step-indicator">
        Step {currentStep + 1} of {steps.length}
      </div>
    </div>
  );
}