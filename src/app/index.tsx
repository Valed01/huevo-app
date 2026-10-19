import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SiteWebView } from '@/components/site-webview';
import { FALLBACK_THEME_COLOR, isDarkColor } from '@/lib/site';

export default function Index() {
  // Colors of the site's header and tab bar, continued under Android's status and gesture bars.
  const [bars, setBars] = useState({ top: FALLBACK_THEME_COLOR, bottom: FALLBACK_THEME_COLOR });
  const insets = useSafeAreaInsets();
  // A huevo.su link the app was opened with (see +native-intent.tsx).
  const { open } = useLocalSearchParams<{ open?: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: bars.bottom }}>
      <StatusBar style={isDarkColor(bars.top) ? 'light' : 'dark'} />
      <View style={{ height: insets.top, backgroundColor: bars.top }} />
      <SiteWebView
        background={bars.top}
        onThemeColor={(top, bottom) => setBars({ top, bottom: bottom ?? top })}
        openUrl={open}
      />
      <View style={{ height: insets.bottom, backgroundColor: bars.bottom }} />
    </View>
  );
}
