package com.betterdeepseek.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the domain + sign-in guard applied in onPageFinished before scheduling
 * the stability-gate injection timer.
 *
 * Sign-in detection is native (not JS): the onPageFinished guard skips /sign_in entirely
 * so the injection timer is never started on that route.
 */
class SignInUrlGuardTest {

    /** Mirror the guard used in onPageFinished before postDelayed. */
    private fun shouldScheduleInjection(url: String?): Boolean {
        return !url.isNullOrEmpty()
            && url.startsWith("https://chat.deepseek.com")
            && !url.contains("/sign_in")
    }

    @Test
    fun `rejects the sign-in page`() {
        assertFalse(shouldScheduleInjection("https://chat.deepseek.com/sign_in"))
        assertFalse(shouldScheduleInjection("https://chat.deepseek.com/sign_in?redirect=/"))
    }

    @Test
    fun `accepts the home page after login`() {
        assertTrue(shouldScheduleInjection("https://chat.deepseek.com/"))
    }

    @Test
    fun `accepts chat session URLs`() {
        assertTrue(shouldScheduleInjection("https://chat.deepseek.com/chat/s/abc-123"))
        assertTrue(shouldScheduleInjection("https://chat.deepseek.com/chat/s/xyz-456/subpage"))
    }

    @Test
    fun `rejects non-deepseek domains`() {
        assertFalse(shouldScheduleInjection("https://accounts.google.com/o/oauth2/auth"))
        assertFalse(shouldScheduleInjection("https://example.com/"))
    }

    @Test
    fun `rejects null or empty URLs`() {
        assertFalse(shouldScheduleInjection(null))
        assertFalse(shouldScheduleInjection(""))
    }
}
