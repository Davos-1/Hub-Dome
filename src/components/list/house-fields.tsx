"use client";

import { useId } from "react";
import { inputClass } from "@/components/ui/action-form";

/** Semester und Farbe eines Hauses (gemeinsam für Anlegen und Bearbeiten). */
export function HouseFields({ semester, color }: { semester?: number | null; color: string }) {
  const id = useId();
  return (
    <>
      <label htmlFor={`${id}-semester`} className="hd-label">
        Semester (optional)
      </label>
      <input
        id={`${id}-semester`}
        name="semester"
        type="number"
        min={1}
        max={12}
        inputMode="numeric"
        defaultValue={semester ?? ""}
        className={inputClass}
      />
      <label htmlFor={`${id}-color`} className="hd-label">
        Farbe
      </label>
      <input
        id={`${id}-color`}
        name="color"
        type="color"
        defaultValue={color}
        className="h-10 w-20 cursor-pointer rounded-lg border border-[#d9c9a8] bg-white"
      />
    </>
  );
}
