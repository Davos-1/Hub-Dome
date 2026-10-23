import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DEKO_TYPEN } from "@/lib/world/catalog";
import { PALETTES, type Stimmung } from "@/lib/world/map";
import { Gallery } from "./gallery";
import { KitGallery } from "./kit-gallery";
import { KIT_NAMEN } from "./kit-namen";

export const metadata = { title: "Deko-Galerie (Entwicklung)" };

async function Content({ searchParams }: Pick<PageProps<"/dev/deko">, "searchParams">) {
  // Nur für die Entwicklung: in Produktion gibt es die Seite nicht.
  if (process.env.NODE_ENV === "production") notFound();
  const { stimmung, nur, ansicht, farben } = await searchParams;
  const s = (Object.keys(PALETTES) as Stimmung[]).find((k) => k === stimmung) ?? "sommer";
  // `?ansicht=kit`: Anbauten und Gartenstile (mit `nur=laube` Nahansicht, `farben=2` zweiter Farbsatz)
  if (ansicht === "kit") {
    return (
      <KitGallery
        stimmung={s}
        nur={KIT_NAMEN.find((n) => n === nur)}
        farben={farben === "2" ? 1 : 0}
      />
    );
  }
  // Optional: `?nur=bank` richtet die Kamera auf ein einzelnes Element
  return <Gallery stimmung={s} nur={DEKO_TYPEN.find((t) => t === nur)} />;
}

export default function Page(props: PageProps<"/dev/deko">) {
  return (
    <Suspense>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
