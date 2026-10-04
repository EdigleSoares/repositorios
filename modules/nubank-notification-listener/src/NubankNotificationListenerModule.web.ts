import { registerWebModule, NativeModule } from 'expo';

// NubankNotificationListenerModule is not available on the web platform.
class NubankNotificationListenerModule extends NativeModule<{}> {}

export default registerWebModule(NubankNotificationListenerModule, 'NubankNotificationListenerModule');
