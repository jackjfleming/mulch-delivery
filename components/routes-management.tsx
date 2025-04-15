"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ChevronRightIcon, TruckIcon, PlusIcon } from "lucide-react"
import RouteDetails from "@/components/route-details"
import type { Route } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { formatProductName } from "@/lib/utils"
import { createRoute, getRoutes } from "@/lib/actions"

export default function RoutesManagement() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [loading, setLoading] = useState(true)
  const [newRouteName, setNewRouteName] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  useEffect(() => {
    fetchRoutes()
  }, [])

  // Update the fetchRoutes function to handle errors better
  async function fetchRoutes() {
    try {
      setLoading(true)
      let routesData = []
      try {
        routesData = await getRoutes()
        console.log("Routes data:", routesData)
      } catch (error) {
        console.error("Error fetching routes:", error)
        routesData = []
      }
      setRoutes(routesData || [])
    } catch (error) {
      console.error("Error in fetchRoutes:", error)
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }

  async function handleAddRoute() {
    if (!newRouteName.trim()) return

    try {
      await createRoute(newRouteName.trim())
      setNewRouteName("")
      setAddDialogOpen(false)
      fetchRoutes()
    } catch (error) {
      console.error("Error adding route:", error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading routes...</div>
  }

  if (selectedRoute) {
    return (
      <RouteDetails
        route={selectedRoute}
        onBack={() => {
          setSelectedRoute(null)
          fetchRoutes()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Active Routes</h2>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Route
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Route</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="route-name">Route Name</Label>
                <Input
                  id="route-name"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="Enter route name"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddRoute}>Add Route</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {routes.length === 0 ? (
        <div className="text-center py-8 bg-muted rounded-lg">
          <p className="text-muted-foreground mb-4">No routes found</p>
          <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Your First Route
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {routes.map((route) => {
            const stops = route.stops || []

            // Calculate totals based on products for new schema
            let totalItems = 0
            let deliveredItems = 0
            let unassignedItems = 0
            const unassignedByProduct = {}

            stops.forEach((stop) => {
              // Handle both old and new schema
              if (stop.products && stop.products.length > 0) {
                // New schema with products
                const stopTotal = stop.totalQuantity || 0
                totalItems += stopTotal

                if (stop.status === "delivered") {
                  deliveredItems += stopTotal
                }

                if (!stop.assigned_truck_id && stop.status !== "delivered") {
                  unassignedItems += stopTotal

                  // Group by product type
                  stop.products.forEach((product) => {
                    const productName = product.product?.name || "Unknown"
                    unassignedByProduct[productName] = (unassignedByProduct[productName] || 0) + product.quantity
                  })
                } else {
                  // Old schema with mulch_quantity
                  const quantity = stop.mulch_quantity || 0
                  totalItems += quantity

                  if (stop.status === "delivered") {
                    deliveredItems += quantity
                  }

                  if (!stop.assigned_truck_id && stop.status !== "delivered") {
                    unassignedItems += quantity
                  }
                }
              }
            })

            const remainingItems = totalItems - deliveredItems
            const percentComplete = Math.round((deliveredItems / totalItems) * 100) || 0

            return (
              <Card key={route.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{route.name}</CardTitle>
                      <CardDescription>{stops.length} stops</CardDescription>
                    </div>
                    <Badge variant={percentComplete === 100 ? "default" : "outline"}>
                      {percentComplete === 100 ? "Complete" : "In Progress"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-2">
                  <div className="grid grid-cols-4 gap-2 mb-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-medium">{totalItems} items</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Delivered</div>
                      <div className="font-medium">{deliveredItems} items</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Remaining</div>
                      <div className="font-medium font-bold">{remainingItems} items</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Unassigned</div>
                      <div className="font-medium text-amber-600">
                        {unassignedItems} items
                        {Object.keys(unassignedByProduct).length > 0 && (
                          <div className="text-xs mt-1 space-y-1">
                            {Object.entries(unassignedByProduct).map(([product, count]) => (
                              <div key={product}>
                                {formatProductName(product)}: <span className="font-semibold">{count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Progress value={percentComplete} className="h-2" />
                </CardContent>

                <Separator />

                <CardFooter className="flex justify-between py-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <TruckIcon className="h-4 w-4 mr-1" />
                    {(route.assignedTrucks || []).length} trucks assigned
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelectedRoute(route)}>
                    View Details
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
