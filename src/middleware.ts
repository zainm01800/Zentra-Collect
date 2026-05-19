import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// App routes that require authentication.
// Public routes (landing, demo, onboarding, marketing, pay portal) are NOT in this list.
const PROTECTED_PREFIXES = [
  "/chase-today",
  "/customers",
  "/dashboard",
  "/digest",
  "/disputes",
  "/import",
  "/invoices",
  "/portfolio",
  "/promises",
  "/reports",
  "/settings",
  "/today",
  "/aged-debt",
  "/banking",
  "/bills",
  "/expenses",
  "/mtd",
  "/pl",
  "/tax",
  "/tax-estimate",
  "/year-end",
  "/mileage",
  "/quotes",
  "/credit-notes",
  "/admin",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured this is a local/demo deploy — skip auth entirely.
  if (!url || !anonKey) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  // Refresh session cookies in the response so they stay alive across page loads
  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/onboarding";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|css|js|map)).*)",
  ],
};
