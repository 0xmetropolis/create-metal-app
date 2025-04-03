"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, RefreshCw, LogOut, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface User {
  id: string
  email: string
  holderAddress: string
}

// Key for tracking welcome tokens in localStorage
const WELCOME_TOKENS_KEY = "welcomeTokensReceived"

// Maximum number of balance polling attempts
const MAX_BALANCE_POLL_ATTEMPTS = 5

export default function DashboardPage() {
  // Set loading to true immediately on component mount
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSpending, setIsSpending] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawAddress, setWithdrawAddress] = useState("")
  const [isRewarding, setIsRewarding] = useState(false)
  const [isCreatingHolder, setIsCreatingHolder] = useState(false)
  const [isDistributingWelcomeTokens, setIsDistributingWelcomeTokens] = useState(false)
  const [isPollingBalance, setIsPollingBalance] = useState(false)
  const [isNewWallet, setIsNewWallet] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  // This effect runs once on component mount
  useEffect(() => {
    // Immediately show loading state
    setIsLoading(true)

    const fetchUserData = async () => {
      try {
        // Get the current user from Supabase
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser()

        if (error || !authUser) {
          throw new Error("Not authenticated")
        }

        console.log("Auth user:", authUser.id)

        // Create or get the holder for this user
        setIsCreatingHolder(true)
        setIsNewWallet(false) // Default to false
        const createResponse = await fetch("/api/holders/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ holderId: authUser.id }),
        })

        if (!createResponse.ok) {
          const errorData = await createResponse.json()
          console.error("Error creating/getting holder:", errorData)
          throw new Error("Failed to create or get holder")
        }

        const holderData = await createResponse.json()
        console.log("Holder data:", holderData)

        // Set isNewWallet based on the response
        setIsNewWallet(holderData.isNew === true)

        setUser({
          id: authUser.id,
          email: authUser.email || "",
          holderAddress: holderData.address,
        })
        setIsCreatingHolder(false)

        // Check if this is the first confirmed login (email verified)
        // and if welcome tokens have not been distributed yet
        const hasReceivedWelcomeTokens = localStorage.getItem(WELCOME_TOKENS_KEY) === "true"
        const isEmailVerified = authUser.email_confirmed_at != null

        // First fetch the initial balance
        await fetchBalance(authUser.id)

        // Only distribute welcome tokens if:
        // 1. Email is verified
        // 2. User hasn't received welcome tokens before (according to localStorage)
        // 3. This is a new holder (not an existing one)
        if (isEmailVerified && !hasReceivedWelcomeTokens && holderData.isNew) {
          await distributeWelcomeTokens(authUser.id)
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
        toast({
          title: "Error",
          description: "Failed to load user data. Please try again.",
          variant: "destructive",
        })
        // Redirect to login if not authenticated
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserData()
  }, [router, supabase, toast])

  const pollBalance = async (userId: string, attempts = 0) => {
    if (attempts >= MAX_BALANCE_POLL_ATTEMPTS) {
      setIsPollingBalance(false)
      return
    }

    try {
      const response = await fetch(`/api/holders/${userId}/balance`)
      if (!response.ok) {
        throw new Error("Failed to fetch balance")
      }

      const data = await response.json()

      // If balance is greater than 0, stop polling
      if (data.balance > 0) {
        setBalance(data.balance)
        setIsPollingBalance(false)
        return
      }

      // Otherwise, wait and try again
      setTimeout(() => pollBalance(userId, attempts + 1), 2000)
    } catch (error) {
      console.error("Error polling balance:", error)
      setIsPollingBalance(false)
    }
  }

  const distributeWelcomeTokens = async (userId: string) => {
    setIsDistributingWelcomeTokens(true)
    try {
      const response = await fetch(`/api/holders/${userId}/welcome-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Error distributing welcome tokens:", errorData)
        return
      }

      const data = await response.json()

      // Mark welcome tokens as received
      localStorage.setItem(WELCOME_TOKENS_KEY, "true")

      toast({
        title: "Welcome!",
        description: "You've received 10 tokens as a welcome bonus!",
      })

      // Start polling for balance updates
      setIsPollingBalance(true)
      pollBalance(userId)
    } catch (error) {
      console.error("Error distributing welcome tokens:", error)
    } finally {
      setIsDistributingWelcomeTokens(false)
    }
  }

  const fetchBalance = async (holderId: string) => {
    try {
      const response = await fetch(`/api/holders/${holderId}/balance`)
      if (!response.ok) {
        const errorData = await response.json()
        console.error("Error fetching balance:", errorData)
        throw new Error("Failed to fetch balance")
      }
      const data = await response.json()
      setBalance(data.balance)
      return data.balance
    } catch (error) {
      console.error("Error fetching balance:", error)
      toast({
        title: "Error",
        description: "Failed to fetch your token balance",
        variant: "destructive",
      })
      setBalance(0) // Default to 0 on error
      return 0
    }
  }

  const handleSpendToken = async () => {
    if (!user) return

    setIsSpending(true)
    try {
      const response = await fetch(`/api/holders/${user.id}/spend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: 1 }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to spend token")
      }

      // Optimistically update the balance
      if (balance !== null) {
        setBalance(Math.max(0, balance - 1))
      }

      // Refresh balance to ensure accuracy
      await fetchBalance(user.id)

      toast({
        title: "Success!",
        description: "You spent 1 token successfully!",
      })
    } catch (error) {
      console.error("Error spending token:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to spend token. Do you have enough balance?",
        variant: "destructive",
      })
      // Refresh balance to ensure accuracy after error
      if (user) {
        await fetchBalance(user.id)
      }
    } finally {
      setIsSpending(false)
    }
  }

  const handleRewardToken = async () => {
    if (!user) return

    setIsRewarding(true)
    try {
      const response = await fetch(`/api/holders/${user.id}/reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: 1 }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to reward token")
      }

      // Optimistically update the balance by adding 1 token
      if (balance !== null) {
        setBalance(balance + 1)
      }

      toast({
        title: "Success!",
        description: "You received 1 token as a reward!",
      })

      // Fetch the actual balance after a short delay to ensure consistency
      setTimeout(async () => {
        if (user) {
          await fetchBalance(user.id)
        }
      }, 2000)
    } catch (error) {
      console.error("Error rewarding token:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reward token.",
        variant: "destructive",
      })
      // Refresh balance to ensure accuracy after error
      if (user) {
        await fetchBalance(user.id)
      }
    } finally {
      setIsRewarding(false)
    }
  }

  const handleWithdraw = async () => {
    if (!user || !withdrawAddress || balance === 0) return

    setIsWithdrawing(true)
    try {
      const response = await fetch(`/api/holders/${user.id}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          toAddress: withdrawAddress,
          amount: balance,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to withdraw tokens")
      }

      // Optimistically update the balance to 0 after withdrawal
      setBalance(0)

      toast({
        title: "Success!",
        description: `You withdrew ${balance} tokens to ${withdrawAddress}`,
      })

      setWithdrawAddress("")

      // Fetch the actual balance after a short delay to ensure consistency
      setTimeout(async () => {
        if (user) {
          await fetchBalance(user.id)
        }
      }, 2000)
    } catch (error) {
      console.error("Error withdrawing tokens:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to withdraw tokens",
        variant: "destructive",
      })
      // Refresh balance to ensure accuracy after error
      if (user) {
        await fetchBalance(user.id)
      }
    } finally {
      setIsWithdrawing(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  // Function to open the wallet address on Basescan
  const openOnBasescan = (address: string) => {
    window.open(`https://basescan.org/address/${address}`, "_blank")
  }

  // Function to truncate wallet address
  const truncateAddress = (address: string) => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  // Show loading state for any async operation
  if (isLoading || isCreatingHolder || isDistributingWelcomeTokens) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p>
          {isCreatingHolder
            ? isNewWallet
              ? "Setting up your wallet..."
              : "Retrieving your wallet..."
            : isDistributingWelcomeTokens
              ? "Distributing your welcome tokens..."
              : "Loading..."}
        </p>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Token Dashboard</h1>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Wallet</CardTitle>
            <CardDescription>View your wallet details and balance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
            <div>
              <Label>Wallet Address</Label>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm font-mono">
                  {user?.holderAddress ? truncateAddress(user.holderAddress) : "Loading..."}
                </p>
                {user?.holderAddress && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => openOnBasescan(user.holderAddress)}
                    title="View on Basescan"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">View on Basescan</span>
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Token Balance</Label>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">
                    {isPollingBalance ? (
                      <span className="flex items-center">
                        <Loader2 className="h-5 w-5 mr-2 animate-spin inline-block" />
                        Updating...
                      </span>
                    ) : (
                      balance
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => user && fetchBalance(user.id)}
                disabled={isLoading || isPollingBalance}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Actions</CardTitle>
            <CardDescription>Spend or withdraw your tokens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleSpendToken} disabled={isSpending || balance === 0 || isPollingBalance}>
                  {isSpending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Spend 1 Token"
                  )}
                </Button>
                <Button onClick={handleRewardToken} disabled={isRewarding || isPollingBalance} variant="secondary">
                  {isRewarding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Reward 1 Token"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Spend tokens for fun or reward yourself with more tokens!</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdrawAddress">Withdraw Address</Label>
              <Input
                id="withdrawAddress"
                placeholder="0x..."
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                disabled={isPollingBalance}
              />
              <Button
                className="w-full mt-2"
                variant="outline"
                onClick={handleWithdraw}
                disabled={isWithdrawing || !withdrawAddress || balance === 0 || isPollingBalance}
              >
                {isWithdrawing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Withdraw All Tokens (${balance})`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

