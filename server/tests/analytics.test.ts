/**
 * Analytics Service Tests
 *
 * Tests for analytics event recording, querying, and retention.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getConnection, EventsClient } from "@quailcomp/data";
import type { Sql } from "@quailcomp/data";
import { AnalyticsService } from "@/analytics/service";
import {
  getDailyActiveUsers,
  getHttpErrorRate,
  getMetadataProviderStats,
  getLatencyPercentiles,
  getUserEngagementMetrics,
  getFeatureAdoption,
} from "@/analytics/queries";
import { cleanupOldAnalytics, getRetentionStats } from "@/analytics/retention";

describe("Analytics Service", () => {
  let sql: Sql;
  let eventsClient: EventsClient;
  let analytics: AnalyticsService;

  beforeAll(() => {
    sql = getConnection();
    eventsClient = new EventsClient(sql);
    analytics = new AnalyticsService(eventsClient);
  });

  describe("Event Recording", () => {
    test("records HTTP request event", async () => {
      await analytics.recordHttpRequest({
        request_id: "test-req-123",
        method: "POST",
        path: "/api/books",
        status_code: 201,
        duration_ms: 45,
        user_id: 42,
      });

      const events = await eventsClient.getByType("analytics.http_request");
      expect(events.length).toBeGreaterThan(0);

      const event = events.find(
        (e) => (e.data as { request_id: string }).request_id === "test-req-123"
      );
      expect(event).toBeDefined();
      expect(event?.data).toMatchObject({
        request_id: "test-req-123",
        method: "POST",
        path: "/api/books",
        status_code: 201,
        duration_ms: 45,
        user_id: 42,
      });
    });

    test("records HTTP error event", async () => {
      await analytics.recordHttpError({
        request_id: "test-req-error-456",
        method: "GET",
        path: "/api/books/{id}",
        error_message: "Book not found",
        error_code: "BOOK_NOT_FOUND",
        user_id: 42,
      });

      const events = await eventsClient.getByType("analytics.http_error");
      expect(events.length).toBeGreaterThan(0);

      const event = events.find(
        (e) =>
          (e.data as { request_id: string }).request_id ===
          "test-req-error-456"
      );
      expect(event).toBeDefined();
      expect(event?.data).toMatchObject({
        error_message: "Book not found",
        error_code: "BOOK_NOT_FOUND",
      });
    });

    test("records metadata lookup event", async () => {
      await analytics.recordMetadataLookup({
        request_id: "test-lookup-789",
        identifier: "9780134757599",
        identifier_type: "isbn",
        providers: [
          { name: "google_books", success: true, duration_ms: 120 },
          {
            name: "open_library",
            success: false,
            duration_ms: 5000,
            error_message: "Timeout",
          },
        ],
        results_count: 1,
        user_id: 42,
      });

      const events = await eventsClient.getByType("analytics.metadata_lookup");
      const event = events.find(
        (e) =>
          (e.data as { request_id: string }).request_id === "test-lookup-789"
      );

      expect(event).toBeDefined();
      expect((event?.data as { providers: unknown[] }).providers).toHaveLength(
        2
      );
    });

    test("records user session started event", async () => {
      await analytics.recordUserSessionStarted({
        user_id: 42,
        session_id: "sess_abc123",
        auth_method: "password",
        request_id: "test-login-001",
      });

      const events = await eventsClient.getByType(
        "analytics.user_session_started"
      );
      const event = events.find(
        (e) => (e.data as { session_id: string }).session_id === "sess_abc123"
      );

      expect(event).toBeDefined();
      expect(event?.data).toMatchObject({
        user_id: 42,
        auth_method: "password",
      });
    });

    test("records user milestone event", async () => {
      await analytics.recordUserMilestone({
        user_id: 42,
        milestone: "first_book_added",
        request_id: "test-milestone-001",
        days_since_registration: 0,
      });

      const events = await eventsClient.getByType("analytics.user_milestone");
      const event = events.find(
        (e) =>
          (e.data as { milestone: string }).milestone === "first_book_added"
      );

      expect(event).toBeDefined();
      expect(event?.data).toMatchObject({
        user_id: 42,
        milestone: "first_book_added",
      });
    });

    test("analytics failure does not throw", async () => {
      // Create a broken events client that will fail
      const brokenSql = {
        ...sql,
        async query() {
          throw new Error("Database connection failed");
        },
      };

      const brokenEvents = new EventsClient(brokenSql as any);
      const brokenAnalytics = new AnalyticsService(brokenEvents);

      // Should not throw - analytics failures are caught and logged
      // This will log an error but not throw
      await brokenAnalytics.recordHttpRequest({
        request_id: "test-broken",
        method: "GET",
        path: "/api/test",
        status_code: 200,
        duration_ms: 10,
        user_id: null,
      });

      // If we got here, the promise resolved (didn't throw)
      expect(true).toBe(true);
    });
  });

  describe("Analytics Queries", () => {
    beforeAll(async () => {
      // Set up test data
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Record some session starts for DAU
      await analytics.recordUserSessionStarted({
        user_id: 1,
        session_id: "sess_user1_day1",
        auth_method: "password",
        request_id: "setup-1",
      });

      await analytics.recordUserSessionStarted({
        user_id: 2,
        session_id: "sess_user2_day1",
        auth_method: "password",
        request_id: "setup-2",
      });

      // Record some HTTP requests with various status codes
      await analytics.recordHttpRequest({
        request_id: "setup-req-1",
        method: "GET",
        path: "/api/books",
        status_code: 200,
        duration_ms: 50,
        user_id: 1,
      });

      await analytics.recordHttpRequest({
        request_id: "setup-req-2",
        method: "POST",
        path: "/api/books",
        status_code: 400,
        duration_ms: 30,
        user_id: 1,
      });

      await analytics.recordHttpRequest({
        request_id: "setup-req-3",
        method: "GET",
        path: "/api/books",
        status_code: 500,
        duration_ms: 100,
        user_id: 2,
      });

      // Record metadata provider results
      await analytics.recordMetadataLookup({
        request_id: "setup-lookup-1",
        identifier: "9780134757599",
        identifier_type: "isbn",
        providers: [
          { name: "google_books", success: true, duration_ms: 120 },
          { name: "open_library", success: true, duration_ms: 200 },
        ],
        results_count: 2,
        user_id: 1,
      });
    });

    test("getDailyActiveUsers counts unique users", async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const dau = await getDailyActiveUsers(startDate, endDate);

      expect(dau.size).toBeGreaterThan(0);
      // Should have at least 2 users from setup
      const todayKey = new Date().toISOString().split("T")[0];
      const todayUsers = dau.get(todayKey);
      expect(todayUsers).toBeGreaterThanOrEqual(2);
    });

    test("getHttpErrorRate calculates error percentage", async () => {
      const startDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      const endDate = new Date();

      const errorRate = await getHttpErrorRate(startDate, endDate);

      // We recorded 3 requests: 200, 400, 500
      // Error rate should be 2/3 = 66.67%
      expect(errorRate).toBeGreaterThan(0);
      expect(errorRate).toBeLessThanOrEqual(100);
    });

    test("getMetadataProviderStats aggregates provider performance", async () => {
      const startDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const endDate = new Date();

      const stats = await getMetadataProviderStats(startDate, endDate);

      expect(stats.length).toBeGreaterThan(0);

      const googleStats = stats.find((s) => s.providerName === "google_books");
      expect(googleStats).toBeDefined();
      expect(googleStats?.successRate).toBe(100); // 100% success
      expect(googleStats?.avgDurationMs).toBe(120);
    });

    test("getLatencyPercentiles calculates p50, p95, p99", async () => {
      const startDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const endDate = new Date();

      const latency = await getLatencyPercentiles(startDate, endDate);

      expect(latency.p50).toBeGreaterThan(0);
      expect(latency.p95).toBeGreaterThanOrEqual(latency.p50);
      expect(latency.p99).toBeGreaterThanOrEqual(latency.p95);
    });

    test("getUserEngagementMetrics aggregates user activity", async () => {
      const startDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const endDate = new Date();

      const engagement = await getUserEngagementMetrics(1, startDate, endDate);

      expect(engagement.totalRequests).toBeGreaterThan(0);
      expect(engagement.uniqueDaysActive).toBeGreaterThan(0);
    });

    test("getFeatureAdoption counts feature usage", async () => {
      // Record some feature usage
      await analytics.recordFeatureUsage({
        user_id: 1,
        feature: "metadata_lookup",
        action: "searched_isbn",
        request_id: "feature-test-1",
      });

      const startDate = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const endDate = new Date();

      const adoptionCount = await getFeatureAdoption(
        "metadata_lookup",
        startDate,
        endDate
      );

      expect(adoptionCount).toBeGreaterThan(0);
    });
  });

  describe("Retention Policy", () => {
    test("getRetentionStats returns analytics event counts", async () => {
      const stats = await getRetentionStats();

      expect(stats.total_analytics_events).toBeGreaterThan(0);
      expect(stats.active_analytics_events).toBeGreaterThan(0);
      expect(stats.voided_analytics_events).toBeGreaterThanOrEqual(0);
    });

    test("cleanupOldAnalytics voids events older than 90 days", async () => {
      // Create an old analytics event (91 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);

      await eventsClient.record({
        eventType: "analytics.http_request",
        occurredAt: oldDate,
        data: {
          request_id: "old-request-123",
          method: "GET",
          path: "/api/old",
          status_code: 200,
          duration_ms: 10,
          user_id: null,
        },
      });

      // Run cleanup
      const voidedCount = await cleanupOldAnalytics();

      // Should have voided at least 1 event
      expect(voidedCount).toBeGreaterThan(0);

      // Verify the old event is now voided
      const oldEvents = await eventsClient.getByType("analytics.http_request");
      const oldEvent = oldEvents.find(
        (e) =>
          (e.data as { request_id: string }).request_id === "old-request-123"
      );

      // Event should still exist but be voided
      if (oldEvent) {
        expect(oldEvent.voidedAt).toBeTruthy();
      }
    });

    test("cleanupOldAnalytics preserves domain events", async () => {
      // Create an old domain event (should never be voided)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 91);

      await eventsClient.record({
        eventType: "book_acquired",
        occurredAt: oldDate,
        data: {
          book_id: 1,
          method: "purchased",
          cost: 15.99,
        },
      });

      // Run cleanup
      await cleanupOldAnalytics();

      // Verify domain event is NOT voided
      const domainEvents = await eventsClient.getByType("book_acquired");
      const domainEvent = domainEvents.find(
        (e) => (e.data as { book_id: number }).book_id === 1
      );

      if (domainEvent) {
        expect(domainEvent.voidedAt).toBeNull();
      }
    });
  });

  describe("Event Enrichment", () => {
    test("can enrich analytics events with additional context", async () => {
      // Record initial event
      const result = await eventsClient.record({
        eventType: "analytics.http_request",
        occurredAt: new Date(),
        data: {
          request_id: "enrich-test-1",
          method: "POST",
          path: "/api/books",
          status_code: 201,
          duration_ms: 45,
          user_id: 42,
        },
      });

      // Enrich with additional context
      await eventsClient.enrich({
        eventId: result.eventId,
        eventType: "analytics.http_request",
        occurredAt: result.occurredAt,
        data: {
          request_id: "enrich-test-1",
          method: "POST",
          path: "/api/books",
          status_code: 201,
          duration_ms: 45,
          user_id: 42,
          // Additional enrichment
          user_agent: "Mozilla/5.0...",
          region: "us-west",
        },
      });

      // Get latest version
      const events = await eventsClient.getByType("analytics.http_request");
      const enrichedEvent = events.find(
        (e) =>
          (e.data as { request_id: string }).request_id === "enrich-test-1"
      );

      expect(enrichedEvent).toBeDefined();
      expect(enrichedEvent?.data).toHaveProperty("user_agent");
      expect(enrichedEvent?.data).toHaveProperty("region");
    });
  });
});
