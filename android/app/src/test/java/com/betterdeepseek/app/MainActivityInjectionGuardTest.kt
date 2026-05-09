package com.betterdeepseek.app

import android.os.Looper
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.ArgumentMatchers.anyString
import org.mockito.ArgumentMatchers.contains
import org.mockito.Mockito.atLeastOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.kotlin.anyOrNull
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class MainActivityInjectionGuardTest {

    @Test
    fun `bootstrap injected on sign-in URL`() {
        // Bootstrap always fires for deepseek URLs; JS inside defers BDS on /sign_in.
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(webView, "https://chat.deepseek.com/sign_in")
            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("onBootstrapReady"), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `bootstrap injected on chat session URL`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(
                webView,
                "https://chat.deepseek.com/chat/s/mock-chat-1"
            )
            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("onBootstrapReady"), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `bootstrap injected on home page`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(webView, "https://chat.deepseek.com/")
            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("onBootstrapReady"), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `bootstrap not injected for external OAuth domain`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(
                webView,
                "https://accounts.google.com/o/oauth2/auth"
            )
            verify(webView, never()).evaluateJavascript(anyString(), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `onBootstrapReady callback fires when bridge method called`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            var called = false
            activity.bridge.onBootstrapReadyCallback = { called = true }
            activity.bridge.onBootstrapReady()
            // mainHandler.post — flush Robolectric's main-thread message queue.
            shadowOf(Looper.getMainLooper()).idle()
            assert(called) { "onBootstrapReadyCallback was not invoked" }
        }
        scenario.close()
    }
}
