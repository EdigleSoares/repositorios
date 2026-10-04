const { withAndroidManifest } = require('expo/config-plugins');

const LISTENER_SERVICE = 'expo.modules.nubanknotificationlistener.NubankNotificationListenerService';
const LISTENER_ACTION = 'android.service.notification.NotificationListenerService';
const BIND_PERMISSION = 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE';

module.exports = function withNubankNotificationListener(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) {
      throw new Error('Não foi possível encontrar <application> no AndroidManifest.xml.');
    }

    const services = (application.service ??= []);
    const service = services.find((item) => {
      const name = item.$?.['android:name'];
      return name === LISTENER_SERVICE || name === '.NubankNotificationListenerService';
    });

    if (service) {
      service.$ = {
        ...service.$,
        'android:name': LISTENER_SERVICE,
        'android:permission': BIND_PERMISSION,
        'android:exported': 'true',
      };
      service['intent-filter'] ??= [{ action: [{ $: { 'android:name': LISTENER_ACTION } }] }];
    } else {
      services.push({
        $: {
          'android:name': LISTENER_SERVICE,
          'android:permission': BIND_PERMISSION,
          'android:exported': 'true',
        },
        'intent-filter': [{ action: [{ $: { 'android:name': LISTENER_ACTION } }] }],
      });
    }

    return modConfig;
  });
};
