"use client";

import { sk } from "@/lib/sk";

export class IntelligenceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "IntelligenceApiError";
  }
}

export async function intelligenceFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...options.headers,
      authorization: `Bearer ${sk.auth.getToken()}`,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new IntelligenceApiError(
      body?.error || `Intelligence request failed (${response.status})`,
      response.status,
    );
  }
  return body as T;
}
