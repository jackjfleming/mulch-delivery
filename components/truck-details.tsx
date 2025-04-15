"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  CheckIcon,
  AlertCircleIcon,
  PlusIcon,
  PackageIcon,
  UserIcon,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Truck, Stop, Route, Scout } from "@/lib/types"
import {
  getTruckDetails,
  getRoutes,
  assignStopToTruck,
  unassignStopFromTruck,
  getScouts,
  assignScoutToTruck,
  removeScoutFromTruck,
} from "@/lib/actions"
import { formatProductName } from "@/lib/utils"
import StopDetails from "@/components/stop-details"

export default function TruckDetails({ truck, onBack }) {
  const [truckData, setTruckData] = useState<Truck | null>(null)
  const [loading, setLoading] = useState(true)
  const [routes, setRoutes] = useState<Route[]>([])
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState("")
  const [availableStops, setAvailableStops] = useState<Stop[]>([])
  const [selectedStopId, setSelectedStopId] = useState("")
  const [scouts, setScouts] = useState<Scout[]>([])
  const [addScoutDialogOpen, setAddScoutDialogOpen] = useState(false)
  const [selectedScout, setSelectedScout] = useState("")

  useEffect(() => {
    fetchTruckDetails()
    fetchRoutes()
    fetchScouts()
  }, [truck.id])

  async function fetchTruckDetails() {
    try {
      setLoading(true)
      console.log("Fetching truck details for ID:", truck.id)
      const truckDetails = await getTruckDetails(truck.id)
      console.log("Truck details:", truckDetails)
      setTruckData(truckDetails)
    } catch (error) {
      console.error("Error fetching truck details:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchRoutes() {
    try {
      const routesData = await getRoutes()
      console.log("Routes data:", routesData)
      setRoutes(routesData || [])
    } catch (error) {
      console.error("Error fetching routes:", error)
    }
  }

  async function fetchScouts() {
    try {
      const scoutsData = await getScouts()
      setScouts(scoutsData || [])
    } catch (error) {
      console.error("Error fetching scouts:", error)
    }
  }

  function handleRouteChange(routeId: string) {
    setSelectedRoute(routeId)
    setSelectedStopId("")

    // Find unassigned stops from the selected route
    const route = routes.find((r) => r.id === routeId)
    if (route && route.stops) {
      const unassignedStops = route.stops.filter((stop) => !stop.assigned_truck_id && stop.status !== "delivered")
      setAvailableStops(unassignedStops)
    } else {
      setAvailableStops([])
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>
      case "partial":
        return <Badge variant="secondary">Partially Delivered</Badge>
      case "delivered":
        return <Badge>Delivered</Badge>
      case "pending_spread":
        return <Badge variant="secondary">Pending Spread</Badge>
      case "complete":
        return <Badge variant="success">Complete</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  async function handleClaimStop() {
    if (!selectedStopId) return

    try {
      await assignStopToTruck(selectedStopId, truck.id)
      setClaimDialogOpen(false)
      setSelectedStopId("")
      setSelectedRoute("")
      fetchTruckDetails()
    } catch (error) {
      console.error("Error claiming stop:", error)
    }
  }

  async function handleUnassignStop(stopId: string) {
    try {
      await unassignStopFromTruck(stopId)
      fetchTruckDetails()
    } catch (error) {
      console.error("Error unassigning stop:", error)
    }
  }

  async function handleAddScout() {
    if (!selectedScout) return

    try {
      const result = await assignScoutToTruck(truck.id, selectedScout)
      if (result.success) {
        // Find the scout object from the scouts array
        const scoutToAdd = scouts.find((s) => s.id === selectedScout)

        // Update local state immediately
        if (scoutToAdd) {
          setTruckData((prevData) => ({
            ...prevData,
            assignedScouts: [...(prevData.assignedScouts || []), scoutToAdd],
          }))
        }

        setAddScoutDialogOpen(false)
        setSelectedScout("")
      }
    } catch (error) {
      console.error("Error assigning scout to truck:", error)
    }
  }

  async function handleRemoveScout(scoutId: string) {
    try {
      const result = await removeScoutFromTruck(truck.id, scoutId)
      if (result.success) {
        // Update local state immediately
        setTruckData((prevData) => ({
          ...prevData,
          assignedScouts: prevData.assignedScouts.filter((scout) => scout.id !== scoutId),
        }))
      }
    } catch (error) {
      console.error("Error removing scout from truck:", error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading truck details...</div>
  }

  if (!truckData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold">Truck Details</h2>
        </div>
        <div className="text-center py-8 bg-muted rounded-lg">
          <p className="text-muted-foreground mb-4">Could not load truck details</p>
          <Button variant="outline" onClick={onBack}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const currentStops = truckData.currentStops || []
  const completedStops = truckData.completedStops || []
  const assignedScouts = truckData.assignedScouts || []

  const totalItems = [...currentStops, ...completedStops].reduce((sum, stop) => sum + (stop.totalQuantity || 0), 0)

  const deliveredItems = completedStops.reduce((sum, stop) => sum + (stop.totalQuantity || 0), 0)

  const remainingItems = totalItems - deliveredItems
  const percentComplete = totalItems > 0 ? Math.round((deliveredItems / totalItems) * 100) : 0

  if (selectedStop) {
    return (
      <StopDetails
        stop={selectedStop}
        onBack={() => {
          setSelectedStop(null)
          fetchTruckDetails()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold">{truckData.driver_name}'s Truck</h2>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Truck Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Capacity</div>
              <div className="text-xl font-medium">{truckData.capacity} bags</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="text-xl font-medium">
                <Badge variant={truckData.active ? "default" : "outline"}>
                  {truckData.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Phone</div>
              <div className="text-xl font-medium">
                {truckData.phone ? (
                  <a href={`tel:${truckData.phone}`} className="underline">
                    {truckData.phone}
                  </a>
                ) : (
                  "Not provided"
                )}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Assigned Stops</div>
              <div className="text-xl font-medium">{currentStops.length}</div>
            </div>
          </div>

          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-sm">
              <span>Delivery Progress</span>
              <span>{percentComplete}%</span>
            </div>
            <Progress value={percentComplete} className="h-2" />
          </div>

          <div className="flex justify-end gap-2">
            <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Claim Stop
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Claim Stop for Truck</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Route</label>
                    <Select value={selectedRoute} onValueChange={handleRouteChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a route" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes.map((route) => (
                          <SelectItem key={route.id} value={route.id}>
                            {route.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedRoute && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Stop</label>
                      <Select value={selectedStopId} onValueChange={setSelectedStopId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a stop" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStops.length > 0 ? (
                            availableStops.map((stop) => (
                              <SelectItem key={stop.id} value={stop.id}>
                                {stop.customer_name} - {stop.totalQuantity || 0} items
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              No unassigned stops available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleClaimStop} disabled={!selectedStopId}>
                      Claim Stop
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle>Assigned Scouts</CardTitle>
          <Dialog open={addScoutDialogOpen} onOpenChange={setAddScoutDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Scout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Scout to Truck</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Scout</label>
                  <Select value={selectedScout} onValueChange={setSelectedScout}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a scout" />
                    </SelectTrigger>
                    <SelectContent>
                      {scouts
                        .filter((scout) => !assignedScouts.some((as) => as.id === scout.id))
                        .map((scout) => (
                          <SelectItem key={scout.id} value={scout.id}>
                            {scout.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddScoutDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddScout} disabled={!selectedScout}>
                    Add Scout
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {assignedScouts.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No scouts assigned to this truck</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {assignedScouts.map((scout) => (
                <div key={scout.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center">
                    <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{scout.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleRemoveScout(scout.id)}>
                    <span className="sr-only">Remove</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Product Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // Calculate product totals for current stops
            const productTotals = {}
            const productDelivered = {}

            currentStops.forEach((stop) => {
              if (stop.products && stop.products.length > 0) {
                stop.products.forEach((product) => {
                  const productName = product.product?.name || "Unknown"
                  // Track total quantity
                  productTotals[productName] = (productTotals[productName] || 0) + product.quantity
                  // Track delivered quantity
                  productDelivered[productName] =
                    (productDelivered[productName] || 0) + (product.delivered_quantity || 0)
                })
              }
            })

            const productEntries = Object.entries(productTotals)

            if (productEntries.length === 0) {
              return (
                <div className="text-center py-4 text-muted-foreground">No products on truck for current stops</div>
              )
            }

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {productEntries.map(([productName, quantity]) => {
                    const delivered = productDelivered[productName] || 0
                    const remaining = Number(quantity) - Number(delivered)

                    return (
                      <div key={productName} className="flex items-center justify-between p-2 border rounded-md">
                        <div className="font-medium">{formatProductName(productName)}</div>
                        <div className="flex flex-col items-end text-sm">
                          <Badge variant="secondary">{remaining} remaining</Badge>
                          <span className="text-muted-foreground text-xs mt-1">
                            {delivered} of {quantity} delivered
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-sm font-medium pt-2 border-t">
                  <span>Remaining Inventory:</span>
                  <span>
                    {productEntries.reduce((sum, [productName, quantity]) => {
                      const delivered = productDelivered[productName] || 0
                      return sum + (Number(quantity) - Number(delivered))
                    }, 0)}{" "}
                    bags
                  </span>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-medium">Current Stops ({currentStops.length})</h3>

        {currentStops.length === 0 ? (
          <div className="text-center py-8 bg-muted rounded-lg">
            <p className="text-muted-foreground mb-4">No current stops assigned to this truck</p>
            <Button variant="outline" onClick={() => setClaimDialogOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Claim Your First Stop
            </Button>
          </div>
        ) : (
          currentStops.map((stop) => (
            <Card
              key={stop.id}
              className={`overflow-hidden ${stop.has_problems ? "border-red-200 bg-red-50" : ""}`}
              onClick={() => setSelectedStop(stop)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{stop.customer_name}</div>
                    <div className="text-sm text-muted-foreground flex items-center">
                      <MapPinIcon className="h-3 w-3 mr-1" />
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {stop.address}
                      </a>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {stop.has_problems && (
                      <Badge variant="destructive" className="ml-auto">
                        <AlertCircleIcon className="h-3 w-3 mr-1" />
                        Problem
                      </Badge>
                    )}
                    {getStatusBadge(stop.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                  <div className="flex items-center">
                    <PhoneIcon className="h-3 w-3 mr-1" />
                    <a href={`tel:${stop.phone}`} className="underline" onClick={(e) => e.stopPropagation()}>
                      {stop.phone}
                    </a>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span> {stop.totalQuantity} items
                  </div>
                  <div>
                    <span className="text-muted-foreground">Products:</span> {stop.products?.length || 0}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Paid:</span> {stop.paid ? "Yes" : "No"}
                  </div>
                </div>

                {stop.products && stop.products.length > 0 && (
                  <div className="text-xs space-y-1 mb-2">
                    <div className="font-medium text-muted-foreground flex items-center">
                      <PackageIcon className="h-3 w-3 mr-1" />
                      Products:
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {stop.products.map((product) => (
                        <div key={product.id} className="flex justify-normal">
                          <span>{formatProductName(product.product?.name || "")}: </span>
                          <span className="flex items-center">
                            {product.quantity}{" "}
                            {product.spread_requested && (
                              <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4">
                                Spread
                              </Badge>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnassignStop(stop.id)
                    }}
                  >
                    Unassign
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {completedStops.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Completed Stops ({completedStops.length})</h3>
          {completedStops.map((stop) => (
            <Card key={stop.id} className="overflow-hidden bg-muted/40" onClick={() => setSelectedStop(stop)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium">{stop.customer_name}</div>
                    <div className="text-sm text-muted-foreground flex items-center">
                      <MapPinIcon className="h-3 w-3 mr-1" />
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {stop.address}
                      </a>
                    </div>
                  </div>

                  <Badge className="ml-auto">
                    <CheckIcon className="h-3 w-3 mr-1" />
                    Delivered
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total:</span> {stop.totalQuantity} items
                  </div>
                  <div>
                    <span className="text-muted-foreground">Products:</span> {stop.products?.length || 0}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
