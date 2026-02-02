/**
 * Validation helper utilities
 *
 * Provides a fluent API for collecting and validating field-level errors.
 */

import type { ValidationErrorDetail } from "@/middleware/error-types";
import { validationError } from "@/utils/error-responses";

/**
 * Validation helper class for collecting field-level errors
 *
 * @example
 * ```typescript
 * validate()
 *   .required('name', body.name)
 *   .minLength('name', body.name, 1)
 *   .arrayNotEmpty('relationships', body.relationships)
 *   .validate('Invalid person data');
 * ```
 */
export class Validator {
  private errors: ValidationErrorDetail[] = [];

  /**
   * Validate required field
   */
  required(field: string, value: unknown, message?: string): this {
    if (value === null || value === undefined || value === "") {
      this.errors.push({
        field,
        message: message || `${field} is required`,
        value,
      });
    }
    return this;
  }

  /**
   * Validate string minimum length
   */
  minLength(field: string, value: string, min: number, message?: string): this {
    if (value && value.length < min) {
      this.errors.push({
        field,
        message: message || `${field} must be at least ${min} characters`,
        value,
      });
    }
    return this;
  }

  /**
   * Validate string maximum length
   */
  maxLength(field: string, value: string, max: number, message?: string): this {
    if (value && value.length > max) {
      this.errors.push({
        field,
        message: message || `${field} must be at most ${max} characters`,
        value,
      });
    }
    return this;
  }

  /**
   * Validate array is not empty
   */
  arrayNotEmpty(field: string, value: unknown[], message?: string): this {
    if (!Array.isArray(value) || value.length === 0) {
      this.errors.push({
        field,
        message: message || `${field} must not be empty`,
        value,
      });
    }
    return this;
  }

  /**
   * Validate number is positive
   */
  positive(field: string, value: number, message?: string): this {
    if (typeof value === "number" && value <= 0) {
      this.errors.push({
        field,
        message: message || `${field} must be positive`,
        value,
      });
    }
    return this;
  }

  /**
   * Validate number is within range
   */
  range(
    field: string,
    value: number,
    min: number,
    max: number,
    message?: string
  ): this {
    if (typeof value === "number" && (value < min || value > max)) {
      this.errors.push({
        field,
        message: message || `${field} must be between ${min} and ${max}`,
        value,
      });
    }
    return this;
  }

  /**
   * Validate email format (basic)
   */
  email(field: string, value: string, message?: string): this {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      this.errors.push({
        field,
        message: message || `${field} must be a valid email address`,
        value,
      });
    }
    return this;
  }

  /**
   * Add custom validation error
   */
  custom(
    field: string,
    condition: boolean,
    message: string,
    value?: unknown
  ): this {
    if (condition) {
      this.errors.push({ field, message, value });
    }
    return this;
  }

  /**
   * Check if validation passed, throw ValidationError if not
   *
   * @param message - Error message to use if validation fails
   * @throws ValidationError if there are any validation errors
   */
  validate(message = "Validation failed"): void {
    if (this.errors.length > 0) {
      validationError(message, this.errors);
    }
  }

  /**
   * Get collected errors without throwing
   */
  getErrors(): ValidationErrorDetail[] {
    return this.errors;
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}

/**
 * Create a new validator instance
 *
 * @example
 * ```typescript
 * const validator = validate();
 * validator.required('name', name);
 * validator.minLength('name', name, 3);
 * validator.validate(); // Throws if errors exist
 * ```
 */
export function validate(): Validator {
  return new Validator();
}
