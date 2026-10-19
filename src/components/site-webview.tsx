import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { clearMedia, updateMedia } from 'huevo-media';

import { APP_UA_SUFFIX, INJECTED_JS, isInAppUrl, MEDIA_SESSION_SHIM, SITE_URL } from '@/lib/site';

type Props = {
  background: string;
  onThemeColor: (color: string) => void;
};

/** The whole app: huevo.su in a WebView. */
export function SiteWebView({ background, onThemeColor }: Props) {
  const ref = useRef<WebView<object>>(null);
  const canGoBack = useRef(false);
  const [failed, setFailed] = useState(false);

  // Hardware back goes back in the site history; at the start page it exits the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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

  return (
    <WebView<object>
      ref={ref}
      source={{ uri: SITE_URL }}
      style={{ backgroundColor: background }}
      applicationNameForUserAgent={APP_UA_SUFFIX}
      injectedJavaScriptBeforeContentLoaded={MEDIA_SESSION_SHIM}
      injectedJavaScript={INJECTED_JS}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={({ url }) => {
        if (isInAppUrl(url)) return true;
        Linking.openURL(url).catch(() => {});
        return false;
      }}
      onNavigationStateChange={(nav) => {
        canGoBack.current = nav.canGoBack;
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
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontSize: 16, color: '#888' },
  retry: { borderWidth: 1, borderColor: '#888', borderRadius: 6, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#888' },
});
