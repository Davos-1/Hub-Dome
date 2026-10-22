/** Alte Adresse: die Liste ist jetzt ein Dialog der Welt. */
export async function GET(request: Request, { params }: RouteContext<"/dorf/[username]/liste">) {
  const { username } = await params;
  return Response.redirect(new URL(`/dorf/${encodeURIComponent(username)}?d=liste`, request.url), 307);
}
