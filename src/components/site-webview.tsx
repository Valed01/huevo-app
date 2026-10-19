import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';

import { clearMedia, updateMedia } from 'huevo-media';
import {
  addOpenPathListener,
  openNotificationSettings,
  setPermissionAsked,
  startNotifications,
  takeLaunchPath,
  wasPermissionAsked,
} from 'huevo-notify';
import {
  addShowUpdateListener,
  addUpdateProgressListener,
  checkForUpdate,
  installUpdate,
  skipUpdate,
  snoozeUpdate,
  startUpdateChecks,
  takeUpdateLaunchRequest,
  type Release,
} from 'huevo-update';
// Importing installs the server for the bundled themes extension (before the WebView loads).
import { saveToDownloads } from 'huevo-themes';

import {
  APP_UA_SUFFIX,
  APP_UI_JS,
  GITHUB_REPO,
  INJECTED_JS,
  isInAppUrl,
  MEDIA_SESSION_SHIM,
  SITE_URL,
  THEMES_LOADER,
} from '@/lib/site';

const BEFORE_LOAD = MEDIA_SESSION_SHIM + THEMES_LOADER;

/**
 * Google doesn't allow its sign-in inside WebViews, so that page opens in a Custom
 * Tab. The site started the sign-in here (its state cookie lives in the WebView);
 * Google then returns to https://huevo.su/auth/google/..., which Android hands back
 * to the app (huevo.su links set to open in the app) and the WebView finishes it.
 */
function isGoogleSignIn(url: string) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'accounts.google.com' || hostname.endsWith('.accounts.google.com');
  } catch {
    return false;
  }
}

/**
 * First launch: ask once for everything the site uses — notifications (Android 13+),
 * microphone (voice messages, calls) and camera (video calls). Never asks again;
 * anything declined can be turned on in Android settings.
 */
async function askPermissionsOnce() {
  if (Platform.OS !== 'android' || wasPermissionAsked()) return;
  setPermissionAsked();
  const wanted = [
    ...(Platform.Version >= 33 ? [PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] : []),
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    PermissionsAndroid.PERMISSIONS.CAMERA,
  ];
  await PermissionsAndroid.requestMultiple(wanted).catch(() => null);
}

type Props = {
  background: string;
  onThemeColor: (color: string) => void;
  /** huevo.su link the app was opened with. */
  openUrl?: string;
};

