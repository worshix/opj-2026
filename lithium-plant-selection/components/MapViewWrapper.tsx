"use client";

import dynamic from "next/dynamic";
import type { MapLeg, MapMine, MapSite } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-2xl bg-slate-100" />,
});

export default function MapViewWrapper(props: { sites: MapSite[]; mines: MapMine[]; legs: MapLeg[] }) {
  return <MapView {...props} />;
}
