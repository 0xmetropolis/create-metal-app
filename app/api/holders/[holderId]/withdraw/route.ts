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

    const { toAddress, amount } = await request.json()

    if (!toAddress) {
      return NextResponse.json({ error: "Withdrawal address is required" }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    // Call the Metal API withdraw endpoint directly
    const withdrawResponse = await fetch(`https://api.metal.build/holder/${holderId}/withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.METAL_API_SECRET_KEY!,
      },
      body: JSON.stringify({
        tokenAddress: process.env.TOKEN_ADDRESS,
        amount: Number(amount), // Ensure amount is a number, not a string
        toAddress: toAddress,
      }),
    })

    if (!withdrawResponse.ok) {
      const errorData = await withdrawResponse.json()
      console.error("Error withdrawing tokens:", errorData)
      return NextResponse.json({ error: "Failed to withdraw tokens" }, { status: withdrawResponse.status })
    }

    const withdrawData = await withdrawResponse.json()
    return NextResponse.json({
      success: true,
      transaction: withdrawData,
    })
  } catch (error) {
    console.error("Error in /api/holders/[holderId]/withdraw:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

