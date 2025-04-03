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

    // First, get the holder's address
    const holderResponse = await fetch(
      `https://api.metal.build/holder/${holderId}?publicKey=${process.env.NEXT_PUBLIC_METAL_API_KEY}`,
      {
        headers: {
          "x-api-key": process.env.METAL_API_SECRET_KEY!,
        },
      },
    )

    if (!holderResponse.ok) {
      // If holder doesn't exist, return 0 balance
      if (holderResponse.status === 404) {
        return NextResponse.json({ balance: 0 })
      }

      const errorData = await holderResponse.json()
      console.error("Error fetching holder:", errorData)
      return NextResponse.json({ error: "Failed to fetch holder" }, { status: holderResponse.status })
    }

    const holderData = await holderResponse.json()

    // Then, get the holder's token balance
    const balanceResponse = await fetch(
      `https://api.metal.build/holder/${holderData.address}/token/${process.env.TOKEN_ADDRESS}`,
      {
        headers: {
          "x-api-key": process.env.METAL_API_SECRET_KEY!,
        },
      },
    )

    if (!balanceResponse.ok) {
      // If the holder doesn't have any tokens yet, return 0 balance
      if (balanceResponse.status === 404) {
        return NextResponse.json({ balance: 0 })
      }

      const errorData = await balanceResponse.json()
      console.error("Error fetching balance:", errorData)
      return NextResponse.json({ error: "Failed to fetch balance" }, { status: balanceResponse.status })
    }

    const balanceData = await balanceResponse.json()
    return NextResponse.json({ balance: balanceData.balance })
  } catch (error) {
    console.error("Error in /api/holders/[holderId]/balance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

