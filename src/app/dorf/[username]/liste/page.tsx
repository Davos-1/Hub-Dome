import { redirect } from "next/navigation";

/** Alte Adresse: die Liste ist jetzt ein Dialog der Welt. */
export default async function ListePage({ params }: PageProps<"/dorf/[username]/liste">) {
  const { username } = await params;
  redirect(`/dorf/${username}?d=liste`);
}
