import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request, { params }: { params: { holderId: string } }) {
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
      const errorData = await holderResponse.json()
      console.error("Error fetching holder:", errorData)
      return NextResponse.json({ error: "Failed to fetch holder" }, { status: holderResponse.status })
    }

    const holderData = await holderResponse.json()

    // Distribute welcome tokens to the holder
    const distributeResponse = await fetch(`https://api.metal.build/token/${process.env.TOKEN_ADDRESS}/distribute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.METAL_API_SECRET_KEY!,
      },
      body: JSON.stringify({
        sendToAddress: holderData.address,
        amount: 10, // Welcome bonus of 10 tokens
      }),
    })

    if (!distributeResponse.ok) {
      const errorData = await distributeResponse.json()
      console.error("Error distributing welcome tokens:", errorData)
      return NextResponse.json({ error: "Failed to distribute welcome tokens" }, { status: distributeResponse.status })
    }

    const distributeData = await distributeResponse.json()
    return NextResponse.json({
      success: true,
      message: "🎉 Welcome! You've received 10 tokens as a welcome bonus!",
      transaction: distributeData,
    })
  } catch (error) {
    console.error("Error in /api/holders/[holderId]/welcome-tokens:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

