import { requireNativeModule } from 'expo';
import type { NubankNotificationListenerModule as NubankNotificationListenerModuleType } from './NubankNotificationListener.types';

export default requireNativeModule<NubankNotificationListenerModuleType>('NubankNotificationListener');
