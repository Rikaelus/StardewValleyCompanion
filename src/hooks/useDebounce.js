import { useState, useEffect } from 'react'

/**
 * Debounce a value - delays updating the value until after a specified delay
 * @param {*} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default 300)
 * @returns {*} The debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    // Set up a timer to update the debounced value after the delay
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Clean up the timer if value changes before delay expires
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
