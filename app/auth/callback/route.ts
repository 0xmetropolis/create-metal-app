import { NextResponse } from "next/server"

// This route is now handled by the page component
export async function GET() {
  // The actual logic is in the page component
  return NextResponse.next()
}

