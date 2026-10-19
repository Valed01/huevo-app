import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SiteWebView } from '@/components/site-webview';
import { FALLBACK_THEME_COLOR, isDarkColor } from '@/lib/site';

export default function Index() {
  const [themeColor, setThemeColor] = useState(FALLBACK_THEME_COLOR);
  // A huevo.su link the app was opened with (see +native-intent.tsx).
  const { open } = useLocalSearchParams<{ open?: string }>();

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: themeColor }}>
      <StatusBar style={isDarkColor(themeColor) ? 'light' : 'dark'} />
      <SiteWebView background={themeColor} onThemeColor={setThemeColor} openUrl={open} />
    </SafeAreaView>
  );
}
