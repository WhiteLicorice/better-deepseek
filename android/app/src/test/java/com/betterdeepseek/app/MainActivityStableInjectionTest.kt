package com.betterdeepseek.app

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
import android.os.Looper
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class MainActivityStableInjectionTest {

    @Test
    fun `sign_in page does not trigger injection timer`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.bdsWebViewClientForTest.onPageFinished(
                webView,
                "https://chat.deepseek.com/sign_in"
            )
            shadowOf(Looper.getMainLooper()).idleFor(300, TimeUnit.MILLISECONDS)
            verify(webView, never()).evaluateJavascript(anyString(), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `stable home page triggers injection after delay`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.bdsWebViewClientForTest.onPageFinished(
                webView,
                "https://chat.deepseek.com/"
            )
            shadowOf(Looper.getMainLooper()).idleFor(300, TimeUnit.MILLISECONDS)
            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("injected.js"), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `stable chat session triggers injection after delay`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.bdsWebViewClientForTest.onPageFinished(
                webView,
                "https://chat.deepseek.com/chat/s/mock-1"
            )
            shadowOf(Looper.getMainLooper()).idleFor(300, TimeUnit.MILLISECONDS)
            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("injected.js"), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `rapid navigation cancels pending injection`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)

            // First page finishes — schedules injection.
            activity.bdsWebViewClientForTest.onPageFinished(
                webView,
                "https://chat.deepseek.com/"
            )
            // Navigation starts before the 300 ms grace period elapses — cancels timer.
            activity.bdsWebViewClientForTest.onPageStarted(
                webView,
                "https://chat.deepseek.com/chat/s/abc",
                null
            )
            shadowOf(Looper.getMainLooper()).idleFor(300, TimeUnit.MILLISECONDS)

            // Timer was cancelled — no injection yet.
            verify(webView, never()).evaluateJavascript(anyString(), anyOrNull())

            // Second page now finishes stably — new timer scheduled.
            activity.bdsWebViewClientForTest.onPageFinished(
                webView,
                "https://chat.deepseek.com/chat/s/abc"
            )
            shadowOf(Looper.getMainLooper()).idleFor(300, TimeUnit.MILLISECONDS)

            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("injected.js"), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `external OAuth domain does not trigger injection`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.bdsWebViewClientForTest.onPageFinished(
                webView,
                "https://accounts.google.com/o/oauth2/auth"
            )
            shadowOf(Looper.getMainLooper()).idleFor(300, TimeUnit.MILLISECONDS)
            verify(webView, never()).evaluateJavascript(anyString(), anyOrNull())
        }
        scenario.close()
    }
}
