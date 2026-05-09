package com.betterdeepseek.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pure JVM tests for the stability-gate logic: onPageFinished schedules injection after a grace
 * period, onPageStarted cancels any pending injection.
 *
 * StableGate simulates the Handler.postDelayed / removeCallbacks cycle without Android
 * dependencies so the guard logic can be verified independently of MainActivity.
 */
class StablePageInjectionTest {

    private class StableGate {
        var injectCalled = false
        var injectUrl: String? = null
        private var cancelled = false

        fun onPageFinished(url: String?) {
            cancelled = false
            // Sign-in page never schedules injection.
            if (url != null && !url.contains("/sign_in") &&
                url.startsWith("https://chat.deepseek.com")) {
                // Schedule: inject after delay (caller invokes simulateDelayExecution).
                injectUrl = url
            }
        }

        fun onPageStarted() {
            cancelled = true
            injectCalled = false
            injectUrl = null
        }

        /** Simulates the Runnable firing after the 300 ms postDelayed. */
        fun simulateDelayExecution() {
            if (cancelled) return
            val url = injectUrl ?: return
            if (!url.contains("/sign_in")) {
                injectCalled = true
            }
        }
    }

    @Test
    fun `sign_in page never schedules injection`() {
        val gate = StableGate()
        gate.onPageFinished("https://chat.deepseek.com/sign_in")
        gate.simulateDelayExecution()
        assertFalse(gate.injectCalled)
        assertNull(gate.injectUrl)
    }

    @Test
    fun `stable page triggers injection after delay`() {
        val gate = StableGate()
        gate.onPageFinished("https://chat.deepseek.com/")
        gate.simulateDelayExecution()
        assertTrue(gate.injectCalled)
    }

    @Test
    fun `navigation before delay cancels injection`() {
        val gate = StableGate()
        gate.onPageFinished("https://chat.deepseek.com/")
        gate.onPageStarted()
        gate.simulateDelayExecution()
        assertFalse(gate.injectCalled)
    }

    @Test
    fun `subsequent stable page after cancellation can inject`() {
        val gate = StableGate()
        gate.onPageFinished("https://chat.deepseek.com/")
        gate.onPageStarted()
        gate.onPageFinished("https://chat.deepseek.com/chat/s/abc")
        gate.simulateDelayExecution()
        assertTrue(gate.injectCalled)
        assertTrue(gate.injectUrl!!.contains("/chat/s/"))
    }

    @Test
    fun `non-deepseek domain does not schedule injection`() {
        val gate = StableGate()
        gate.onPageFinished("https://accounts.google.com/auth")
        gate.simulateDelayExecution()
        assertFalse(gate.injectCalled)
    }
}
