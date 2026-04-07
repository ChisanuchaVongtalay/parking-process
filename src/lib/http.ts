import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function parseJsonError(error: unknown) {
  if (error instanceof ZodError) {
    return fail("Validation failed", 422, error.issues);
  }
  if (error instanceof Error) {
    return fail(error.message || "Unexpected server error", 500, {
      name: error.name,
      message: error.message,
    });
  }
  return fail("Unexpected server error", 500, String(error));
}
