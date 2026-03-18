const DEFAULT_LOCAL_PYTHON_API_BASE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 20_000;

export class PythonApiProxyError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "PythonApiProxyError";
    this.status = status;
  }
}

function getPythonApiBaseUrl() {
  const configuredUrl = process.env.PYTHON_API_BASE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return DEFAULT_LOCAL_PYTHON_API_BASE_URL;
  }

  throw new PythonApiProxyError("PYTHON_API_BASE_URL is not configured", 500);
}

function buildPythonApiHeaders(contentType: string | null) {
  const headers: Record<string, string> = {};

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const sharedSecret = process.env.PYTHON_API_SHARED_SECRET?.trim();
  if (sharedSecret) {
    headers.Authorization = `Bearer ${sharedSecret}`;
  }

  return headers;
}

async function readUpstreamError(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as {
        detail?: unknown;
        error?: unknown;
        message?: unknown;
      };

      if (typeof payload.detail === "string") {
        return payload.detail;
      }
      if (typeof payload.error === "string") {
        return payload.error;
      }
      if (typeof payload.message === "string") {
        return payload.message;
      }
    }

    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
}

export async function proxyPythonApiRequest(
  request: Request,
  pathname: string
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const body = await request.text();
    const response = await fetch(`${getPythonApiBaseUrl()}${pathname}`, {
      method: "POST",
      headers: buildPythonApiHeaders(request.headers.get("content-type")),
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const message =
        (await readUpstreamError(response)) ||
        `Python API request failed with status ${response.status}`;
      throw new PythonApiProxyError(message, 502);
    }

    const responseBody = await response.text();
    return new Response(responseBody, {
      status: 200,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PythonApiProxyError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PythonApiProxyError("Python API request timed out", 502);
    }

    const message =
      error instanceof Error ? error.message : "Failed to reach Python API";
    throw new PythonApiProxyError(message, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
