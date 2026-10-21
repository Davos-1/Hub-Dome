import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HOUSE_STYLES, ZENTRALE_STYLES, type HouseStyle, type ZentraleStyle } from "@/lib/styles";
import { Gallery } from "./gallery";

export const metadata = { title: "Stil-Galerie (Entwicklung)" };

async function Content({ searchParams }: Pick<PageProps<"/dev/stile">, "searchParams">) {
  // Nur für die Entwicklung: in Produktion gibt es die Seite nicht.
  if (process.env.NODE_ENV === "production") notFound();
  const { haus, zentrale } = await searchParams;
  const house = HOUSE_STYLES.find((s) => s === haus) ?? "haus";
  const central = ZENTRALE_STYLES.find((s) => s === zentrale) ?? "rathaus";
  return <Gallery house={house as HouseStyle} zentrale={central as ZentraleStyle} />;
}

export default function Page(props: PageProps<"/dev/stile">) {
  return (
    <Suspense>
      <Content searchParams={props.searchParams} />
    </Suspense>
  );
}
