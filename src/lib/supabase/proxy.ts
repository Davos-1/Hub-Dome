import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Öffentliche Pfade (alles andere erfordert Login). */
const PUBLIC_PATHS = ["/", "/login", "/auth", "/api/mcp"];

const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));

/** Erneuert die Session-Cookies und leitet Nicht-Eingeloggte auf /login um. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  if (!loggedIn && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (loggedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/doerfer";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
