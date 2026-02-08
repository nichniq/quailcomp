/**
 * Analytics Service
 *
 * Centralized service for recording analytics events to the events table.
 * Provides type-safe recording functions for each analytics event type.
 *
 * Key features:
 * - Type-safe event recording using domain types
 * - Error handling (analytics failures don't break app)
 * - Async/non-blocking to minimize request latency
 * - Uses existing EventsClient for append-only storage
 *
 * All analytics events use the 'analytics.*' prefix and have 90-day retention.
 */

import { EventsClient, getConnection } from "@quailcomp/data";
import type {
  HttpRequestEvent,
  HttpErrorEvent,
  MetadataLookupEvent,
  UserSessionStartedEvent,
  UserSessionEndedEvent,
  UserMilestoneEvent,
  FeatureUsageEvent,
} from "@domains/types/analytics";
import { createLogger } from "@/logging/logger";

const analyticsLogger = createLogger().child({ context: "analytics" });

/**
 * Analytics service for recording observability events
 */
export class AnalyticsService {
  constructor(private events: EventsClient) {}

  /**
   * Record HTTP request analytics event
   *
   * Tracks API request performance, status codes, and user context.
   * Recorded for every HTTP request via middleware.
   */
  async recordHttpRequest(data: HttpRequestEvent): Promise<void> {
    try {
      await this.events.record({
        eventType: "analytics.http_request",
        occurredAt: new Date(),
        data,
      });
    } catch (error) {
      analyticsLogger.error("Failed to record HTTP request analytics", {
        error:
          error instanceof Error ? error.message : String(error),
        request_id: data.request_id,
      });
    }
  }

  /**
   * Record HTTP error analytics event
   *
   * Captures detailed error information including stack traces and error codes.
   * Recorded when requests fail via middleware error handling.
   */
  async recordHttpError(data: HttpErrorEvent): Promise<void> {
    try {
      await this.events.record({
        eventType: "analytics.http_error",
        occurredAt: new Date(),
        data,
      });
    } catch (error) {
      analyticsLogger.error("Failed to record HTTP error analytics", {
        error:
          error instanceof Error ? error.message : String(error),
        request_id: data.request_id,
      });
    }
  }

  /**
   * Record metadata lookup analytics event
   *
   * Tracks external provider performance, success rates, and response times.
   * Recorded after querying book metadata providers.
   */
  async recordMetadataLookup(data: MetadataLookupEvent): Promise<void> {
    try {
      await this.events.record({
        eventType: "analytics.metadata_lookup",
        occurredAt: new Date(),
        data,
      });
    } catch (error) {
      analyticsLogger.error("Failed to record metadata lookup analytics", {
        error:
          error instanceof Error ? error.message : String(error),
        request_id: data.request_id,
      });
    }
  }

  /**
   * Record user session started event
   *
   * Tracks when users begin authenticated sessions.
   * Recorded during login/authentication.
   */
  async recordUserSessionStarted(
    data: UserSessionStartedEvent
  ): Promise<void> {
    try {
      await this.events.record({
        eventType: "analytics.user_session_started",
        occurredAt: new Date(),
        data,
      });
    } catch (error) {
      analyticsLogger.error("Failed to record session start analytics", {
        error:
          error instanceof Error ? error.message : String(error),
        user_id: data.user_id,
        session_id: data.session_id,
      });
    }
  }

  /**
   * Record user session ended event
   *
   * Tracks when users end authenticated sessions and calculates duration.
   * Recorded during logout or session expiration.
   */
  async recordUserSessionEnded(data: UserSessionEndedEvent): Promise<void> {
    try {
      await this.events.record({
        eventType: "analytics.user_session_ended",
        occurredAt: new Date(),
        data,
      });
    } catch (error) {
      analyticsLogger.error("Failed to record session end analytics", {
        error:
          error instanceof Error ? error.message : String(error),
        user_id: data.user_id,
        session_id: data.session_id,
      });
    }
  }

  /**
   * Record user milestone event
   *
   * Tracks significant user journey events like registration, first book, etc.
   * Enables cohort analysis and onboarding funnel optimization.
   */
  async recordUserMilestone(data: UserMilestoneEvent): Promise<void> {
    try {
      await this.events.record({
        eventType: "analytics.user_milestone",
        occurredAt: new Date(),
        data,
      });
    } catch (error) {
      analyticsLogger.error("Failed to record user milestone analytics", {
        error:
          error instanceof Error ? error.message : String(error),
        user_id: data.user_id,
        milestone: data.milestone,
      });
    }
  }

  /**
   * Record feature usage event
   *
   * Tracks which features are being used and by whom.
   * Informs product decisions about feature investment.
   */
  async recordFeatureUsage(data: FeatureUsageEvent): Promise<void> {
    try {
      await this.events.record({
        eventType: "analytics.feature_used",
        occurredAt: new Date(),
        data,
      });
    } catch (error) {
      analyticsLogger.error("Failed to record feature usage analytics", {
        error:
          error instanceof Error ? error.message : String(error),
        user_id: data.user_id,
        feature: data.feature,
      });
    }
  }
}

/**
 * Singleton analytics service instance
 *
 * Use this instance throughout the application:
 *
 * ```typescript
 * import { analytics } from '@/analytics/service';
 *
 * await analytics.recordHttpRequest({
 *   request_id: ctx.requestId,
 *   method: 'POST',
 *   path: '/api/books',
 *   status_code: 201,
 *   duration_ms: 45,
 *   user_id: ctx.user?.userId ?? null,
 * });
 * ```
 */
export const analytics = new AnalyticsService(new EventsClient(getConnection()));
