"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  CheckIcon,
  AlertCircleIcon,
  PlusIcon,
  TruckIcon,
  XCircleIcon,
  ArrowRightIcon,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { Scout, Product, Stop, StopProduct } from "@/lib/types"
import { formatProductName } from "@/lib/utils"
import {
  updateStop,
  assignScoutToStop,
  removeScoutFromStop,
  createProblem,
  resolveProblem,
  getProducts,
  addProductToStop,
  getScouts,
  updateStopProduct,
  removeProductFromStop,
  updateProductDeliveryStatus,
  markProductAsSpread,
  markAllProductsDelivered,
  markAllProductsSpread,
  assignTruckScoutsToStop,
} from "@/lib/actions"

export default function StopDetails({ stop: initialStop, onBack }) {
  // Use local state to track the current stop data
  const [stop, setStop] = useState<Stop>(initialStop)
  const [partialDeliveryAmount, setPartialDeliveryAmount] = useState("")
  const [addScoutDialogOpen, setAddScoutDialogOpen] = useState(false)
  const [selectedScout, setSelectedScout] = useState("")
  const [scoutRole, setScoutRole] = useState("drop")
  const [problemDescription, setProblemDescription] = useState("")
  const [problemDialogOpen, setProblemDialogOpen] = useState(false)
  const [scouts, setScouts] = useState<Scout[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({
    productId: "",
    quantity: "1",
    spreadRequested: false,
  })
  const [productDeliveryAmounts, setProductDeliveryAmounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [assignTruckScoutsDialogOpen, setAssignTruckScoutsDialogOpen] = useState(false)
  const [truckScoutRoles, setTruckScoutRoles] = useState({ drop: true, spread: false })

  async function handleAssignTruckScouts() {
    if (!stop.assigned_truck_id) {
      return
    }

    try {
      const result = await assignTruckScoutsToStop(stop.id, stop.assigned_truck_id, truckScoutRoles)
      if (result.success) {
        setAssignTruckScoutsDialogOpen(false)

        // Get the scout objects from the result
        if (result.assignedScouts && result.assignedScouts.length > 0) {
          // For each assigned scout
          result.assignedScouts.forEach((scout) => {
            // Add the scout with appropriate roles to local state
            if (truckScoutRoles.drop) {
              addLocalScout(scout.id, "drop")
            }
            if (truckScoutRoles.spread) {
              addLocalScout(scout.id, "spread")
            }
          })
        }
      }
    } catch (error) {
      console.error("Error assigning truck scouts to stop:", error)
    }
  }

  useEffect(() => {
    fetchScouts()
    fetchProducts()
    initializeProductDeliveryAmounts()
  }, [])

  function initializeProductDeliveryAmounts() {
    if (stop.products) {
      const amounts = {}
      stop.products.forEach((product) => {
        amounts[product.id] = product.delivered_quantity?.toString() || "0"
      })
      setProductDeliveryAmounts(amounts)
    }
  }

  async function fetchScouts() {
    try {
      setLoading(true)
      // Use the server action to fetch scouts
      const scoutsData = await getScouts()
      console.log("Fetched scouts:", scoutsData)
      setScouts(scoutsData || [])
    } catch (error) {
      console.error("Error in fetchScouts:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchProducts() {
    try {
      const productsData = await getProducts()
      setProducts(productsData)
    } catch (error) {
      console.error("Error fetching products:", error)
    }
  }

  // Helper function to update the local stop state
  function updateLocalStop(updatedData: Partial<Stop>) {
    setStop((prevStop) => ({
      ...prevStop,
      ...updatedData,
    }))
  }

  // Helper function to update a product in the local state
  function updateLocalProduct(productId: string, updatedData: Partial<StopProduct>) {
    setStop((prevStop) => {
      if (!prevStop.products) return prevStop

      const updatedProducts = prevStop.products.map((product) =>
        product.id === productId ? { ...product, ...updatedData } : product,
      )

      // Recalculate totals
      const totalQuantity = updatedProducts.reduce((sum, p) => sum + p.quantity, 0)
      const deliveredQuantity = updatedProducts.reduce((sum, p) => sum + (p.delivered_quantity || 0), 0)

      return {
        ...prevStop,
        products: updatedProducts,
        totalQuantity,
        deliveredQuantity,
      }
    })
  }

  // Helper function to remove a product from the local state
  function removeLocalProduct(productId: string) {
    setStop((prevStop) => {
      if (!prevStop.products) return prevStop

      const updatedProducts = prevStop.products.filter((product) => product.id !== productId)

      // Recalculate totals
      const totalQuantity = updatedProducts.reduce((sum, p) => sum + p.quantity, 0)
      const deliveredQuantity = updatedProducts.reduce((sum, p) => sum + (p.delivered_quantity || 0), 0)

      return {
        ...prevStop,
        products: updatedProducts,
        totalQuantity,
        deliveredQuantity,
      }
    })
  }

  // Helper function to add a product to the local state
  function addLocalProduct(newProduct: StopProduct) {
    setStop((prevStop) => {
      const updatedProducts = [...(prevStop.products || []), newProduct]

      // Recalculate totals
      const totalQuantity = updatedProducts.reduce((sum, p) => sum + p.quantity, 0)
      const deliveredQuantity = updatedProducts.reduce((sum, p) => sum + (p.delivered_quantity || 0), 0)

      return {
        ...prevStop,
        products: updatedProducts,
        totalQuantity,
        deliveredQuantity,
      }
    })
  }

  // Helper function to add a scout to the local state
  function addLocalScout(scoutId: string, role: "drop" | "spread") {
    const scout = scouts.find((s) => s.id === scoutId)
    if (!scout) return

    setStop((prevStop) => {
      // Create a copy of the current assigned scouts
      const assignedScouts = [...(prevStop.assignedScouts || [])]
      // Create a copy of the current scout roles
      const scoutRoles = { ...(prevStop.scoutRoles || {}) }

      // Add the scout if not already present
      if (!assignedScouts.includes(scout.name)) {
        assignedScouts.push(scout.name)
      }

      // Update the roles
      if (!scoutRoles[scout.name]) {
        scoutRoles[scout.name] = [role]
      } else if (!scoutRoles[scout.name].includes(role)) {
        scoutRoles[scout.name] = [...scoutRoles[scout.name], role]
      }

      console.log("Updated scout roles:", scoutRoles)
      console.log("Updated assigned scouts:", assignedScouts)

      return {
        ...prevStop,
        assignedScouts,
        scoutRoles,
      }
    })
  }

  // Helper function to remove a scout role from the local state
  function removeLocalScoutRole(scoutName: string, role: "drop" | "spread") {
    setStop((prevStop) => {
      // Create a copy of the current scout roles
      const scoutRoles = { ...(prevStop.scoutRoles || {}) }

      if (scoutRoles[scoutName]) {
        // Remove the specified role
        scoutRoles[scoutName] = scoutRoles[scoutName].filter((r) => r !== role)

        // If no roles left, remove the scout entirely
        if (scoutRoles[scoutName].length === 0) {
          const assignedScouts = prevStop.assignedScouts?.filter((name) => name !== scoutName) || []
          delete scoutRoles[scoutName]
          return {
            ...prevStop,
            assignedScouts,
            scoutRoles,
          }
        }
      }

      return {
        ...prevStop,
        scoutRoles,
      }
    })
  }

  // Helper function to add a problem to the local state
  function addLocalProblem(problem) {
    setStop((prevStop) => {
      const problems = [...(prevStop.problems || []), problem]
      return {
        ...prevStop,
        problems,
        has_problems: true,
      }
    })
  }

  // Helper function to resolve a problem in the local state
  function resolveLocalProblem(problemId: string) {
    setStop((prevStop) => {
      if (!prevStop.problems) return prevStop

      const updatedProblems = prevStop.problems.map((problem) =>
        problem.id === problemId ? { ...problem, resolved: true } : problem,
      )

      // Check if there are any unresolved problems left
      const hasUnresolvedProblems = updatedProblems.some((problem) => !problem.resolved)

      return {
        ...prevStop,
        problems: updatedProblems,
        has_problems: hasUnresolvedProblems,
      }
    })
  }

  async function handleMarkDelivered() {
    try {
      const result = await markAllProductsDelivered(stop.id)
      if (result.success) {
        // Update all products as delivered
        setStop((prevStop) => {
          if (!prevStop.products) return prevStop

          const updatedProducts = prevStop.products.map((product) => ({
            ...product,
            delivered_quantity: product.quantity,
          }))

          return {
            ...prevStop,
            products: updatedProducts,
            status: "delivered",
            deliveredQuantity: prevStop.totalQuantity,
          }
        })
      }
    } catch (error) {
      console.error("Error marking stop as delivered:", error)
    }
  }

  async function handleMarkSpread() {
    try {
      const result = await markAllProductsSpread(stop.id)
      if (result.success) {
        // Update all products as spread
        setStop((prevStop) => {
          if (!prevStop.products) return prevStop

          const updatedProducts = prevStop.products.map((product) =>
            product.spread_requested ? { ...product, is_spread: true } : product,
          )

          return {
            ...prevStop,
            products: updatedProducts,
            status: "complete",
          }
        })
      }
    } catch (error) {
      console.error("Error marking stop as spread:", error)
    }
  }

  async function handleUpdateProductDelivery(productId, amount) {
    try {
      const deliveredQuantity = Number.parseInt(amount, 10)
      if (isNaN(deliveredQuantity) || deliveredQuantity < 0) return

      const result = await updateProductDeliveryStatus(productId, deliveredQuantity, stop.id)
      if (result.success) {
        // Update the product in local state
        updateLocalProduct(productId, { delivered_quantity: deliveredQuantity })

        // Update the stop status based on delivery status
        updateDeliveryStatus()
      }
    } catch (error) {
      console.error("Error updating product delivery:", error)
    }
  }

  // Helper function to update the stop status based on product delivery status
  function updateDeliveryStatus() {
    setStop((prevStop) => {
      if (!prevStop.products || prevStop.products.length === 0) return prevStop

      const totalQuantity = prevStop.products.reduce((sum, p) => sum + p.quantity, 0)
      const deliveredQuantity = prevStop.products.reduce((sum, p) => sum + (p.delivered_quantity || 0), 0)
      const needsSpread = prevStop.products.some((p) => p.spread_requested)
      const allSpreadComplete = !prevStop.products.some((p) => p.spread_requested && !p.is_spread)
      const allDelivered = totalQuantity === deliveredQuantity

      let status = prevStop.status

      if (deliveredQuantity === 0) {
        status = "pending"
      } else if (deliveredQuantity < totalQuantity) {
        status = "partial"
      } else if (allDelivered && needsSpread && !allSpreadComplete) {
        status = "pending_spread"
      } else if (allDelivered && (!needsSpread || allSpreadComplete)) {
        status = "complete"
      }

      return {
        ...prevStop,
        status,
        deliveredQuantity,
      }
    })
  }

  async function handleMarkProductDelivered(product) {
    try {
      const result = await updateProductDeliveryStatus(product.id, product.quantity, stop.id)
      if (result.success) {
        // Update the product in local state
        updateLocalProduct(product.id, { delivered_quantity: product.quantity })

        // Update the stop status
        updateDeliveryStatus()
      }
    } catch (error) {
      console.error("Error marking product as delivered:", error)
    }
  }

  async function handleMarkProductSpread(productId) {
    try {
      const result = await markProductAsSpread(productId, stop.id)
      if (result.success) {
        // Update the product in local state
        updateLocalProduct(productId, { is_spread: true })

        // Update the stop status
        updateDeliveryStatus()
      }
    } catch (error) {
      console.error("Error marking product as spread:", error)
    }
  }

  async function handlePartialDelivery() {
    const amount = Number.parseInt(partialDeliveryAmount)
    if (isNaN(amount) || amount <= 0 || amount > stop.totalQuantity) return

    try {
      const result = await updateStop({
        id: stop.id,
        status: "partial",
        delivered_quantity: amount,
      })

      if (result.success) {
        updateLocalStop({
          status: "partial",
          deliveredQuantity: amount,
        })
        setPartialDeliveryAmount("")
      }
    } catch (error) {
      console.error("Error updating partial delivery:", error)
    }
  }

  async function handleAddScout() {
    if (!selectedScout) return

    try {
      const result = await assignScoutToStop(stop.id, selectedScout, scoutRole as "drop" | "spread")
      if (result.success) {
        // Add the scout to local state
        addLocalScout(selectedScout, scoutRole as "drop" | "spread")

        setAddScoutDialogOpen(false)
        setSelectedScout("")
      }
    } catch (error) {
      console.error("Error assigning scout to stop:", error)
    }
  }

  async function handleTogglePaid() {
    try {
      const newPaidStatus = !stop.paid
      const result = await updateStop({
        id: stop.id,
        paid: newPaidStatus,
      })

      if (result.success) {
        updateLocalStop({ paid: newPaidStatus })
      }
    } catch (error) {
      console.error("Error toggling paid status:", error)
    }
  }

  async function handleAddProblem() {
    if (!problemDescription) return

    try {
      const result = await createProblem({
        stop_id: stop.id,
        description: problemDescription,
        resolved: false,
      })

      if (result.success && result.problem) {
        // Add the problem to local state
        addLocalProblem(result.problem)

        setProblemDialogOpen(false)
        setProblemDescription("")
      }
    } catch (error) {
      console.error("Error adding problem:", error)
    }
  }

  async function handleResolveProblem(problemId: string) {
    try {
      const result = await resolveProblem(problemId)
      if (result.success) {
        // Update the problem in local state
        resolveLocalProblem(problemId)
      }
    } catch (error) {
      console.error("Error resolving problem:", error)
    }
  }

  async function handleAddProduct() {
    if (!newProduct.productId || !newProduct.quantity) return

    try {
      const result = await addProductToStop({
        stop_id: stop.id,
        product_id: newProduct.productId,
        quantity: Number.parseInt(newProduct.quantity),
        spread_requested: newProduct.spreadRequested,
      })

      if (result.success && result.product) {
        // Add the product to local state
        const productDetails = products.find((p) => p.id === newProduct.productId)
        const newStopProduct = {
          ...result.product,
          product: productDetails,
        }

        addLocalProduct(newStopProduct)

        setAddProductDialogOpen(false)
        setNewProduct({
          productId: "",
          quantity: "1",
          spreadRequested: false,
        })
      }
    } catch (error) {
      console.error("Error adding product to stop:", error)
    }
  }

  async function handleUpdateProduct(stopProductId: string, field: string, value: any) {
    try {
      const result = await updateStopProduct({
        id: stopProductId,
        [field]: value,
      })

      if (result.success) {
        // Update the product in local state
        updateLocalProduct(stopProductId, { [field]: value })
      }
    } catch (error) {
      console.error("Error updating product:", error)
    }
  }

  async function handleRemoveProduct(stopProductId: string) {
    try {
      const result = await removeProductFromStop(stopProductId)
      if (result.success) {
        // Remove the product from local state
        removeLocalProduct(stopProductId)
      }
    } catch (error) {
      console.error("Error removing product:", error)
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

  // Helper function to find scout ID by name
  function findScoutId(scoutName) {
    const scout = scouts.find((s) => s.name === scoutName)
    return scout ? scout.id : null
  }

  // Check if there are any scouts with drop or spread roles
  const hasDropScouts = stop.assignedScouts?.some((name) => stop.scoutRoles[name]?.includes("drop")) || false
  const hasSpreadScouts = stop.assignedScouts?.some((name) => stop.scoutRoles[name]?.includes("spread")) || false

  if (loading) {
    return <div className="text-center py-8">Loading stop details...</div>
  }

  // Calculate overall delivery progress
  const totalQuantity = stop.totalQuantity || 0
  const deliveredQuantity = stop.deliveredQuantity || 0
  const deliveryProgress = totalQuantity > 0 ? Math.round((deliveredQuantity / totalQuantity) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold">Stop Details</h2>
      </div>

      <Card className={stop.has_problems ? "border-red-200" : ""}>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle>{stop.customer_name}</CardTitle>
            <div className="flex gap-1">
              {stop.has_problems && (
                <Badge variant="destructive">
                  <AlertCircleIcon className="h-3 w-3 mr-1" />
                  Problem
                </Badge>
              )}
              {getStatusBadge(stop.status)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center">
              <MapPinIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {stop.address}
              </a>
            </div>

            <div className="flex items-center">
              <PhoneIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              <a href={`tel:${stop.phone}`} className="underline">
                {stop.phone}
              </a>
            </div>

            {stop.assigned_truck_id && (
              <div className="flex items-center">
                <TruckIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>Assigned to: {stop.assignedTruck?.driver_name || "Unknown Driver"}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Delivery Progress</span>
              <span>{deliveryProgress}%</span>
            </div>
            <Progress value={deliveryProgress} className="h-2" />
          </div>

          <Separator />

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Products</h3>
              <Button variant="outline" size="sm" onClick={() => setAddProductDialogOpen(true)}>
                <PlusIcon className="h-3 w-3 mr-1" />
                Add Product
              </Button>
            </div>

            {stop.products && stop.products.length > 0 ? (
              <div className="space-y-4">
                {stop.products.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">
                            {formatProductName(product.product?.name || "")}
                            {product.spread_requested && (
                              <Badge variant="outline" className="ml-1">
                                Spread
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">Quantity: {product.quantity}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          {product.delivered_quantity >= product.quantity && (
                            <Badge className="ml-auto">
                              <CheckIcon className="h-3 w-3 mr-1" />
                              Delivered
                            </Badge>
                          )}
                          {product.spread_requested && product.is_spread && (
                            <Badge variant="secondary" className="ml-auto">
                              <CheckIcon className="h-3 w-3 mr-1" />
                              Spread
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Delivered</span>
                            <span>
                              {product.delivered_quantity || 0} of {product.quantity}
                            </span>
                          </div>
                          <Progress
                            value={
                              product.quantity > 0 ? ((product.delivered_quantity || 0) / product.quantity) * 100 : 0
                            }
                            className="h-2"
                          />
                        </div>

                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label htmlFor={`delivery-amount-${product.id}`} className="text-xs">
                              Delivered amount
                            </Label>
                            <Input
                              id={`delivery-amount-${product.id}`}
                              type="number"
                              placeholder="Items delivered"
                              value={productDeliveryAmounts[product.id] || "0"}
                              onChange={(e) =>
                                setProductDeliveryAmounts({
                                  ...productDeliveryAmounts,
                                  [product.id]: e.target.value,
                                })
                              }
                              min="0"
                              max={product.quantity}
                            />
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleUpdateProductDelivery(product.id, productDeliveryAmounts[product.id])}
                          >
                            Update
                          </Button>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleMarkProductDelivered(product)}
                            disabled={product.delivered_quantity >= product.quantity}
                          >
                            <CheckIcon className="h-3 w-3 mr-1" />
                            Mark Delivered
                          </Button>

                          {product.spread_requested && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleMarkProductSpread(product.id)}
                              disabled={
                                !product.delivered_quantity ||
                                product.delivered_quantity < product.quantity ||
                                product.is_spread
                              }
                            >
                              <CheckIcon className="h-3 w-3 mr-1" />
                              Mark Spread
                            </Button>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveProduct(product.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">No products added yet</p>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-1">Delivery Status</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span>
                    {stop.status === "pending"
                      ? "Pending"
                      : stop.status === "partial"
                        ? "Partially Delivered"
                        : stop.status === "pending_spread"
                          ? "Pending Spread"
                          : stop.status === "complete"
                            ? "Complete"
                            : "Delivered"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivered:</span>
                  <span>
                    {stop.deliveredQuantity || 0} of {stop.totalQuantity} items
                  </span>
                </div>
                {stop.assigned_truck_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Truck:</span>
                    <span>{stop.assignedTruck?.driver_name || "Unknown Driver"}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-1">Payment</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span>{stop.paid ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Items:</span>
                  <span>{stop.totalQuantity}</span>
                </div>
              </div>
            </div>
          </div>

          {stop.instructions && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-1">Instructions</h3>
                <p className="text-sm">{stop.instructions}</p>
              </div>
            </>
          )}
          {stop.problems && stop.problems.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-medium mb-1">Problems</h3>
                <ul className="text-sm space-y-2">
                  {stop.problems.map((problem) => (
                    <li key={problem.id} className="flex justify-between items-start">
                      <div className={problem.resolved ? "text-muted-foreground line-through" : ""}>
                        {problem.description}
                      </div>
                      {!problem.resolved && (
                        <Button variant="outline" size="sm" onClick={() => handleResolveProblem(problem.id)}>
                          Resolve
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="font-medium">Actions</h3>

        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Delivery Actions</h4>

              <div className="space-y-2">
                <Button
                  className="w-full"
                  onClick={handleMarkDelivered}
                  disabled={stop.status === "complete" || stop.status === "pending_spread"}
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Mark All Delivered
                </Button>

                {stop.products && stop.products.some((p) => p.spread_requested) && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={handleMarkSpread}
                    disabled={stop.status !== "pending_spread" && stop.status !== "delivered"}
                  >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Mark All Spread
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Stop Settings</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="paid-switch" className="text-sm">
                    Mark as Paid
                  </Label>
                  <Switch id="paid-switch" checked={stop.paid} onCheckedChange={handleTogglePaid} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Dialog open={addScoutDialogOpen} onOpenChange={setAddScoutDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <UserIcon className="h-4 w-4 mr-2" />
                Add Scout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Scout to Stop</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Scout</Label>
                  <Select value={selectedScout} onValueChange={setSelectedScout}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a scout" />
                    </SelectTrigger>
                    <SelectContent>
                      {scouts.map((scout) => (
                        <SelectItem key={scout.id} value={scout.id}>
                          {scout.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={scoutRole} onValueChange={setScoutRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drop">Drop</SelectItem>
                      <SelectItem value="spread">Spread</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddScoutDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddScout}>Add Scout</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {stop.assigned_truck_id && (
            <Dialog open={assignTruckScoutsDialogOpen} onOpenChange={setAssignTruckScoutsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <TruckIcon className="h-4 w-4 mr-2" />
                  Assign Truck Scouts
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Truck Scouts to Stop</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Assign all scouts from {stop.assignedTruck?.driver_name}'s truck to this stop.
                  </p>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="assign-drop"
                        checked={truckScoutRoles.drop}
                        onCheckedChange={(checked) =>
                          setTruckScoutRoles((prev) => ({ ...prev, drop: checked === true }))
                        }
                      />
                      <Label htmlFor="assign-drop">Assign as Drop Scouts</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="assign-spread"
                        checked={truckScoutRoles.spread}
                        onCheckedChange={(checked) =>
                          setTruckScoutRoles((prev) => ({ ...prev, spread: checked === true }))
                        }
                      />
                      <Label htmlFor="assign-spread">Assign as Spread Scouts</Label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAssignTruckScoutsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAssignTruckScouts}
                      disabled={!truckScoutRoles.drop && !truckScoutRoles.spread}
                    >
                      Assign Scouts
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card className="col-span-2 mt-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assigned Scouts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Drop Role Column */}
              <div>
                <h4 className="text-sm font-medium mb-2">Drop</h4>
                {hasDropScouts ? (
                  <ul className="space-y-2">
                    {stop.assignedScouts
                      .filter((scoutName) => stop.scoutRoles[scoutName]?.includes("drop"))
                      .map((scoutName) => (
                        <li
                          key={`drop-${stop.id}-${scoutName}`}
                          className="flex justify-between items-center text-sm bg-muted p-2 rounded-md"
                        >
                          <span>{scoutName}</span>
                          <div className="flex gap-1">
                            {!stop.scoutRoles[scoutName]?.includes("spread") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  const scoutId = findScoutId(scoutName)
                                  if (scoutId) {
                                    assignScoutToStop(stop.id, scoutId, "spread").then(() => {
                                      addLocalScout(scoutId, "spread")
                                    })
                                  }
                                }}
                                title="Assign to Spread (in addition to Drop)"
                              >
                                <ArrowRightIcon className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => {
                                const scoutId = findScoutId(scoutName)
                                if (scoutId) {
                                  removeScoutFromStop(stop.id, scoutId, "drop").then(() => {
                                    removeLocalScoutRole(scoutName, "drop")
                                  })
                                }
                              }}
                              title="Remove from Drop"
                            >
                              <XCircleIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">No drop scouts assigned</div>
                )}
              </div>

              {/* Spread Role Column */}
              <div>
                <h4 className="text-sm font-medium mb-2">Spread</h4>
                {hasSpreadScouts ? (
                  <ul className="space-y-2">
                    {stop.assignedScouts
                      .filter((scoutName) => stop.scoutRoles[scoutName]?.includes("spread"))
                      .map((scoutName) => (
                        <li
                          key={`spread-${stop.id}-${scoutName}`}
                          className="flex justify-between items-center text-sm bg-muted p-2 rounded-md"
                        >
                          <span>{scoutName}</span>
                          <div className="flex gap-1">
                            {!stop.scoutRoles[scoutName]?.includes("drop") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  const scoutId = findScoutId(scoutName)
                                  if (scoutId) {
                                    assignScoutToStop(stop.id, scoutId, "drop").then(() => {
                                      addLocalScout(scoutId, "drop")
                                    })
                                  }
                                }}
                                title="Assign to Drop (in addition to Spread)"
                              >
                                <ArrowLeftIcon className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() => {
                                const scoutId = findScoutId(scoutName)
                                if (scoutId) {
                                  removeScoutFromStop(stop.id, scoutId, "spread").then(() => {
                                    removeLocalScoutRole(scoutName, "spread")
                                  })
                                }
                              }}
                              title="Remove from Spread"
                            >
                              <XCircleIcon className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-2">No spread scouts assigned</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={problemDialogOpen} onOpenChange={setProblemDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <AlertCircleIcon className="h-4 w-4 mr-2" />
              Report Problem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report a Problem</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Problem Description</Label>
                <Textarea
                  placeholder="Describe the issue..."
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setProblemDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleAddProblem}>
                  Report Problem
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product to Stop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Product</Label>
              <Select
                value={newProduct.productId}
                onValueChange={(value) => setNewProduct({ ...newProduct, productId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                value={newProduct.quantity}
                onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                placeholder="Enter quantity"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="spread-requested"
                checked={newProduct.spreadRequested}
                onCheckedChange={(checked) => setNewProduct({ ...newProduct, spreadRequested: checked === true })}
              />
              <Label htmlFor="spread-requested">Spread Requested</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddProductDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddProduct}>Add Product</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
