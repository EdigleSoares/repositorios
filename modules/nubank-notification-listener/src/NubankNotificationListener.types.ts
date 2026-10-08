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
  cancelNotification(key: string): void;
  confirmPixStored(key: string, postTime: number): void;
  enqueueJavascriptFallback(
    key: string,
    postTime: number,
    packageName: string,
    amount: string,
    payer: string,
  ): boolean;
  claimJavascriptSpeech(
    key: string,
    postTime: number,
  ): 'claimed' | 'native-speaking' | 'native-fallback' | 'not-found';
  completeJavascriptSpeech(key: string, postTime: number): boolean;
  isMonitoringEnabled(): boolean;
  releaseJavascriptSpeech(key: string, postTime: number): boolean;
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
