import type { NativeModule } from 'expo';

export type BankNotificationData = {
  packageName: string;
  id: number;
  title: string;
  text: string;
  bigText: string;
  textLines?: string[];
  subText: string;
  summaryText: string;
  postTime: number;
  key: string;
  eventId?: string;
};

export type BankNotificationListenerEvents = {
  onNotificationReceived: (notification: BankNotificationData) => void;
};

export type PendingPixReport = {
  eventId: string;
  notificationKey: string;
  postTime: number;
  packageName: string;
  amount: string;
  payer: string;
};

export declare class NubankNotificationListenerModule extends NativeModule<BankNotificationListenerEvents> {
  cancelNotification(key: string): void;
  ensurePixSpeechQueued(
    eventId: string,
    key: string,
    postTime: number,
    packageName: string,
    amount: string,
    payer: string,
  ): boolean;
  getPendingPixReports(): PendingPixReport[];
  isMonitoringEnabled(): boolean;
  markPixReportStored(eventId: string): boolean;
  setMonitoringEnabled(enabled: boolean): void;
  isNotificationPermissionGranted(): boolean;
  openNotificationListenerSettings(): void;
  isOverlayPermissionGranted(): boolean;
  openOverlayPermissionSettings(): void;
  showPixOverlay(amount: string, payer: string): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
  startForegroundTracking(): void;
  stopForegroundTracking(): void;
}
