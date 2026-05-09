package com.betterdeepseek.app

import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.ArgumentMatchers.contains
import org.mockito.Mockito.anyString
import org.mockito.Mockito.atLeastOnce
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30])
class MainActivityInjectionGuardTest {

    @Test
    fun `injectBdsScripts is skipped on the sign-in page`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(
                webView,
                "https://chat.deepseek.com/sign_in"
            )
            verify(webView, never()).evaluateJavascript(anyString(), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `injectBdsScripts is skipped on the sign-in page with query params`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(
                webView,
                "https://chat.deepseek.com/sign_in?redirect=/"
            )
            verify(webView, never()).evaluateJavascript(anyString(), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `injectBdsScripts runs on a chat session URL`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(
                webView,
                "https://chat.deepseek.com/chat/s/mock-chat-1"
            )
            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("injected.js"), anyOrNull())
        }
        scenario.close()
    }

    @Test
    fun `injectBdsScripts runs on the home page after login`() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        scenario.onActivity { activity ->
            val webView = mock(WebView::class.java)
            activity.onPageFinishedForTest(
                webView,
                "https://chat.deepseek.com/"
            )
            verify(webView, atLeastOnce())
                .evaluateJavascript(contains("injected.js"), anyOrNull())
        }
        scenario.close()
    }
}
