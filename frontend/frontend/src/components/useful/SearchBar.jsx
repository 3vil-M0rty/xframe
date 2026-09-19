import { useState } from 'react'
import { Search, X } from 'lucide-react'
import styles from './SearchBar.module.css'

export default function SearchBar({
  placeholder = 'Search...',
  onSearch,
  onClear,
  showClearButton = true,
  isLoading = false,
  suggestions = []
}) {
  const [value, setValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleChange = (e) => {
    const newValue = e.target.value
    setValue(newValue)
    onSearch?.(newValue)
  }

  const handleClear = () => {
    setValue('')
    onClear?.()
    setShowSuggestions(false)
  }

  const handleSuggestionClick = (suggestion) => {
    setValue(suggestion)
    onSearch?.(suggestion)
    setShowSuggestions(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchBox}>
        <Search size={18} className={styles.icon} />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          className={styles.input}
        />
        {isLoading && <div className={styles.spinner} />}
        {value && showClearButton && (
          <button
            onClick={handleClear}
            className={styles.clearBtn}
            title="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className={styles.suggestions}>
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              className={styles.suggestionItem}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <Search size={14} />
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
