"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircleIcon, CheckIcon, MapPinIcon, PhoneIcon } from "lucide-react"
import { resolveProblem, getProblems } from "@/lib/actions"

export default function ProblemsManagement() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProblems()
  }, [])

  async function fetchProblems() {
    try {
      setLoading(true)
      const problemsData = await getProblems()
      console.log("Problems data:", problemsData)
      setProblems(problemsData || [])
    } catch (error) {
      console.error("Error fetching problems:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleResolveProblem(problemId, stopId) {
    try {
      await resolveProblem(problemId)
      fetchProblems()
    } catch (error) {
      console.error("Error resolving problem:", error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading problems...</div>
  }

  if (problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckIcon className="h-12 w-12 text-green-500 mb-4" />
        <h2 className="text-xl font-medium mb-2">No Problems Reported</h2>
        <p className="text-muted-foreground text-center">All stops are currently problem-free. Great job!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Problems ({problems.length})</h2>
      </div>

      <div className="space-y-4">
        {problems.map((problem) => (
          <Card key={problem.id} className="border-red-200">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="flex items-center">
                  <AlertCircleIcon className="h-4 w-4 mr-2 text-red-500" />
                  {problem.stop?.customer_name}
                </CardTitle>
                <Badge variant="outline">{problem.route?.name}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center">
                  <MapPinIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(problem.stop?.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {problem.stop?.address}
                  </a>
                </div>

                <div className="flex items-center">
                  <PhoneIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a href={`tel:${problem.stop?.phone}`} className="underline">
                    {problem.stop?.phone}
                  </a>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Problem Description</h3>
                <p className="text-sm">{problem.description}</p>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => handleResolveProblem(problem.id, problem.stop_id)}>
                  Resolve Problem
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
