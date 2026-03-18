import { NextResponse } from "next/server";

import {
  proxyPythonApiRequest,
  PythonApiProxyError,
} from "@/lib/python-api";

export async function POST(request: Request) {
  try {
    return await proxyPythonApiRequest(request, "/word-difficulty");
  } catch (error) {
    const message =
      error instanceof PythonApiProxyError
        ? error.message
        : "Failed to score word difficulty";
    const status = error instanceof PythonApiProxyError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
