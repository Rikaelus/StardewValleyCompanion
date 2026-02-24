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
    // Reset immediately when value is empty, otherwise debounce
    if (!value) {
      setDebouncedValue(value)
      return
    }
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}
