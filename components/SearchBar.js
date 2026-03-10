'use client';

import { useState, useEffect, useRef } from 'react';

export default function SearchBar({ placeholder, onSearch }) {
    const [value, setValue] = useState('');
    const timerRef = useRef(null);

    useEffect(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            onSearch(value.trim());
        }, 300);

        return () => clearTimeout(timerRef.current);
    }, [value, onSearch]);

    return (
        <input
            type="text"
            className="input-field"
            placeholder={placeholder || 'Search...'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
        />
    );
}
