import React, { useState } from "react";
import StepBasicInfo from "./steps/StepBasicInfo";
import StepDateLocation from "./steps/StepDateLocation";
import StepReview from "./steps/StepReview";
import { validators } from "./validators";

const steps = [
  StepBasicInfo,
  StepDateLocation,
  StepReview
];

export default function EventCreationWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  const CurrentStep = steps[currentStep];

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const validateStep = () => {
    const validate = validators[currentStep];
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

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

    // TODO: Replace with API call
    // await createEvent(formData);
  };

  return (
    <div className="wizard">
      <h1>Create Event</h1>

      <CurrentStep
        data={formData}
        onChange={handleChange}
        errors={errors}
      />

      <div style={{ marginTop: "20px" }}>
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

      <p>
        Step {currentStep + 1} of {steps.length}
      </p>
    </div>
  );
}