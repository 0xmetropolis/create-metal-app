import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-2xl">Authentication Error</CardTitle>
          </div>
          <CardDescription>There was a problem with your authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">We couldn't complete the authentication process. This could be due to:</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>An expired or invalid authentication link</li>
            <li>A network error during the authentication process</li>
            <li>The account may have been deleted or disabled</li>
          </ul>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Link href="/login" className="w-full">
            <Button className="w-full">Try Again</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}

