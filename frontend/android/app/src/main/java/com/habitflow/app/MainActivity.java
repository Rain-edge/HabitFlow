package com.habitflow.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Reserve the system-bar space by padding the WebView host, so the app
        // content (logo, theme toggle, notifications…) never sits under the
        // status bar / cutout / gesture bar — the approach used by most apps:
        // the whole page simply starts below the status bar.
        //
        // This REPLACES the SystemBars plugin's insets listener (it is a "set",
        // not "add"), whose passthrough branch can zero the host padding again
        // (WebView >= 140 + viewport-fit=cover), which previously let content
        // slip back under the status bar.
        getBridge().getWebView().post(() -> attachInsetsHandler());

        // Re-apply once the page is loaded (DOM ready, window insets stable).
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(android.webkit.WebView webView) {
                super.onPageLoaded(webView);
                applyPadding();
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyPadding();
    }

    /** Status-bar height from the system resource — reliable on every ROM,
     *  including cutout / punch-hole devices, independent of insets dispatch. */
    private int statusBarHeight() {
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    private int navBarHeight() {
        int id = getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        return id > 0 ? getResources().getDimensionPixelSize(id) : 0;
    }

    /** Compute top/bottom reserves: prefer real window insets when they are
     *  non-zero (edge-to-edge on Android 15+), fall back to system resources. */
    private void applyPadding() {
        View host = (View) getBridge().getWebView().getParent();
        if (host == null) return;
        int top = statusBarHeight();
        int bottom = navBarHeight();

        WindowInsetsCompat root = ViewCompat.getRootWindowInsets(host);
        if (root != null) {
            Insets bars = root.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            // On edge-to-edge windows insets.top equals the status-bar height;
            // on legacy windows it is 0 (the window already starts below it),
            // so keep the resource value in that case as well — safe either way.
            if (bars.top > 0) top = bars.top;
            if (bars.bottom > 0) bottom = bars.bottom;
        }
        host.setPadding(0, top, 0, bottom);
    }

    private void attachInsetsHandler() {
        View host = (View) getBridge().getWebView().getParent();
        if (host == null) return;
        // Take over insets handling: re-apply padding on every inset change
        // (rotation, keyboard, bar visibility…) and stop the plugin from
        // ever zeroing it again.
        ViewCompat.setOnApplyWindowInsetsListener(host, (v, insets) -> {
            applyPadding();
            return insets;
        });
    }
}
