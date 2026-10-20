# The accounts module installs itself into react-native-webview's patched hook by reflection.
-keep class com.reactnativecommunity.webview.RNCWebViewClient {
    public static *** onWebViewCreated;
}
