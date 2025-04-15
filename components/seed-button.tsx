"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { seedDatabase } from "@/lib/seed"
import { useToast } from "@/hooks/use-toast"

export default function SeedButton() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleSeed() {
    try {
      setLoading(true)
      const result = await seedDatabase()

      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        })
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error seeding database:", error)
      toast({
        title: "Error",
        description: "Failed to seed database",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleSeed} disabled={loading} variant="outline" size="sm">
      {loading ? "Seeding..." : "Seed Database"}
    </Button>
  )
}
