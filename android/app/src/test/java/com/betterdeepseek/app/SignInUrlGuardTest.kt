package com.betterdeepseek.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SignInUrlGuardTest {

    /** Mirror the guard used in onPageFinished. */
    private fun shouldInject(url: String?): Boolean {
        return !url.isNullOrEmpty()
            && url.startsWith("https://chat.deepseek.com")
            && !url.contains("/sign_in")
    }

    @Test
    fun `rejects the sign-in page`() {
        assertFalse(shouldInject("https://chat.deepseek.com/sign_in"))
        assertFalse(shouldInject("https://chat.deepseek.com/sign_in?redirect=/"))
    }

    @Test
    fun `accepts the home page after login`() {
        assertTrue(shouldInject("https://chat.deepseek.com/"))
    }

    @Test
    fun `accepts chat session URLs`() {
        assertTrue(shouldInject("https://chat.deepseek.com/chat/s/abc-123"))
        assertTrue(shouldInject("https://chat.deepseek.com/chat/s/xyz-456/subpage"))
    }

    @Test
    fun `rejects non-deepseek domains`() {
        assertFalse(shouldInject("https://accounts.google.com/o/oauth2/auth"))
        assertFalse(shouldInject("https://example.com/"))
    }

    @Test
    fun `rejects null or empty URLs`() {
        assertFalse(shouldInject(null))
        assertFalse(shouldInject(""))
    }
}
