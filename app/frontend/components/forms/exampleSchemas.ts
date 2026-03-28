import { DynamicFormSchema } from './DynamicFormBuilder';

// ─── User Registration Form Schema ────────────────────────────────────────────────

export const userRegistrationSchema: DynamicFormSchema = {
  id: "user-registration",
  title: "Create Account",
  description: "Join our community and start organizing amazing events",
  sections: [
    {
      id: "personal-info",
      title: "Personal Information",
      description: "Tell us about yourself",
      fields: [
        {
          id: "firstName",
          type: "text",
          label: "First Name",
          name: "firstName",
          placeholder: "Enter your first name",
          validation: [
            { type: "required", message: "First name is required" },
            { type: "minLength", value: 2, message: "First name must be at least 2 characters" },
            { type: "maxLength", value: 50, message: "First name cannot exceed 50 characters" },
          ],
        },
        {
          id: "lastName",
          type: "text",
          label: "Last Name",
          name: "lastName",
          placeholder: "Enter your last name",
          validation: [
            { type: "required", message: "Last name is required" },
            { type: "minLength", value: 2, message: "Last name must be at least 2 characters" },
            { type: "maxLength", value: 50, message: "Last name cannot exceed 50 characters" },
          ],
        },
        {
          id: "email",
          type: "email",
          label: "Email Address",
          name: "email",
          placeholder: "your.email@example.com",
          validation: [
            { type: "required", message: "Email is required" },
          ],
        },
        {
          id: "phone",
          type: "tel",
          label: "Phone Number",
          name: "phone",
          placeholder: "+1 (555) 123-4567",
          validation: [
            { type: "required", message: "Phone number is required" },
          ],
        },
      ],
    },
    {
      id: "account-details",
      title: "Account Details",
      description: "Set up your account credentials",
      fields: [
        {
          id: "username",
          type: "text",
          label: "Username",
          name: "username",
          placeholder: "Choose a unique username",
          validation: [
            { type: "required", message: "Username is required" },
            { type: "minLength", value: 3, message: "Username must be at least 3 characters" },
            { type: "maxLength", value: 20, message: "Username cannot exceed 20 characters" },
            {
              type: "pattern",
              regex: "^[a-zA-Z0-9_]+$",
              message: "Username can only contain letters, numbers, and underscores"
            },
          ],
        },
        {
          id: "password",
          type: "password",
          label: "Password",
          name: "password",
          placeholder: "Enter a strong password",
          validation: [
            { type: "required", message: "Password is required" },
            { type: "minLength", value: 8, message: "Password must be at least 8 characters" },
            {
              type: "custom",
              message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
              customValidator: (value: string) => {
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value);
              }
            },
          ],
        },
        {
          id: "confirmPassword",
          type: "password",
          label: "Confirm Password",
          name: "confirmPassword",
          placeholder: "Re-enter your password",
          validation: [
            { type: "required", message: "Please confirm your password" },
          ],
        },
        {
          id: "agreeToTerms",
          type: "checkbox",
          label: "I agree to the Terms of Service and Privacy Policy",
          name: "agreeToTerms",
          validation: [
            { type: "required", message: "You must agree to the terms to continue" },
          ],
        },
      ],
    },
  ],
  submitButton: {
    text: "Create Account",
    className: "w-full",
  },
};

// ─── Event Creation Form Schema ─────────────────────────────────────────────────────