/** The whole app: huevo.su in a WebView. */
export function SiteWebView({ background, onThemeColor, openUrl }: Props) {
  const ref = useRef<WebView<object>>(null);
  const canGoBack = useRef(false);
  const themesOpen = useRef(false);
  const release = useRef<Release | null>(null);
  const updateChecked = useRef(false);
  const [failed, setFailed] = useState(false);
  // Pull to refresh: allowed only at the top of the page and when the touch isn't on a
  // scrolled block or overlay (reported by the page, see APP_UI_JS).
  const [atTop, setAtTop] = useState(true);
  const [touchOk, setTouchOk] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Opened from a huevo.su link or a notification: start on that page.
  const [startUrl] = useState(() => {
    if (openUrl && isInAppUrl(openUrl)) return openUrl;
    const path = takeLaunchPath();
    return path ? SITE_URL + path.replace(/^\/+/, '') : SITE_URL;
  });

  // A huevo.su link opened while the app is running (also the Google sign-in return).
  const lastOpen = useRef(openUrl);
  useEffect(() => {
    if (!openUrl || openUrl === lastOpen.current || !isInAppUrl(openUrl)) return;
    lastOpen.current = openUrl;
    ref.current?.injectJavaScript(`location.href = ${JSON.stringify(openUrl)}; true;`);
  }, [openUrl]);

  useEffect(() => {
    askPermissionsOnce();
    startNotifications(APP_UA_SUFFIX);
    // Notification tapped while the app is running: go to its page (pjax navigation when available).
    const sub = addOpenPathListener((path) => {
      const target = JSON.stringify(path);
      ref.current?.injectJavaScript(
        `window.hueNavigate ? window.hueNavigate(${target}, true) : (location.href = ${target}); true;`,
      );
    });
    return () => sub.remove();
  }, []);

  const js = (code: string) => ref.current?.injectJavaScript(`${code}; true;`);

  // Shows the "new version" dialog (built in the page with the site's components).
  const offerUpdate = async (opts: { force?: boolean; ignoreSnooze?: boolean }) => {
    const found = await checkForUpdate(opts).catch(() => null);
    if (!found) return;
    release.current = found;
    js(`window.__huevoUpdate && window.__huevoUpdate.show(${JSON.stringify(found)})`);
  };

  // Daily background check + "update available" notification taps.
  useEffect(() => {
    startUpdateChecks(GITHUB_REPO);
    const show = addShowUpdateListener(() => offerUpdate({ force: true, ignoreSnooze: true }));
    const progress = addUpdateProgressListener((pct) =>
      js(`window.__huevoUpdate && window.__huevoUpdate.progress(${pct})`),
    );
    return () => {
      show.remove();
      progress.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hardware back goes back in the site history; at the start page it exits the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (release.current) {
        // Back on the update dialog = "Позже".
        snoozeUpdate();
        release.current = null;
        js('window.__huevoUpdate && window.__huevoUpdate.close()');
        return true;
      }
      if (themesOpen.current) {
        ref.current?.injectJavaScript('window.__huevoThemes && window.__huevoThemes.back(); true;');
        return true;
      }
      if (!canGoBack.current) return false;
      ref.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Notification buttons are handled natively (they must work while the app is in background).
  useEffect(() => () => clearMedia(), []);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'theme' && typeof msg.color === 'string') onThemeColor(msg.color);
      if (msg?.type === 'themes-sheet') themesOpen.current = !!msg.open;
      if (msg?.type === 'open-notification-settings') openNotificationSettings();
      if (msg?.type === 'pull-refresh') setTouchOk(!!msg.ok);
      if (msg?.type === 'update-install' && release.current) {
        installUpdate(release.current).catch(() =>
          js(
            `window.__huevoUpdate && window.__huevoUpdate.error(${JSON.stringify('Не удалось скачать обновление. Проверьте интернет и попробуйте ещё раз.')})`,
          ),
        );
      }
      if (msg?.type === 'update-later') {
        snoozeUpdate();
        release.current = null;
      }
      if (msg?.type === 'update-skip' && typeof msg.tag === 'string') {
        skipUpdate(msg.tag);
        release.current = null;
      }
      if (msg?.type === 'download' && typeof msg.data === 'string') {
        saveToDownloads(String(msg.name || 'file'), msg.data, String(msg.mime || 'application/octet-stream')).catch(
          () => {},
        );
      }
      if (msg?.type === 'media') {
        if (msg.clear) clearMedia();
        else updateMedia(msg);
      }
    } catch {
      // not ours
    }
  };

  if (failed) {
    return (
      <View style={[styles.center, { backgroundColor: background }]}>
        <Text style={styles.errorText}>Не удалось загрузить huEVO</Text>
        <Pressable style={styles.retry} onPress={() => setFailed(false)}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  const onRefresh = () => {
    setRefreshing(true);
    ref.current?.reload();
    // The spinner ends with the load; don't let a stalled page keep it forever.
    setTimeout(() => setRefreshing(false), 15000);
  };

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.fill}
      scrollEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          enabled={atTop && touchOk}
          onRefresh={onRefresh}
          colors={['#B01E1E']}
          progressBackgroundColor={background}
        />
      }>
      <WebView<object>
        ref={ref}
        source={{ uri: startUrl }}
        style={{ backgroundColor: background }}
        applicationNameForUserAgent={APP_UA_SUFFIX}
        injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
        injectedJavaScript={INJECTED_JS + APP_UI_JS}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={({ url }) => {
          if (isInAppUrl(url)) return true;
          if (isGoogleSignIn(url)) {
            WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
            return false;
          }
          Linking.openURL(url).catch(() => {});
          return false;
        }}
        onNavigationStateChange={(nav) => {
          canGoBack.current = nav.canGoBack;
          if (nav.loading) themesOpen.current = false;
          if (!nav.loading) {
            // Once per launch, after the first page is up: offer an update if there is one.
            if (!updateChecked.current && isInAppUrl(nav.url)) {
              updateChecked.current = true;
              const fromNotification = takeUpdateLaunchRequest();
              offerUpdate({ force: fromNotification, ignoreSnooze: fromNotification });
            }
          }
        }}
        onError={() => setFailed(true)}
        onRenderProcessGone={() => {
          clearMedia();
          ref.current?.reload();
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: background }]}>
            <ActivityIndicator color="#888" />
          </View>
        )}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically
        domStorageEnabled
        thirdPartyCookiesEnabled
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        overScrollMode="never"
        // Local builds only: EXPO_PUBLIC_WEBVIEW_DEBUG=1 enables chrome://inspect for the site.
        webviewDebuggingEnabled={process.env.EXPO_PUBLIC_WEBVIEW_DEBUG === '1'}
        onScroll={(e: { nativeEvent: { contentOffset: { y: number } } }) =>
          setAtTop(e.nativeEvent.contentOffset.y <= 0)
        }
        onLoadEnd={() => setRefreshing(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 16, color: '#888' },
  retry: { borderWidth: 1, borderColor: '#888', borderRadius: 6, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#888' },
});
