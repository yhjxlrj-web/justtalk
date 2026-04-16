import { PushNotifications } from '@capacitor/push-notifications';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type SetupPushOptions = {
  userId: string;
};

let listenersAttached = false;

export async function setupPush({ userId }: SetupPushOptions) {
  const supabase = createSupabaseBrowserClient();

  const permStatus = await PushNotifications.requestPermissions();

  if (permStatus.receive !== 'granted') {
    console.log('[push] permission not granted');
    return;
  }

  await PushNotifications.createChannel({
    id: 'justtalk-default',
    name: 'JustTalk Notifications',
    description: 'Messages, hearts, and friend requests',
    importance: 5,
    visibility: 1,
    sound: 'default',
    vibration: true
  });

  if (!listenersAttached) {
    PushNotifications.addListener('registration', async (token) => {
      console.log('[push] registration token:', token.value);

      const { error } = await supabase.from('device_push_tokens').upsert(
        {
          user_id: userId,
          fcm_token: token.value,
          platform: 'android',
          is_active: true,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'fcm_token',
        }
      );

      if (error) {
        console.error('[push] failed to save token:', error);
      } else {
        console.log('[push] token saved');
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[push] registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[push] notification received:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[push] notification action:', action);
    });

    listenersAttached = true;
  }

  await PushNotifications.register();
}