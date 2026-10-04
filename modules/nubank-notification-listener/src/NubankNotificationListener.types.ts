import type { NativeModule } from 'expo';

export type NubankNotificationData = {
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

export type NubankNotificationListenerEvents = {
  onNotificationReceived: (notification: NubankNotificationData) => void;
};

export declare class NubankNotificationListenerModule extends NativeModule<NubankNotificationListenerEvents> {
  isNotificationPermissionGranted(): boolean;
  openNotificationListenerSettings(): void;
}
