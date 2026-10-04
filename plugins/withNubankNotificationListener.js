const { withAndroidManifest } = require('expo/config-plugins');

const LISTENER_SERVICE = 'expo.modules.nubanknotificationlistener.NubankNotificationListenerService';
const LISTENER_ACTION = 'android.service.notification.NotificationListenerService';
const BIND_PERMISSION = 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE';
const FOREGROUND_SERVICE =
  'expo.modules.nubanknotificationlistener.PixFalaForegroundService';
const FOREGROUND_PERMISSION = 'android.permission.FOREGROUND_SERVICE';
const SPECIAL_USE_PERMISSION = 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE';
const POST_NOTIFICATIONS_PERMISSION = 'android.permission.POST_NOTIFICATIONS';

module.exports = function withNubankNotificationListener(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const permissions = (manifest['uses-permission'] ??= []);
    for (const permission of [
      FOREGROUND_PERMISSION,
      SPECIAL_USE_PERMISSION,
      POST_NOTIFICATIONS_PERMISSION,
    ]) {
      if (!permissions.some((item) => item.$?.['android:name'] === permission)) {
        permissions.push({ $: { 'android:name': permission } });
      }
    }

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

    if (!services.some((item) => item.$?.['android:name'] === FOREGROUND_SERVICE)) {
      services.push({
        $: {
          'android:name': FOREGROUND_SERVICE,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
        property: [{
          $: {
            'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
            'android:value': 'Monitora Pix recebidos após autorização expressa do usuário.',
          },
        }],
      });
    }

    return modConfig;
  });
};