export const eventCreationSchema: DynamicFormSchema = {
  id: "event-creation",
  title: "Create New Event",
  description: "Plan and organize your next amazing event",
  sections: [
    {
      id: "basic-info",
      title: "Basic Information",
      description: "Event details and description",
      fields: [
        {
          id: "title",
          type: "text",
          label: "Event Title",
          name: "title",
          placeholder: "Enter an engaging title for your event",
          validation: [
            { type: "required", message: "Event title is required" },
            { type: "minLength", value: 3, message: "Title must be at least 3 characters" },
            { type: "maxLength", value: 80, message: "Title cannot exceed 80 characters" },
          ],
        },
        {
          id: "description",
          type: "textarea",
          label: "Description",
          name: "description",
          placeholder: "Describe your event in detail...",
          rows: 6,
          validation: [
            { type: "required", message: "Description is required" },
            { type: "minLength", value: 10, message: "Description must be at least 10 characters" },
            { type: "maxLength", value: 500, message: "Description cannot exceed 500 characters" },
          ],
        },
        {
          id: "category",
          type: "select",
          label: "Event Category",
          name: "category",
          placeholder: "Select a category",
          options: [
            { label: "Conference", value: "conference" },
            { label: "Workshop", value: "workshop" },
            { label: "Concert", value: "concert" },
            { label: "Hackathon", value: "hackathon" },
            { label: "Meetup", value: "meetup" },
            { label: "Webinar", value: "webinar" },
            { label: "Networking", value: "networking" },
            { label: "Other", value: "other" },
          ],
          validation: [
            { type: "required", message: "Please select a category" },
          ],
        },
      ],
    },
    {
      id: "logistics",
      title: "Event Logistics",
      description: "When and where your event will take place",
      fields: [
        {
          id: "eventType",
          type: "radio",
          label: "Event Type",
          name: "eventType",
          options: [
            { label: "In-Person", value: "inperson" },
            { label: "Virtual", value: "virtual" },
            { label: "Hybrid", value: "hybrid" },
          ],
          validation: [
            { type: "required", message: "Please select an event type" },
          ],
        },
        {
          id: "location",
          type: "text",
          label: "Location",
          name: "location",
          placeholder: "Event venue or address",
          conditional: {
            field: "eventType",
            value: "virtual",
            operator: "not_equals",
          },
          validation: [
            {
              type: "custom",
              message: "Location is required for in-person events",
              customValidator: (value: string, allValues: any) => {
                if (allValues.eventType !== "virtual") {
                  return value && value.trim().length > 0;
                }
                return true;
              }
            },
          ],
        },
        {
          id: "virtualUrl",
          type: "url",
          label: "Virtual Event URL",
          name: "virtualUrl",
          placeholder: "https://zoom.us/meeting/...",
          conditional: {
            field: "eventType",
            value: "inperson",
            operator: "not_equals",
          },
          validation: [
            {
              type: "custom",
              message: "Virtual URL is required for virtual/hybrid events",
              customValidator: (value: string, allValues: any) => {
                if (allValues.eventType !== "inperson") {
                  return value && value.trim().length > 0;
                }
                return true;
              }
            },
          ],
        },
        {
          id: "startDate",
          type: "datetime-local",
          label: "Start Date & Time",
          name: "startDate",
          validation: [
            { type: "required", message: "Start date is required" },
            {
              type: "custom",
              message: "Start date must be in the future",
              customValidator: (value: string) => {
                return new Date(value) > new Date();
              }
            },
          ],
        },
        {
          id: "endDate",
          type: "datetime-local",
          label: "End Date & Time",
          name: "endDate",
          validation: [
            { type: "required", message: "End date is required" },
            {
              type: "custom",
              message: "End date must be after start date",
              customValidator: (value: string, allValues: any) => {
                return new Date(value) > new Date(allValues.startDate);
              }
            },
          ],
        },
      ],
    },
    {
      id: "pricing",
      title: "Pricing & Capacity",
      description: "Set ticket prices and attendance limits",
      fields: [
        {
          id: "ticketType",
          type: "radio",
          label: "Ticket Type",
          name: "ticketType",
          options: [
            { label: "Free", value: "free" },
            { label: "Paid", value: "paid" },
            { label: "Donation", value: "donation" },
          ],
          defaultValue: "free",
          validation: [
            { type: "required", message: "Please select a ticket type" },
          ],
        },
        {
          id: "ticketPrice",
          type: "number",
          label: "Ticket Price ($)",
          name: "ticketPrice",
          placeholder: "0.00",
          min: 0,
          step: 0.01,
          defaultValue: 0,
          conditional: {
            field: "ticketType",
            value: "free",
            operator: "not_equals",
          },
          validation: [
            {
              type: "custom",
              message: "Ticket price is required for paid events",
              customValidator: (value: number, allValues: any) => {
                if (allValues.ticketType === "paid") {
                  return value > 0;
                }
                return true;
              }
            },
          ],
        },
        {
          id: "maxAttendees",
          type: "number",
          label: "Maximum Attendees",
          name: "maxAttendees",
          placeholder: "100",
          min: 1,
          step: 1,
          defaultValue: 100,
          validation: [
            { type: "required", message: "Maximum attendees is required" },
            { type: "min", value: 1, message: "Must allow at least 1 attendee" },
          ],
        },
        {
          id: "requireApproval",
          type: "checkbox",
          label: "Require approval for attendance",
          name: "requireApproval",
          defaultValue: false,
        },
      ],
    },
  ],
  submitButton: {
    text: "Create Event",
  },
  resetButton: {
    text: "Clear Form",
  },
};

// ─── Survey Form Schema ───────────────────────────────────────────────────────────

