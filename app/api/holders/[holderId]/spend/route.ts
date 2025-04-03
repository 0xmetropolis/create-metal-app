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

    const { amount } = await request.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 })
    }

    // Spend tokens using Metal API
    const spendResponse = await fetch(`https://api.metal.build/holder/${holderId}/spend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.METAL_API_SECRET_KEY!,
      },
      body: JSON.stringify({
        tokenAddress: process.env.TOKEN_ADDRESS,
        amount: Number(amount), // Ensure amount is a number, not a string
      }),
    })

    if (!spendResponse.ok) {
      const errorData = await spendResponse.json()
      console.error("Error spending tokens:", errorData)
      return NextResponse.json({ error: "Failed to spend tokens" }, { status: spendResponse.status })
    }

    const spendData = await spendResponse.json()
    return NextResponse.json({
      success: true,
      message: "🎉 You spent a token! Here's a fun message: 'You're awesome!'",
      transaction: spendData,
    })
  } catch (error) {
    console.error("Error in /api/holders/[holderId]/spend:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

