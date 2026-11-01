import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isTelemetryEnabled,
  setTelemetryEnabled,
  scrubSensitiveData,
  scrubError,
  scrubObject,
  trackEvent,
  trackFirstLabelExport,
  trackFirstRecordingSaved,
  reportError,
  __recordedAnalyticsEvents,
  __recordedErrorReports
} from './telemetry';
import { ALLOWED_ANALYTICS_EVENTS, type AnalyticsEvent } from '../config/telemetryConfig';

describe('Telemetry & Error Monitoring with Scrubbing', () => {
  beforeEach(async () => {
    localStorage.clear();
    __recordedAnalyticsEvents.length = 0;
    __recordedErrorReports.length = 0;
    await setTelemetryEnabled(false);
  });

  afterEach(async () => {
    localStorage.clear();
    await setTelemetryEnabled(false);
    vi.restoreAllMocks();
  });

  describe('Sensitive Data Scrubber (proves scrubbing works)', () => {
    it('redacts Air Waybill (AWB) tracking numbers across all couriers', () => {
      const input =
        'Scanned AWB-DELHIVERY-12345 and AWB: 5894372819 along with Flipkart FMPP0982341201 and Meesho MSH998877665544';
      const scrubbed = scrubSensitiveData(input);

      expect(scrubbed).not.toContain('AWB-DELHIVERY-12345');
      expect(scrubbed).not.toContain('5894372819');
      expect(scrubbed).not.toContain('FMPP0982341201');
      expect(scrubbed).not.toContain('MSH998877665544');
      expect(scrubbed).toContain('[REDACTED_AWB]');
    });

    it('redacts marketplace Order IDs from Meesho, Flipkart, and Amazon India', () => {
      const input =
        'Failed for ORD-998877 and Flipkart OD3928192831 and Amazon India order 404-0000000-0000001 with orderId: 987654321';
      const scrubbed = scrubSensitiveData(input);

      expect(scrubbed).not.toContain('ORD-998877');
      expect(scrubbed).not.toContain('OD3928192831');
      expect(scrubbed).not.toContain('404-0000000-0000001');
      expect(scrubbed).toContain('[REDACTED_ORDER]');
    });

    it('redacts Stock Keeping Units (SKUs) and product codes', () => {
      const input =
        'SKU-TSHIRT-RED-M not matched in database; also SKU: JEANS-32 and catalog item KURTI-COTTON-ROYAL-BLUE-XL';
      const scrubbed = scrubSensitiveData(input);

      expect(scrubbed).not.toContain('SKU-TSHIRT-RED-M');
      expect(scrubbed).not.toContain('KURTI-COTTON-ROYAL-BLUE-XL');
      expect(scrubbed).toContain('[REDACTED_SKU]');
    });

    it('redacts absolute filesystem paths and document/video file names', () => {
      const windowsPath =
        'Error reading C:\\Users\\Warehouse\\Documents\\Labels\\sample_labels_meesho.pdf';
      const unixPath =
        'Failed writing /home/user/vault/2026-11-01/Dispatch/5894372819/5894372819_Video.mp4';
      const filenameOnly = 'Could not parse unboxing_evidence.webm or receipt.jpg';

      expect(scrubSensitiveData(windowsPath)).not.toContain('C:\\Users');
      expect(scrubSensitiveData(windowsPath)).not.toContain('sample_labels_meesho.pdf');
      expect(scrubSensitiveData(windowsPath)).toContain('[REDACTED_PATH]');

      expect(scrubSensitiveData(unixPath)).not.toContain('/home/user');
      expect(scrubSensitiveData(unixPath)).not.toContain('5894372819_Video.mp4');
      expect(scrubSensitiveData(unixPath)).toContain('[REDACTED_PATH]');

      expect(scrubSensitiveData(filenameOnly)).not.toContain('unboxing_evidence.webm');
      expect(scrubSensitiveData(filenameOnly)).not.toContain('receipt.jpg');
      expect(scrubSensitiveData(filenameOnly)).toContain('[REDACTED_FILE]');
    });

    it('redacts personal phone numbers and email addresses', () => {
      const text = 'Contact seller at +919876543210 or email seller.desk@gmail.com for details';
      const scrubbed = scrubSensitiveData(text);

      expect(scrubbed).not.toContain('9876543210');
      expect(scrubbed).not.toContain('seller.desk@gmail.com');
      expect(scrubbed).toContain('[REDACTED_PHONE]');
      expect(scrubbed).toContain('[REDACTED_EMAIL]');
    });

    it('scrubs Error message and stack traces thoroughly', () => {
      const sensitiveError = new Error(
        'Failed to process file C:\\Users\\Seller\\Desktop\\flipkart_order.pdf for AWB FMPP0982341201 and SKU TSHIRT-BLK-L'
      );
      sensitiveError.stack = `Error: Failed to process file C:\\Users\\Seller\\Desktop\\flipkart_order.pdf
    at Object.processLabel (C:\\Users\\Seller\\Desktop\\claimproof\\src\\pdf.ts:42:15)
    at runTask (C:\\Users\\Seller\\Desktop\\claimproof\\src\\main.ts:10:5)`;

      const scrubbed = scrubError(sensitiveError);

      expect(scrubbed.message).not.toContain('C:\\Users');
      expect(scrubbed.message).not.toContain('FMPP0982341201');
      expect(scrubbed.message).not.toContain('TSHIRT-BLK-L');
      expect(scrubbed.message).toContain('[REDACTED_PATH]');
      expect(scrubbed.message).toContain('[REDACTED_AWB]');
      expect(scrubbed.message).toContain('[REDACTED_SKU]');

      expect(scrubbed.stack).toBeDefined();
      expect(scrubbed.stack).not.toContain('C:\\Users\\Seller');
      expect(scrubbed.stack).toContain('[REDACTED_PATH]');
      // Line numbers are preserved for debugging
      expect(scrubbed.stack).toContain(':42:15');
    });

    it('recursively scrubs objects and eliminates sensitive dictionary keys', () => {
      const sensitiveContext = {
        awb: '5894372819',
        orderId: 'ORD-998877',
        sku: 'JEANS-32',
        filePath: 'C:\\Vault\\video.mp4',
        safeMetadata: 'Component crashed while rendering review table'
      };

      const scrubbed = scrubObject(sensitiveContext);

      expect(scrubbed.awb).toBe('[REDACTED_FIELD]');
      expect(scrubbed.orderId).toBe('[REDACTED_FIELD]');
      expect(scrubbed.sku).toBe('[REDACTED_FIELD]');
      expect(scrubbed.filePath).toBe('[REDACTED_FIELD]');
      expect(scrubbed.safeMetadata).toBe('Component crashed while rendering review table');
    });
  });

  describe('Opt-In Product Analytics', () => {
    it('is strictly disabled by default (opt-in only)', () => {
      expect(isTelemetryEnabled()).toBe(false);
    });

    it('does not send any events when disabled', async () => {
      const result = await trackEvent('onboarding_completed');
      expect(result).toBe(false);
      expect(__recordedAnalyticsEvents.length).toBe(0);
    });

    it('tracks only the 5 allowed milestone events when opted in', async () => {
      await setTelemetryEnabled(true);
      expect(isTelemetryEnabled()).toBe(true);

      for (const eventName of ALLOWED_ANALYTICS_EVENTS) {
        const ok = await trackEvent(eventName);
        expect(ok).toBe(true);
      }

      expect(__recordedAnalyticsEvents.length).toBe(5);
      const recordedNames = __recordedAnalyticsEvents.map((e) => e.name);
      expect(recordedNames).toEqual([
        'onboarding_completed',
        'first_label_export',
        'first_recording_saved',
        'paywall_viewed',
        'purchase_started'
      ]);
    });

    it('rejects disallowed arbitrary event names even when opted in', async () => {
      await setTelemetryEnabled(true);

      // Attempting to track arbitrary / tracking events
      const result = await trackEvent('user_search_query' as AnalyticsEvent);
      expect(result).toBe(false);
      expect(__recordedAnalyticsEvents.length).toBe(0);
    });

    it('filters out sensitive properties from event props', async () => {
      await setTelemetryEnabled(true);

      await trackEvent('paywall_viewed', {
        plan: 'claimradar',
        interval: 'annual',
        awb: '5894372819' as unknown as string,
        orderId: 'OD12345' as unknown as string
      });

      expect(__recordedAnalyticsEvents.length).toBe(1);
      const recorded = __recordedAnalyticsEvents[0];
      expect(recorded.props).toBeDefined();
      expect(recorded.props?.plan).toBe('claimradar');
      expect(recorded.props?.interval).toBe('annual');
      // AWB and OrderId props must be omitted
      expect(recorded.props?.awb).toBeUndefined();
      expect(recorded.props?.orderId).toBeUndefined();
    });

    it('enforces that first_label_export and first_recording_saved only fire once', async () => {
      await setTelemetryEnabled(true);

      // First label export
      const first1 = await trackFirstLabelExport();
      expect(first1).toBe(true);

      // Second attempt
      const first2 = await trackFirstLabelExport();
      expect(first2).toBe(false);

      // First recording saved
      const rec1 = await trackFirstRecordingSaved();
      expect(rec1).toBe(true);

      // Second attempt
      const rec2 = await trackFirstRecordingSaved();
      expect(rec2).toBe(false);
    });
  });

  describe('Error Monitoring', () => {
    it('does not send error reports when disabled', async () => {
      const result = await reportError(new Error('Sample crash'));
      expect(result).toBe(false);
      expect(__recordedErrorReports.length).toBe(0);
    });

    it('dispatches scrubbed Sentry-compatible error report when opted in', async () => {
      await setTelemetryEnabled(true);

      const err = new Error(
        'Crash in VideoRecorder for AWB 5894372819 at C:\\Vault\\2026-11-01\\video.mp4'
      );
      const result = await reportError(err, { extraInfo: 'Station 1 crash' });

      expect(result).toBe(true);
      expect(__recordedErrorReports.length).toBe(1);

      const report = __recordedErrorReports[0];
      expect(report.platform).toBe('javascript');
      expect(report.level).toBe('error');
      expect(report.exception.values[0].value).not.toContain('5894372819');
      expect(report.exception.values[0].value).not.toContain('C:\\Vault');
      expect(report.exception.values[0].value).toContain('[REDACTED_AWB]');
      expect(report.exception.values[0].value).toContain('[REDACTED_PATH]');
    });
  });
});
