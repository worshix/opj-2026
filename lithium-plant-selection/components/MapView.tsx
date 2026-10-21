"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapSite {
  id: number;
  name: string;
  lat: number;
  lon: number;
  status: "winner" | "pass" | "fail";
  score: number | null;
}

export interface MapMine {
  id: number;
  name: string;
  lat: number;
  lon: number;
}

export interface MapLeg {
  mineId: number;
  tonnes: number;
}

const COLORS = { winner: "#7c3aed", pass: "#059669", fail: "#e11d48", mine: "#d97706" };

function FitBounds({ sites, mines }: { sites: MapSite[]; mines: MapMine[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = [...sites, ...mines].map((p) => [p.lat, p.lon] as [number, number]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.25));
  }, [map, sites, mines]);
  return null;
}

export default function MapView({ sites, mines, legs }: { sites: MapSite[]; mines: MapMine[]; legs: MapLeg[] }) {
  const winner = sites.find((s) => s.status === "winner");
  const lines = winner
    ? legs
        .map((l) => {
          const m = mines.find((x) => x.id === l.mineId);
          return m ? { from: m, tonnes: l.tonnes } : null;
        })
        .filter((x): x is { from: MapMine; tonnes: number } => x !== null)
    : [];

  return (
    <MapContainer center={[-19.0, 30.0]} zoom={7} className="h-[420px] w-full rounded-2xl" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds sites={sites} mines={mines} />
      {lines.map((l) => (
        <Polyline
          key={l.from.id}
          positions={[
            [l.from.lat, l.from.lon],
            [winner!.lat, winner!.lon],
          ]}
          pathOptions={{ color: COLORS.winner, weight: 2.5, dashArray: "6 6" }}
        />
      ))}
      {mines.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lon]}
          radius={8}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS.mine, fillOpacity: 1 }}
        >
          <Popup>
            <b>{m.name}</b>
            <br />
            Feedstock mine
          </Popup>
        </CircleMarker>
      ))}
      {sites.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lon]}
          radius={s.status === "winner" ? 12 : 9}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[s.status], fillOpacity: 1 }}
        >
          <Popup>
            <b>{s.name}</b>
            <br />
            {s.status === "winner" ? "Recommended site" : s.status === "pass" ? "Passed gates" : "Failed gates"}
            {s.score != null && (
              <>
                <br />
                Score: {s.score.toFixed(1)}
              </>
            )}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
