
"use client";
import { SplashCursor } from "@/components/ui/splash-cursor";

export function SplashCursorDemo() {
  return (
    <SplashCursor
      // For debugging visibility:
      BACK_COLOR={{ r: 0.1, g: 0.1, b: 0.15 }} // A slightly visible dark blue-grey
      TRANSPARENT={false} // Make canvas background opaque for now
      // You can adjust other props here if needed, for example:
      // DENSITY_DISSIPATION={1.0}
      // CURL={10}
      // SHADING={false} // Turn off shading if it makes things too dark
    />
  );
}
