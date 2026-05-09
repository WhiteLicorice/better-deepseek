package com.betterdeepseek.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the domain guard applied in onPageFinished before bootstrap injection.
 *
 * Sign-in page handling is no longer at the native level — the bootstrap JS defers full BDS
 * injection until the SPA navigates away from /sign_in. The native guard only filters by domain.
 */
class SignInUrlGuardTest {

    /** Mirror the guard used in onPageFinished / onPageFinishedForTest. */
    private fun shouldInjectBootstrap(url: String?): Boolean {
        return !url.isNullOrEmpty() && url.startsWith("https://chat.deepseek.com")
    }

    @Test
    fun `accepts the sign-in page for bootstrap injection`() {
        // Bootstrap is always injected for deepseek URLs; JS inside bootstrap defers BDS on /sign_in.
        assertTrue(shouldInjectBootstrap("https://chat.deepseek.com/sign_in"))
        assertTrue(shouldInjectBootstrap("https://chat.deepseek.com/sign_in?redirect=/"))
    }

    @Test
    fun `accepts the home page`() {
        assertTrue(shouldInjectBootstrap("https://chat.deepseek.com/"))
    }

    @Test
    fun `accepts chat session URLs`() {
        assertTrue(shouldInjectBootstrap("https://chat.deepseek.com/chat/s/abc-123"))
        assertTrue(shouldInjectBootstrap("https://chat.deepseek.com/chat/s/xyz-456/subpage"))
    }

    @Test
    fun `rejects non-deepseek domains`() {
        assertFalse(shouldInjectBootstrap("https://accounts.google.com/o/oauth2/auth"))
        assertFalse(shouldInjectBootstrap("https://example.com/"))
    }

    @Test
    fun `rejects null or empty URLs`() {
        assertFalse(shouldInjectBootstrap(null))
        assertFalse(shouldInjectBootstrap(""))
    }
}
