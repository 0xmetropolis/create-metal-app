import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request, { params }: { params: { holderId: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Check if user is authenticated
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const holderId = params.holderId

    // Check if the user is requesting their own data
    if (session.user.id !== holderId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get the holder's address
    const holderResponse = await fetch(
      `https://api.metal.build/holder/${holderId}?publicKey=${process.env.NEXT_PUBLIC_METAL_API_KEY}`,
      {
        headers: {
          "x-api-key": process.env.METAL_API_SECRET_KEY!,
        },
      },
    )

    if (!holderResponse.ok) {
      if (holderResponse.status === 404) {
        return NextResponse.json({ error: "Holder not found" }, { status: 404 })
      }
      const errorData = await holderResponse.json()
      console.error("Error fetching holder:", errorData)
      return NextResponse.json({ error: "Failed to fetch holder" }, { status: holderResponse.status })
    }

    const holderData = await holderResponse.json()
    return NextResponse.json(holderData)
  } catch (error) {
    console.error("Error in /api/holders/[holderId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

