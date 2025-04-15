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
  TruckIcon,
  UserIcon,
  AlertCircleIcon,
  PlusIcon,
  PackageIcon,
} from "lucide-react"
import StopDetails from "@/components/stop-details"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Route, Stop, Truck, Product } from "@/lib/types"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { formatProductName } from "@/lib/utils"
import {
  getRouteDetails,
  assignTruckToStops,
  createStop,
  getTrucks,
  getProducts,
  addProductToStop,
} from "@/lib/actions"

export default function RouteDetails({ route, onBack }) {
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [selectedTruck, setSelectedTruck] = useState("")
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [routeData, setRouteData] = useState<Route | null>(null)
  const [addStopDialogOpen, setAddStopDialogOpen] = useState(false)
  const [newStop, setNewStop] = useState({
    customerName: "",
    address: "",
    phone: "",
    paid: false,
    instructions: "",
  })
  const [newStopProducts, setNewStopProducts] = useState<
    {
      productId: string
      quantity: string
      spreadRequested: boolean
    }[]
  >([{ productId: "", quantity: "1", spreadRequested: false }])

  useEffect(() => {
    fetchRouteDetails()
    fetchTrucks()
    fetchProducts()
  }, [route.id])

  async function fetchRouteDetails() {
    try {
      setLoading(true)
      console.log("Fetching route details for ID:", route.id)
      const routeDetails = await getRouteDetails(route.id)
      console.log("Route details:", routeDetails)
      setRouteData(routeDetails)
    } catch (error) {
      console.error("Error fetching route details:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTrucks() {
    try {
      const trucksData = await getTrucks()
      console.log("Trucks data:", trucksData)
      setTrucks(trucksData.filter((truck) => truck.active) || [])
    } catch (error) {
      console.error("Error fetching trucks:", error)
    }
  }

  async function fetchProducts() {
    try {
      const productsData = await getProducts()
      console.log("Products data:", productsData)
      setProducts(productsData || [])
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  async function handleClaimStops() {
    if (!selectedTruck) return

    try {
      await assignTruckToStops(route.id, selectedTruck)
      setClaimDialogOpen(false)
      setSelectedTruck("")
      fetchRouteDetails()
    } catch (error) {
      console.error("Error claiming stops:", error)
    }
  }

  async function handleAddStop() {
    if (!newStop.customerName || !newStop.address || newStopProducts.some((p) => !p.productId || !p.quantity)) return

    try {
      // First create the stop
      const result = await createStop({
        route_id: route.id,
        customer_name: newStop.customerName,
        address: newStop.address,
        phone: newStop.phone,
        paid: newStop.paid,
        instructions: newStop.instructions,
        status: "pending",
        has_problems: false,
      })

      if (result.success && result.stopId) {
        // Then add products to the stop
        for (const product of newStopProducts) {
          await addProductToStop({
            stop_id: result.stopId,
            product_id: product.productId,
            quantity: Number.parseInt(product.quantity),
            spread_requested: product.spreadRequested,
          })
        }

        // Reset form
        setNewStop({
          customerName: "",
          address: "",
          phone: "",
          paid: false,
          instructions: "",
        })
        setNewStopProducts([{ productId: "", quantity: "1", spreadRequested: false }])

        setAddStopDialogOpen(false)
        fetchRouteDetails()
      }
    } catch (error) {
      console.error("Error adding stop:", error)
    }
  }

  function addProductField() {
    setNewStopProducts([...newStopProducts, { productId: "", quantity: "1", spreadRequested: false }])
  }

  function removeProductField(index: number) {
    if (newStopProducts.length > 1) {
      const updatedProducts = [...newStopProducts]
      updatedProducts.splice(index, 1)
      setNewStopProducts(updatedProducts)
    }
  }

  function updateProductField(index: number, field: string, value: string | boolean) {
    const updatedProducts = [...newStopProducts]
    updatedProducts[index] = { ...updatedProducts[index], [field]: value }
    setNewStopProducts(updatedProducts)
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

  if (loading) {
    return <div className="text-center py-8">Loading route details...</div>
  }

  if (!routeData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold">Route Details</h2>
        </div>
        <div className="text-center py-8 bg-muted rounded-lg">
          <p className="text-muted-foreground mb-4">Could not load route details</p>
          <Button variant="outline" onClick={onBack}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const stops = routeData.stops || []

  // Calculate totals based on products
  const totalProducts = stops.reduce((sum, stop) => {
    return sum + (stop.totalQuantity || 0)
  }, 0)

  const deliveredProducts = stops
    .filter((stop) => stop.status === "delivered")
    .reduce((sum, stop) => sum + (stop.totalQuantity || 0), 0)

  const remainingProducts = totalProducts - deliveredProducts

  const unassignedProducts = stops
    .filter((stop) => !stop.assigned_truck_id && stop.status !== "delivered")
    .reduce((sum, stop) => sum + (stop.totalQuantity || 0), 0)

  const percentComplete = Math.round((deliveredProducts / totalProducts) * 100) || 0

  if (selectedStop) {
    return (
      <StopDetails
        stop={selectedStop}
        onBack={(updatedStop) => {
          if (updatedStop) {
            // Update the stop in the local state
            setRouteData((prevRouteData) => {
              if (!prevRouteData || !prevRouteData.stops) return prevRouteData

              const updatedStops = prevRouteData.stops.map((stop) => (stop.id === updatedStop.id ? updatedStop : stop))

              return {
                ...prevRouteData,
                stops: updatedStops,
              }
            })
          }
          setSelectedStop(null)
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
        <h2 className="text-xl font-bold">{routeData.name}</h2>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Route Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-xl font-medium">{totalProducts} items</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Delivered</div>
              <div className="text-xl font-medium">{deliveredProducts} items</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Remaining</div>
              <div className="text-xl font-bold">{remainingProducts} items</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unassigned</div>
              <div className="text-xl font-medium text-amber-600">{unassignedProducts} items</div>
            </div>
          </div>

          <div className="space-y-1 mb-4">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{percentComplete}%</span>
            </div>
            <Progress value={percentComplete} className="h-2" />
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              <TruckIcon className="h-4 w-4 inline mr-1" />
              {(routeData.assignedTrucks || []).length} trucks assigned
            </div>

            <div className="flex gap-2">
              <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <TruckIcon className="h-4 w-4 mr-2" />
                    Claim Stops
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Claim Stops for Truck</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Truck</label>
                      <Select value={selectedTruck} onValueChange={setSelectedTruck}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a truck" />
                        </SelectTrigger>
                        <SelectContent>
                          {trucks.map((truck) => (
                            <SelectItem key={truck.id} value={truck.id}>
                              {truck.driver_name} ({truck.capacity} capacity)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      This will assign all unassigned stops to the selected truck.
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleClaimStops}>Claim Stops</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={addStopDialogOpen} onOpenChange={setAddStopDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Stop
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Stop</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer-name">Customer Name</Label>
                      <Input
                        id="customer-name"
                        value={newStop.customerName}
                        onChange={(e) => setNewStop({ ...newStop, customerName: e.target.value })}
                        placeholder="Enter customer name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={newStop.address}
                        onChange={(e) => setNewStop({ ...newStop, address: e.target.value })}
                        placeholder="Enter address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={newStop.phone}
                        onChange={(e) => setNewStop({ ...newStop, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Products</Label>
                      {newStopProducts.map((product, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-end mb-2">
                          <div className="col-span-5">
                            <Select
                              value={product.productId}
                              onValueChange={(value) => updateProductField(index, "productId", value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              min="1"
                              value={product.quantity}
                              onChange={(e) => updateProductField(index, "quantity", e.target.value)}
                              placeholder="Qty"
                            />
                          </div>
                          <div className="col-span-3 flex items-center space-x-2">
                            <Checkbox
                              id={`spread-${index}`}
                              checked={product.spreadRequested}
                              onCheckedChange={(checked) =>
                                updateProductField(index, "spreadRequested", checked === true)
                              }
                            />
                            <Label htmlFor={`spread-${index}`} className="text-xs">
                              Spread
                            </Label>
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProductField(index)}
                              disabled={newStopProducts.length <= 1}
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={addProductField}>
                        Add Another Product
                      </Button>
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                      <Checkbox
                        id="paid"
                        checked={newStop.paid}
                        onCheckedChange={(checked) => setNewStop({ ...newStop, paid: checked === true })}
                      />
                      <Label htmlFor="paid">Paid</Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instructions">Special Instructions</Label>
                      <Input
                        id="instructions"
                        value={newStop.instructions}
                        onChange={(e) => setNewStop({ ...newStop, instructions: e.target.value })}
                        placeholder="Enter any special instructions"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAddStopDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddStop}>Add Stop</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-medium">Stops ({stops.length})</h3>

        {stops.length === 0 ? (
          <div className="text-center py-8 bg-muted rounded-lg">
            <p className="text-muted-foreground mb-4">No stops found for this route</p>
            <Button variant="outline" onClick={() => setAddStopDialogOpen(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Your First Stop
            </Button>
          </div>
        ) : (
          stops.map((stop) => (
            <Card
              key={stop.id}
              className={`overflow-hidden ${
                stop.has_problems ? "border-red-200 bg-red-50" : stop.status === "complete" ? "bg-muted/40" : ""
              }`}
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
                        <div key={product.id} className="flex items-center">
                          <span>
                            {formatProductName(product.product?.name || "")} ({product.quantity})
                            {product.spread_requested && (
                              <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4 inline-flex">
                                Spread
                              </Badge>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stop.assigned_truck_id && (
                  <div className="text-xs flex items-center text-muted-foreground">
                    <TruckIcon className="h-3 w-3 mr-1" />
                    Assigned to: {trucks.find((t) => t.id === stop.assigned_truck_id)?.driver_name || "Unknown Driver"}
                  </div>
                )}

                {stop.assignedScouts && stop.assignedScouts.length > 0 && (
                  <div className="text-xs flex items-center text-muted-foreground mt-1">
                    <UserIcon className="h-3 w-3 mr-1" />
                    Scouts: {stop.assignedScouts.join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
