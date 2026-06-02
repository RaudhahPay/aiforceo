import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require";
import { loadPortfolioSnapshot } from "@/server/actions/portfolio";
import { buildPortfolioPrompt } from "@/lib/portfolio";

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshots = await loadPortfolioSnapshot();
  const prompt = buildPortfolioPrompt(snapshots);

  return NextResponse.json({ prompt, snapshots });
}
