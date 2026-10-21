import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FACH_ORDER } from "@/lib/fachbereiche";
import { ZENTRALE_STYLES } from "@/lib/styles";
import { Gallery } from "./gallery";

export const metadata = { title: "Stil-Galerie (Entwicklung)" };

async function Content({ searchParams }: Pick<PageProps<"/dev/stile">, "searchParams">) {
  // Nur für die Entwicklung: in Produktion gibt es die Seite nicht.
  if (process.env.NODE_ENV === "production") notFound();
  const { fach, zentrale } = await searchParams;
  const f = FACH_ORDER.find((s) => s === fach) ?? "grundlagen";
  const central = ZENTRALE_STYLES.find((s) => s === zentrale) ?? "rathaus";
  return <Gallery fach={f} zentrale={central} />;
}

export default function Page(props: PageProps<"/dev/stile">) {
  return (
    <Suspense>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
