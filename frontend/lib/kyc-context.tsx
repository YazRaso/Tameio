"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type KycStatus = "unverified" | "processing" | "verified" | "failed";

export interface KycSession {
  status: KycStatus;
  verificationSessionId: string | null;
  verifiedAt: string | null;
}

interface KycContextValue {
  kyc: KycSession;
  setKycStatus: (status: KycStatus, sessionId?: string) => void;
  resetKyc: () => void;
}

const SESSION_KEY = "tameio_kyc_session";

const defaultSession: KycSession = {
  status: "unverified",
  verificationSessionId: null,
  verifiedAt: null,
};

const KycContext = createContext<KycContextValue>({
  kyc: defaultSession,
  setKycStatus: () => {},
  resetKyc: () => {},
});

export function KycProvider({ children }: { children: React.ReactNode }) {
  const [kyc, setKyc] = useState<KycSession>(defaultSession);

  // Rehydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        setKyc(JSON.parse(stored) as KycSession);
      }
    } catch {
      // sessionStorage unavailable — fall back to in-memory only
    }
  }, []);

  function persist(session: KycSession) {
    setKyc(session);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore write errors
    }
  }

  function setKycStatus(status: KycStatus, sessionId?: string) {
    persist({
      status,
      verificationSessionId: sessionId ?? kyc.verificationSessionId,
      verifiedAt: status === "verified" ? new Date().toISOString() : kyc.verifiedAt,
    });
  }

  function resetKyc() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setKyc(defaultSession);
  }

  return (
    <KycContext.Provider value={{ kyc, setKycStatus, resetKyc }}>
      {children}
    </KycContext.Provider>
  );
}

export function useKyc() {
  return useContext(KycContext);
}
