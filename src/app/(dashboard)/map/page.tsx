"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type L from "leaflet";

interface OrderLocation {
  id: string;
  orderNumber: string;
  customerName: string;
  buildingType: string;
  buildingSize: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  totalPrice: string;
  installer: string | null;
  dateSold: string | null;
  sentToManufacturer: boolean;
  salesRep: { id: string; firstName: string; lastName: string } | null;
}

interface GeoCache {
  [key: string]: { lat: number; lng: number } | null;
}

// Distinct colors for manufacturers
const MANUFACTURER_PALETTE = [
  "#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4",
  "#42d4f4", "#f032e6", "#bfef45", "#fabed4", "#469990",
  "#dcbeff", "#9A6324", "#800000", "#aaffc3", "#808000",
  "#000075", "#a9a9a9", "#e6beff", "#ffe119", "#ff6961",
];

const UNASSIGNED_COLOR = "#6b7280";

async function geocodeAddress(address: string, city: string, state: string, zip: string): Promise<{ lat: number; lng: number } | null> {
  const query = `${address}, ${city}, ${state} ${zip}`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=us`,
      { headers: { "User-Agent": "BigBuildingsDirect/1.0" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    const fallbackRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(`${city}, ${state} ${zip}`)}&limit=1&countrycodes=us`,
      { headers: { "User-Agent": "BigBuildingsDirect/1.0" } }
    );
    const fallbackData = await fallbackRes.json();
    if (fallbackData && fallbackData.length > 0) {
      return { lat: parseFloat(fallbackData[0].lat), lng: parseFloat(fallbackData[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function createPinIcon(leaflet: typeof L, color: string) {
  return leaflet.divIcon({
    className: "custom-pin",
    html: `<svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`,
    iconSize: [24, 36] as [number, number],
    iconAnchor: [12, 36] as [number, number],
    popupAnchor: [0, -36] as [number, number],
  });
}

export default function MapPage() {
  const mapRef = useRef<L.Map | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [allOrders, setAllOrders] = useState<OrderLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const [geocodedOrders, setGeocodedOrders] = useState<Record<string, { lat: number; lng: number }>>({});
  const [geocodingDone, setGeocodingDone] = useState(false);

  // Filters
  const [filterManufacturer, setFilterManufacturer] = useState<string>("all");
  const [filterRep, setFilterRep] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Derive unique values for filter dropdowns
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach((o) => { if (o.installer) set.add(o.installer); });
    return Array.from(set).sort();
  }, [allOrders]);

  const salesReps = useMemo(() => {
    const map = new Map<string, string>();
    allOrders.forEach((o) => {
      if (o.salesRep) map.set(o.salesRep.id, `${o.salesRep.firstName} ${o.salesRep.lastName}`);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allOrders]);

  const years = useMemo(() => {
    const set = new Set<number>();
    allOrders.forEach((o) => {
      if (o.dateSold) set.add(new Date(o.dateSold).getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [allOrders]);

  // Build manufacturer -> color map
  const manufacturerColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    manufacturers.forEach((m, i) => {
      map[m] = MANUFACTURER_PALETTE[i % MANUFACTURER_PALETTE.length];
    });
    return map;
  }, [manufacturers]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      if (filterManufacturer !== "all" && (o.installer || "Unassigned") !== filterManufacturer) return false;
      if (filterRep !== "all" && (o.salesRep?.id || "none") !== filterRep) return false;
      if (filterYear !== "all") {
        if (!o.dateSold) return false;
        if (new Date(o.dateSold).getFullYear().toString() !== filterYear) return false;
      }
      return true;
    });
  }, [allOrders, filterManufacturer, filterRep, filterYear]);

  // Dynamically import Leaflet + CSS (avoids "window is not defined" SSR error)
  const initMap = useCallback(async () => {
    if (mapRef.current || !mapContainerRef.current) return;

    const leaflet = (await import("leaflet")).default;
    await import("leaflet/dist/leaflet.css");
    leafletRef.current = leaflet;

    const southWest = leaflet.latLng(15, -170);
    const northEast = leaflet.latLng(72, -50);
    const bounds = leaflet.latLngBounds(southWest, northEast);

    mapRef.current = leaflet.map(mapContainerRef.current, {
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      minZoom: 3,
    }).setView([39.8283, -98.5795], 4);

    leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    setMapReady(true);
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  // Fetch orders
  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders/locations");
        const data = await res.json();
        if (data.success) setAllOrders(data.data);
      } catch {
        console.error("Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // Geocode all orders — progressively update state so pins appear as they're resolved
  useEffect(() => {
    if (allOrders.length === 0) return;
    let cancelled = false;

    const cacheKey = "order-geocode-cache";
    let geoCache: GeoCache = {};
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) geoCache = JSON.parse(cached);
    } catch { /* ignore */ }

    setGeocodeProgress({ done: 0, total: allOrders.length });

    async function geocodeAll() {
      const results: Record<string, { lat: number; lng: number }> = {};
      let completed = 0;
      let batchCount = 0;

      for (const order of allOrders) {
        if (cancelled) break;

        const addressKey = `${order.deliveryAddress}|${order.deliveryCity}|${order.deliveryState}|${order.deliveryZip}`;
        let coords = geoCache[addressKey];
        let wasCached = coords !== undefined;

        if (!wasCached) {
          coords = await geocodeAddress(
            order.deliveryAddress,
            order.deliveryCity,
            order.deliveryState,
            order.deliveryZip
          );
          geoCache[addressKey] = coords;
          try { sessionStorage.setItem(cacheKey, JSON.stringify(geoCache)); } catch { /* ignore */ }
        }

        completed++;
        batchCount++;
        setGeocodeProgress({ done: completed, total: allOrders.length });

        if (coords) {
          results[order.id] = coords;
        }

        // Push updates to the map progressively: every 10 cached hits or after every geocode call
        if (!wasCached || batchCount >= 10) {
          if (!cancelled) {
            setGeocodedOrders((prev) => ({ ...prev, ...results }));
          }
          batchCount = 0;

          // Rate limit only for non-cached requests
          if (!wasCached) {
            await new Promise((r) => setTimeout(r, 1050));
          }
        }
      }

      if (!cancelled) {
        // Final flush
        setGeocodedOrders((prev) => ({ ...prev, ...results }));
        setGeocodingDone(true);
      }
    }

    geocodeAll();
    return () => { cancelled = true; };
  }, [allOrders]);

  // Place/update markers when filters change or geocoding updates
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !mapReady) return;
    const map = mapRef.current;
    const leaflet = leafletRef.current;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const newMarkers: L.Marker[] = [];

    for (const order of filteredOrders) {
      const coords = geocodedOrders[order.id];
      if (!coords) continue;

      const mfr = order.installer || "Unassigned";
      const color = order.installer ? (manufacturerColorMap[order.installer] || UNASSIGNED_COLOR) : UNASSIGNED_COLOR;

      const marker = leaflet.marker([coords.lat, coords.lng], {
        icon: createPinIcon(leaflet, color),
      }).addTo(map);

      const rep = order.salesRep
        ? `${order.salesRep.firstName} ${order.salesRep.lastName}`
        : "Unassigned";

      const dateSold = order.dateSold
        ? new Date(order.dateSold).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "N/A";

      marker.bindPopup(`
        <div style="min-width: 220px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
            <a href="/orders/${order.id}" style="color: #2563eb; text-decoration: none;">${order.orderNumber}</a>
          </div>
          <div style="font-size: 13px; color: #374151; margin-bottom: 2px;">${order.customerName}</div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
            ${order.deliveryAddress}<br/>
            ${order.deliveryCity}, ${order.deliveryState} ${order.deliveryZip}
          </div>
          <div style="font-size: 12px; display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
            <span style="background: ${color}; color: white; padding: 1px 6px; border-radius: 4px; font-size: 11px;">${mfr}</span>
          </div>
          ${order.buildingType ? `<div style="font-size: 12px; color: #6b7280;">${order.buildingType} ${order.buildingSize}</div>` : ""}
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Rep: ${rep}</div>
          <div style="font-size: 12px; color: #6b7280;">Sold: ${dateSold}</div>
        </div>
      `);

      newMarkers.push(marker);
    }

    markersRef.current = newMarkers;

    // Fit bounds to visible markers
    if (newMarkers.length > 0) {
      const group = leaflet.featureGroup(newMarkers);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [filteredOrders, geocodedOrders, manufacturerColorMap, mapReady]);

  const resetFilters = () => {
    setFilterManufacturer("all");
    setFilterRep("all");
    setFilterYear("all");
  };

  const hasActiveFilters = filterManufacturer !== "all" || filterRep !== "all" || filterYear !== "all";
  const visiblePinCount = markersRef.current.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Map</h1>
          <p className="text-muted-foreground">
            All order delivery locations &mdash; color-coded by manufacturer
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? (
            "Loading orders..."
          ) : !geocodingDone ? (
            `Placing pins... ${geocodeProgress.done}/${geocodeProgress.total}`
          ) : (
            `${visiblePinCount} of ${allOrders.length} orders shown`
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <svg
                className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-90" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs">
                  {[filterManufacturer, filterRep, filterYear].filter((f) => f !== "all").length}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
                Clear all
              </Button>
            )}
          </div>

          {filtersOpen && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Manufacturer</label>
                <select
                  value={filterManufacturer}
                  onChange={(e) => setFilterManufacturer(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Manufacturers</option>
                  {manufacturers.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Sales Rep</label>
                <select
                  value={filterRep}
                  onChange={(e) => setFilterRep(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Reps</option>
                  {salesReps.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Year Sold</label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All Years</option>
                  {years.map((y) => (
                    <option key={y} value={y.toString()}>{y}</option>
                  ))}
                </select>
              </div>

            </div>
          )}
        </CardContent>
      </Card>

      {/* Manufacturer Legend */}
      {manufacturers.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {manufacturers.map((m) => (
            <button
              key={m}
              onClick={() => setFilterManufacturer(filterManufacturer === m ? "all" : m)}
              className={`flex items-center gap-1.5 text-xs py-0.5 px-1 rounded transition-opacity ${
                filterManufacturer !== "all" && filterManufacturer !== m ? "opacity-40" : "opacity-100"
              } hover:opacity-100`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ background: manufacturerColorMap[m] }}
              />
              {m}
            </button>
          ))}
          <button
            onClick={() => setFilterManufacturer(filterManufacturer === "Unassigned" ? "all" : "Unassigned")}
            className={`flex items-center gap-1.5 text-xs py-0.5 px-1 rounded transition-opacity ${
              filterManufacturer !== "all" && filterManufacturer !== "Unassigned" ? "opacity-40" : "opacity-100"
            } hover:opacity-100`}
          >
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ background: UNASSIGNED_COLOR }}
            />
            Unassigned
          </button>
        </div>
      )}

      {/* Map */}
      <Card>
        <CardContent className="p-0">
          <div
            ref={mapContainerRef}
            className="w-full rounded-lg overflow-hidden"
            style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
