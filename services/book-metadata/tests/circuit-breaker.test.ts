import { describe, test, expect, beforeEach } from "bun:test";
import { CircuitBreaker, CircuitOpenError } from "@/circuit-breaker";

describe("CircuitBreaker", () => {
  describe("CLOSED State", () => {
    test("starts in CLOSED state", () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe("CLOSED");
      expect(breaker.isOpen()).toBe(false);
    });

    test("allows requests to pass through", async () => {
      const breaker = new CircuitBreaker();

      const result = await breaker.execute(async () => "success");

      expect(result).toBe("success");
      expect(breaker.getState()).toBe("CLOSED");
    });

    test("tracks failures but stays closed below threshold", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });

      // Fail 4 times (below threshold)
      for (let i = 0; i < 4; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("failure");
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("CLOSED");
      expect(breaker.getFailureCount()).toBe(4);
    });

    test("opens circuit when failure threshold is reached", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });

      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("failure");
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("OPEN");
      expect(breaker.isOpen()).toBe(true);
    });

    test("resets failure count on success", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });

      // Fail a few times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("failure");
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getFailureCount()).toBe(3);

      // Succeed once
      await breaker.execute(async () => "success");

      // Failure count should reset
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("OPEN State", () => {
    test("immediately fails requests with CircuitOpenError", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");

      // Next request should fail immediately
      await expect(
        breaker.execute(async () => "should not execute")
      ).rejects.toThrow(CircuitOpenError);
    });

    test("does not execute function when circuit is open", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });
      let executed = false;

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Try to execute (should not run)
      try {
        await breaker.execute(async () => {
          executed = true;
          return "success";
        });
      } catch {
        // Expected
      }

      expect(executed).toBe(false);
    });

    test("transitions to HALF_OPEN after recovery timeout", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 100, // 100ms
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");

      // Wait for recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next execute should transition to HALF_OPEN
      try {
        await breaker.execute(async () => "success");
      } catch {
        // If it fails, that's ok for this test
      }

      expect(breaker.getState()).not.toBe("OPEN");
    });

    test("stays open before recovery timeout elapses", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 1000, // 1 second
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");

      // Try immediately (should still be open)
      await expect(
        breaker.execute(async () => "success")
      ).rejects.toThrow(CircuitOpenError);

      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("HALF_OPEN State", () => {
    test("allows test requests to pass through", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 50,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should allow request and transition to HALF_OPEN
      const result = await breaker.execute(async () => "success");

      expect(result).toBe("success");
      expect(breaker.getState()).not.toBe("OPEN");
    });

    test("closes circuit after success threshold is reached", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 50,
        successThreshold: 2,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Execute twice successfully to close circuit
      await breaker.execute(async () => "success");
      expect(breaker.getState()).toBe("HALF_OPEN");
      expect(breaker.getSuccessCount()).toBe(1);

      await breaker.execute(async () => "success");
      expect(breaker.getState()).toBe("CLOSED");
      expect(breaker.getSuccessCount()).toBe(0);
    });

    test("reopens circuit immediately on failure", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 50,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Transition to HALF_OPEN and succeed once
      await breaker.execute(async () => "success");
      expect(breaker.getState()).toBe("HALF_OPEN");

      // Fail in HALF_OPEN state
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Should immediately return to OPEN
      expect(breaker.getState()).toBe("OPEN");
    });

    test("tracks success count correctly", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 50,
        successThreshold: 3,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Execute 3 times successfully
      await breaker.execute(async () => "success");
      expect(breaker.getSuccessCount()).toBe(1);

      await breaker.execute(async () => "success");
      expect(breaker.getSuccessCount()).toBe(2);

      await breaker.execute(async () => "success");
      expect(breaker.getSuccessCount()).toBe(0); // Reset after closing
      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("State Transitions", () => {
    test("CLOSED -> OPEN -> HALF_OPEN -> CLOSED", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 50,
        successThreshold: 1,
      });

      // Start in CLOSED
      expect(breaker.getState()).toBe("CLOSED");

      // Fail twice to open
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Succeed once to transition to HALF_OPEN and then CLOSED
      await breaker.execute(async () => "success");

      expect(breaker.getState()).toBe("CLOSED");
    });

    test("CLOSED -> OPEN -> HALF_OPEN -> OPEN (on failure)", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 50,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Fail in HALF_OPEN to reopen
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("Configuration", () => {
    test("uses default values when not configured", () => {
      const breaker = new CircuitBreaker();

      // Default failureThreshold is 5
      expect(breaker.getFailureCount()).toBe(0);
    });

    test("respects custom failure threshold", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 10 });

      // Fail 9 times (below threshold)
      for (let i = 0; i < 9; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("failure");
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("CLOSED");

      // 10th failure should open
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");
    });

    test("respects custom recovery timeout", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 200, // 200ms
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Wait less than recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be open
      await expect(
        breaker.execute(async () => "success")
      ).rejects.toThrow(CircuitOpenError);

      // Wait for rest of recovery timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should now transition to HALF_OPEN
      await breaker.execute(async () => "success");
      expect(breaker.getState()).not.toBe("OPEN");
    });

    test("respects custom success threshold", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 50,
        successThreshold: 5,
      });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Need 5 successes to close
      for (let i = 0; i < 4; i++) {
        await breaker.execute(async () => "success");
        expect(breaker.getState()).toBe("HALF_OPEN");
      }

      // 5th success should close
      await breaker.execute(async () => "success");
      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("reset()", () => {
    test("resets to CLOSED state", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");

      // Reset
      breaker.reset();

      expect(breaker.getState()).toBe("CLOSED");
      expect(breaker.getFailureCount()).toBe(0);
    });

    test("clears failure count", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 5 });

      // Fail a few times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error("failure");
          });
        } catch {
          // Expected
        }
      }

      expect(breaker.getFailureCount()).toBe(3);

      // Reset
      breaker.reset();

      expect(breaker.getFailureCount()).toBe(0);
    });

    test("clears success count", async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeout: 50,
        successThreshold: 3,
      });

      // Open and transition to HALF_OPEN
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Succeed once
      await breaker.execute(async () => "success");
      expect(breaker.getSuccessCount()).toBe(1);

      // Reset
      breaker.reset();

      expect(breaker.getSuccessCount()).toBe(0);
      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("Error Propagation", () => {
    test("propagates original error from function", async () => {
      const breaker = new CircuitBreaker();

      const customError = new Error("custom error message");

      await expect(
        breaker.execute(async () => {
          throw customError;
        })
      ).rejects.toThrow("custom error message");
    });

    test("throws CircuitOpenError when circuit is open", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });

      // Open the circuit
      try {
        await breaker.execute(async () => {
          throw new Error("failure");
        });
      } catch {
        // Expected
      }

      // Should throw CircuitOpenError
      await expect(
        breaker.execute(async () => "success")
      ).rejects.toThrow(CircuitOpenError);
    });
  });
});
