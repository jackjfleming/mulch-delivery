"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TruckIcon, MapPinIcon, AlertTriangleIcon, PackageIcon } from "lucide-react"
import { getRoutes, getTrucks, getProblems } from "@/lib/actions"

export default function Dashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalMulch: 0,
    deliveredMulch: 0,
    remainingMulch: 0,
    activeRoutes: 0,
    activeTrucks: 0,
    problemStops: 0,
    completedStops: 0,
    totalStops: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true)

        // Get routes
        let routes = []
        try {
          routes = await getRoutes()
          console.log("Dashboard routes:", routes)
        } catch (error) {
          console.error("Error fetching routes:", error)
          routes = []
        }

        // Get trucks
        let trucks = []
        try {
          trucks = await getTrucks()
          console.log("Dashboard trucks:", trucks)
        } catch (error) {
          console.error("Error fetching trucks:", error)
          trucks = []
        }

        // Get problems
        let problems = []
        try {
          problems = await getProblems()
          console.log("Dashboard problems:", problems)
        } catch (error) {
          console.error("Error fetching problems:", error)
          problems = []
        }

        // Calculate stats
        let totalMulch = 0
        let deliveredMulch = 0
        let completedStops = 0
        let totalStops = 0

        // Process all stops from all routes
        routes.forEach((route) => {
          if (route.stops) {
            route.stops.forEach((stop) => {
              // Use totalQuantity for new schema or mulch_quantity for old schema
              const quantity = stop.totalQuantity || stop.mulch_quantity || 0
              totalMulch += quantity
              totalStops++

              if (stop.status === "delivered") {
                deliveredMulch += quantity
                completedStops++
              }
            })
          }
        })

        setStats({
          totalMulch,
          deliveredMulch,
          remainingMulch: totalMulch - deliveredMulch,
          activeRoutes: routes.length,
          activeTrucks: trucks.filter((truck) => truck.active).length,
          problemStops: problems.length,
          completedStops,
          totalStops,
        })
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        // Set default stats to prevent UI errors
        setStats({
          totalMulch: 0,
          deliveredMulch: 0,
          remainingMulch: 0,
          activeRoutes: 0,
          activeTrucks: 0,
          problemStops: 0,
          completedStops: 0,
          totalStops: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const percentComplete = Math.round((stats.deliveredMulch / stats.totalMulch) * 100) || 0

  if (loading) {
    return <div className="text-center py-8">Loading dashboard data...</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Delivery Progress</CardTitle>
          <CardDescription>Overall mulch delivery status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">{stats.remainingMulch} bags remaining</div>
          <div className="flex justify-between text-sm mb-1">
            <span>{stats.deliveredMulch} delivered</span>
            <span>{stats.totalMulch} total</span>
          </div>
          <Progress value={percentComplete} className="h-3" />
          <div className="mt-4 text-sm text-muted-foreground">{percentComplete}% complete</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base flex items-center">
              <MapPinIcon className="w-4 h-4 mr-2" />
              Routes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.activeRoutes}</div>
            <p className="text-sm text-muted-foreground">Active routes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base flex items-center">
              <TruckIcon className="w-4 h-4 mr-2" />
              Trucks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.activeTrucks}</div>
            <p className="text-sm text-muted-foreground">Active trucks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base flex items-center">
              <PackageIcon className="w-4 h-4 mr-2" />
              Stops
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {stats.completedStops}/{stats.totalStops}
            </div>
            <p className="text-sm text-muted-foreground">Completed stops</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base flex items-center">
              <AlertTriangleIcon className="w-4 h-4 mr-2" />
              Problems
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.problemStops}</div>
            <p className="text-sm text-muted-foreground">Stops with issues</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
