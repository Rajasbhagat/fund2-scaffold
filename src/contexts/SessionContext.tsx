'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SessionContextValue {
  sessionNumber: number;
  setSessionNumber: (n: number) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  sessionNumber: 1,
  setSessionNumber: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionNumber, setSessionNumberState] = useState(1);

  useEffect(() => {
    fetch('/api/settings/session')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.sessionNumber === 'number') {
          setSessionNumberState(data.sessionNumber);
        }
      })
      .catch(() => {});
  }, []);

  const setSessionNumber = async (n: number) => {
    const previous = sessionNumber;
    setSessionNumberState(n);
    try {
      const res = await fetch('/api/settings/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionNumber: n }),
      });
      if (!res.ok) {
        setSessionNumberState(previous);
      }
    } catch {
      setSessionNumberState(previous);
    }
  };

  return (
    <SessionContext value={{ sessionNumber, setSessionNumber }}>
      {children}
    </SessionContext>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
