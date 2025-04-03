import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Metal SDK Demo</CardTitle>
          <CardDescription>Create a wallet and manage your tokens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">This demo app allows you to:</p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Create a wallet when you sign up</li>
            <li>Receive 10 tokens automatically</li>
            <li>Spend tokens on actions</li>
            <li>Withdraw your tokens</li>
          </ul>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Link href="/signup" className="w-1/2">
            <Button className="w-full">Sign Up</Button>
          </Link>
          <Link href="/login" className="w-1/2">
            <Button className="w-full" variant="outline">
              Log In
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

