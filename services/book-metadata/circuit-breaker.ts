/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by failing fast when a provider is down.
 * Implements the circuit breaker pattern with three states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is failing, requests fail immediately
 * - HALF_OPEN: Testing if provider has recovered
 *
 * This is useful for protecting against failing external services.
 */

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Configuration for circuit breaker behavior
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in milliseconds before trying again after opening (default: 60000) */
  recoveryTimeout?: number;
  /** Number of consecutive successes in HALF_OPEN before closing (default: 2) */
  successThreshold?: number;
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor() {
    super("Circuit breaker is OPEN");
    this.name = "CircuitOpenError";
  }
}

/**
 * Circuit breaker implementation.
 *
 * Tracks failures and automatically opens the circuit when a threshold is reached.
 * After a recovery timeout, enters HALF_OPEN state to test if the service has recovered.
 *
 * @example
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   recoveryTimeout: 60000,
 *   successThreshold: 2
 * });
 *
 * try {
 *   await breaker.execute(async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw new Error('HTTP error');
 *     return response.json();
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Circuit is open, don't try to make request
 *   } else {
 *     // Other error from the request
 *   }
 * }
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly successThreshold: number;

  /**
   * Create a new circuit breaker.
   *
   * @param config - Circuit breaker configuration
   */
  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.recoveryTimeout = config.recoveryTimeout ?? 60000;
    this.successThreshold = config.successThreshold ?? 2;
  }

  /**
   * Execute a function with circuit breaker protection.
   *
   * If the circuit is OPEN, immediately throws CircuitOpenError.
   * If the circuit is CLOSED or HALF_OPEN, executes the function and tracks success/failure.
   *
   * @param fn - Async function to execute
   * @returns Promise resolving to the function's return value
   * @throws CircuitOpenError if circuit is open
   * @throws Whatever error the function throws on failure
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If circuit is open, check if recovery timeout has elapsed
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new CircuitOpenError();
      }
      // Try half-open state
      this.state = "HALF_OPEN";
      this.successCount = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get the current circuit breaker state.
   *
   * @returns Current state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get the current failure count.
   *
   * This is useful for monitoring or debugging circuit breaker behavior.
   *
   * @returns Current consecutive failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Get the current success count (in HALF_OPEN state).
   *
   * This is useful for monitoring or debugging circuit breaker behavior.
   *
   * @returns Current consecutive success count in HALF_OPEN state
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * Check if the circuit is open.
   *
   * @returns true if circuit is OPEN, false otherwise
   */
  isOpen(): boolean {
    return this.state === "OPEN";
  }

  /**
   * Reset the circuit breaker to CLOSED state.
   *
   * This is useful for testing or manual intervention.
   */
  reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Handle successful execution.
   *
   * In CLOSED state: does nothing (already working)
   * In HALF_OPEN state: increments success count, closes circuit if threshold reached
   */
  private onSuccess(): void {
    this.failures = 0;

    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = "CLOSED";
        this.successCount = 0;
      }
    }
  }

  /**
   * Handle failed execution.
   *
   * Increments failure count and opens circuit if threshold reached.
   * In HALF_OPEN state, immediately opens circuit on any failure.
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // In HALF_OPEN, any failure immediately opens the circuit
      this.state = "OPEN";
    } else if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }
}
