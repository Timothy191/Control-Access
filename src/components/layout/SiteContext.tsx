"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { SITES, SiteInfo, normalizeSiteName } from "@/lib/sites";

interface SiteContextType {
  selectedSite: string;
  setSelectedSite: (site: string) => void;
  siteInfo: SiteInfo;
  availableSites: SiteInfo[];
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

const COOKIE_NAME = "selected_site";
const STORAGE_KEY = "plantcor_selected_site";

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [selectedSite, setSelectedSiteState] = useState<string>("All Sites (Global)");

  useEffect(() => {
    // Read from cookie first, fallback to localStorage
    const match = document.cookie.match(new RegExp("(^| )" + COOKIE_NAME + "=([^;]+)"));
    const cookieVal = match ? decodeURIComponent(match[2]) : null;
    const storedVal = localStorage.getItem(STORAGE_KEY);
    const initial = cookieVal || storedVal || "All Sites (Global)";

    const norm = normalizeSiteName(initial);
    const resolved = SITES.find((s) => s.name.toLowerCase() === norm.toLowerCase())?.name || "All Sites (Global)";
    queueMicrotask(() => {
      setSelectedSiteState(resolved);
    });
  }, []);

  const setSelectedSite = (site: string) => {
    setSelectedSiteState(site);
    try {
      localStorage.setItem(STORAGE_KEY, site);
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(site)}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent("plantcor-site-change", { detail: site }));
    } catch {
      // safe fallback if storage unavailable
    }
  };

  const siteInfo = useMemo(() => {
    const norm = normalizeSiteName(selectedSite);
    return SITES.find((s) => s.name.toLowerCase() === norm.toLowerCase()) || SITES[0];
  }, [selectedSite]);

  return (
    <SiteContext.Provider
      value={{
        selectedSite,
        setSelectedSite,
        siteInfo,
        availableSites: SITES,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return context;
}
