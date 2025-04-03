import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Get the holderId from the request body
    const { holderId } = await request.json()

    // Use the authenticated user's ID if available, otherwise use the provided holderId
    const effectiveHolderId = session ? session.user.id : holderId

    if (!effectiveHolderId) {
      return NextResponse.json({ error: "Holder ID is required" }, { status: 400 })
    }

    console.log("Checking/creating holder for ID:", effectiveHolderId)

    // First, explicitly check if the holder already exists
    const checkHolderUrl = `https://api.metal.build/holder/${effectiveHolderId}?publicKey=${process.env.NEXT_PUBLIC_METAL_API_KEY}`
    console.log(
      "Checking if holder exists:",
      checkHolderUrl.replace(process.env.NEXT_PUBLIC_METAL_API_KEY || "", "[REDACTED]"),
    )

    const checkHolderResponse = await fetch(checkHolderUrl, {
      headers: {
        "x-api-key": process.env.METAL_API_SECRET_KEY!,
      },
    })

    // If the holder exists, return the existing holder data
    if (checkHolderResponse.ok) {
      const existingHolderData = await checkHolderResponse.json()
      console.log("Existing holder found:", existingHolderData.address)

      return NextResponse.json({
        ...existingHolderData,
        isExisting: true,
      })
    }

    // If the holder doesn't exist (404), create a new one
    if (checkHolderResponse.status === 404) {
      console.log("Holder not found, creating new holder")

      // Create a new holder
      const holderUrl = `https://api.metal.build/holder/${effectiveHolderId}`
      console.log("Creating holder URL:", holderUrl)

      const holderResponse = await fetch(holderUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.METAL_API_SECRET_KEY!,
        },
      })

      console.log("Create holder response status:", holderResponse.status)

      if (!holderResponse.ok) {
        // If we get a 409 Conflict, it means the holder already exists
        // This can happen if there's a race condition or if the check above failed for some reason
        if (holderResponse.status === 409) {
          console.log("Holder already exists (409 Conflict), fetching existing holder")

          // Get the existing holder data
          const getExistingResponse = await fetch(checkHolderUrl, {
            headers: {
              "x-api-key": process.env.METAL_API_SECRET_KEY!,
            },
          })

          if (getExistingResponse.ok) {
            const existingHolderData = await getExistingResponse.json()
            console.log("Retrieved existing holder:", existingHolderData.address)

            return NextResponse.json({
              ...existingHolderData,
              isExisting: true,
            })
          }
        }

        const errorText = await holderResponse.text()
        try {
          const errorJson = JSON.parse(errorText)
          console.error("Error creating holder:", errorJson)
        } catch {
          console.error("Error creating holder (raw):", errorText)
        }
        return NextResponse.json({ error: "Failed to create holder" }, { status: holderResponse.status })
      }

      const holderData = await holderResponse.json()
      console.log("New holder created:", holderData.address)

      return NextResponse.json({
        ...holderData,
        isNew: true,
      })
    }

    // If we get here, there was some other error checking the holder
    console.error("Unexpected error checking holder:", checkHolderResponse.status)
    return NextResponse.json({ error: "Failed to check if holder exists" }, { status: checkHolderResponse.status })
  } catch (error) {
    console.error("Error in /api/holders/create:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