export const surveySchema: DynamicFormSchema = {
  id: "survey-form",
  title: "Event Feedback Survey",
  description: "Help us improve your event experience",
  sections: [
    {
      id: "rating-section",
      title: "Event Rating",
      description: "How would you rate this event?",
      fields: [
        {
          id: "overallRating",
          type: "range",
          label: "Overall Rating",
          name: "overallRating",
          min: 1,
          max: 10,
          step: 1,
          defaultValue: 5,
          validation: [
            { type: "required", message: "Please provide an overall rating" },
          ],
        },
        {
          id: "recommendation",
          type: "radio",
          label: "Would you recommend this event to others?",
          name: "recommendation",
          options: [
            { label: "Definitely", value: "definitely" },
            { label: "Probably", value: "probably" },
            { label: "Not sure", value: "notsure" },
            { label: "Probably not", value: "probablynot" },
            { label: "Definitely not", value: "definitelynot" },
          ],
          validation: [
            { type: "required", message: "Please select an option" },
          ],
        },
      ],
    },
    {
      id: "feedback-section",
      title: "Detailed Feedback",
      description: "Tell us more about your experience",
      fields: [
        {
          id: "bestAspects",
          type: "multiselect",
          label: "What did you like most about the event?",
          name: "bestAspects",
          options: [
            { label: "Content quality", value: "content" },
            { label: "Speaker expertise", value: "speakers" },
            { label: "Networking opportunities", value: "networking" },
            { label: "Venue/Location", value: "venue" },
            { label: "Organization", value: "organization" },
            { label: "Food & beverages", value: "food" },
            { label: "Technical setup", value: "technical" },
            { label: "Value for money", value: "value" },
          ],
          validation: [
            { type: "required", message: "Please select at least one aspect" },
          ],
        },
        {
          id: "improvements",
          type: "textarea",
          label: "What could be improved?",
          name: "improvements",
          placeholder: "Share your suggestions for improvement...",
          rows: 4,
        },
        {
          id: "additionalComments",
          type: "textarea",
          label: "Additional Comments",
          name: "additionalComments",
          placeholder: "Any other feedback you'd like to share...",
          rows: 3,
        },
      ],
    },
    {
      id: "followup-section",
      title: "Follow-up",
      description: "Stay connected with us",
      fields: [
        {
          id: "contactPermission",
          type: "checkbox",
          label: "I'd like to receive updates about future events",
          name: "contactPermission",
          defaultValue: true,
        },
        {
          id: "contactEmail",
          type: "email",
          label: "Email for updates",
          name: "contactEmail",
          placeholder: "your.email@example.com",
          conditional: {
            field: "contactPermission",
            value: true,
          },
          validation: [
            {
              type: "custom",
              message: "Email is required if you want to receive updates",
              customValidator: (value: string, allValues: any) => {
                if (allValues.contactPermission) {
                  return value && value.trim().length > 0;
                }
                return true;
              }
            },
          ],
        },
      ],
    },
  ],
  submitButton: {
    text: "Submit Feedback",
  },
};

// ─── Contact Form Schema ──────────────────────────────────────────────────────────

export const contactSchema: DynamicFormSchema = {
  id: "contact-form",
  title: "Contact Us",
  description: "Get in touch with our team",
  sections: [
    {
      id: "contact-info",
      title: "Your Information",
      fields: [
        {
          id: "name",
          type: "text",
          label: "Full Name",
          name: "name",
          placeholder: "Your name",
          validation: [
            { type: "required", message: "Name is required" },
            { type: "minLength", value: 2, message: "Name must be at least 2 characters" },
          ],
        },
        {
          id: "email",
          type: "email",
          label: "Email Address",
          name: "email",
          placeholder: "your.email@example.com",
          validation: [
            { type: "required", message: "Email is required" },
          ],
        },
        {
          id: "subject",
          type: "select",
          label: "Subject",
          name: "subject",
          placeholder: "Select a topic",
          options: [
            { label: "General Inquiry", value: "general" },
            { label: "Technical Support", value: "support" },
            { label: "Partnership", value: "partnership" },
            { label: "Media/Press", value: "media" },
            { label: "Bug Report", value: "bug" },
            { label: "Feature Request", value: "feature" },
            { label: "Other", value: "other" },
          ],
          validation: [
            { type: "required", message: "Please select a subject" },
          ],
        },
        {
          id: "priority",
          type: "radio",
          label: "Priority",
          name: "priority",
          options: [
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
            { label: "Urgent", value: "urgent" },
          ],
          defaultValue: "medium",
        },
      ],
    },
    {
      id: "message-section",
      title: "Your Message",
      fields: [
        {
          id: "message",
          type: "textarea",
          label: "Message",
          name: "message",
          placeholder: "Describe your inquiry in detail...",
          rows: 8,
          validation: [
            { type: "required", message: "Message is required" },
            { type: "minLength", value: 10, message: "Message must be at least 10 characters" },
            { type: "maxLength", value: 1000, message: "Message cannot exceed 1000 characters" },
          ],
        },
        {
          id: "attachments",
          type: "file",
          label: "Attachments (optional)",
          name: "attachments",
          multiple: true,
          accept: ".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt",
        },
      ],
    },
  ],
  submitButton: {
    text: "Send Message",
  },
};
