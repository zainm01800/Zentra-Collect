import { NextRequest, NextResponse } from "next/server";
import { testSmtpConnection, inferSmtpHost } from "@/lib/email/smtp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fromName } = body as {
      email?: string;
      password?: string;
      fromName?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    const { host, port } = inferSmtpHost(email);
    const result = await testSmtpConnection({
      host,
      port,
      user: email,
      password,
      fromName: fromName ?? "Zentra Collect",
    });

    return NextResponse.json({ ...result, host, port });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unexpected error testing connection." },
      { status: 500 },
    );
  }
}
