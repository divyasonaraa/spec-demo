// Submission Type Definitions
// Based on specs/001-form-config-generator/data-model.md

export interface SubmitConfig {
  /** API endpoint for form submission */
  endpoint: string;
  
  /** HTTP method */
  method: 'POST' | 'PUT' | 'PATCH';
  
  /** Request headers (supports token resolution) */
  headers?: Record<string, string>;
  
  /** State transitions based on API response */
  stateTransitions?: {
    onSuccess?: StateTransition;
    onError?: StateTransition;
  };
  
  /** Transform payload before submission */
  transformPayload?: {
    include?: string[]; // Only include these fields
    exclude?: string[]; // Exclude these fields
    rename?: Record<string, string>; // Rename fields
  };
}

export interface StateTransition {
  /** Action to perform */
  action: 'navigate' | 'nextStep' | 'showMessage' | 'callApi';
  
  /** Target for action (URL for navigate, message for showMessage, endpoint for callApi) */
  target?: string;
  
  /** Success/error message */
  message?: string;
  
  /** Delay before action (milliseconds) */
  delay?: number;
}

export type SubmissionPayload = Record<string, any>; // Dynamic structure
