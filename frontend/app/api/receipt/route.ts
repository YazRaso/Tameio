import { NextRequest, NextResponse } from "next/server";

const MONAD_RPC = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";

/**
 * GET /api/receipt?hash=0x...
 *
 * Server-side proxy for eth_getTransactionReceipt.
 * Avoids browser CORS / 404 issues with the Monad public RPC by routing
 * the call through the Next.js server which uses the Alchemy endpoint.
 */
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("hash");
  if (!hash) {
    return NextResponse.json({ error: "missing hash" }, { status: 400 });
  }

  try {
    const rpcRes = await fetch(MONAD_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [hash],
        id: 1,
      }),
    });

    const json = await rpcRes.json();
    // json.result is the receipt object or null if not yet mined
    return NextResponse.json({ result: json.result ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
