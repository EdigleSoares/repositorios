import type { NativeModule } from 'expo';

export type BankNotificationData = {
  packageName: string;
  id: number;
  title: string;
  text: string;
  bigText: string;
  subText: string;
  summaryText: string;
  postTime: number;
  key: string;
};

export type BankNotificationListenerEvents = {
  onNotificationReceived: (notification: BankNotificationData) => void;
};

export declare class NubankNotificationListenerModule extends NativeModule<BankNotificationListenerEvents> {
  isNotificationPermissionGranted(): boolean;
  openNotificationListenerSettings(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
  startForegroundTracking(): void;
  stopForegroundTracking(): void;
}
