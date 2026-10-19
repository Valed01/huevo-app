import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SiteWebView } from '@/components/site-webview';
import { FALLBACK_THEME_COLOR, isDarkColor } from '@/lib/site';

export default function Index() {
  const [themeColor, setThemeColor] = useState(FALLBACK_THEME_COLOR);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: themeColor }}>
      <StatusBar style={isDarkColor(themeColor) ? 'light' : 'dark'} />
      <SiteWebView background={themeColor} onThemeColor={setThemeColor} />
    </SafeAreaView>
  );
}
