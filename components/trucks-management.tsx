"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TruckIcon, PlusIcon, EditIcon } from "lucide-react"
import type { Truck } from "@/lib/types"
import { createTruck, updateTruck, getTrucks } from "@/lib/actions"
import TruckDetails from "@/components/truck-details"

export default function TrucksManagement() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null)
  const [newTruck, setNewTruck] = useState({
    driverName: "",
    capacity: "",
    phone: "",
  })
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [viewStopsDialogOpen, setViewStopsDialogOpen] = useState(false)

  useEffect(() => {
    fetchTrucks()
  }, [])

  async function fetchTrucks() {
    try {
      setLoading(true)
      const trucksData = await getTrucks()
      console.log("Trucks data:", trucksData)
      setTrucks(trucksData || [])
    } catch (error) {
      console.error("Error fetching trucks:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddTruck() {
    if (!newTruck.driverName || !newTruck.capacity) return

    try {
      await createTruck({
        driver_name: newTruck.driverName,
        capacity: Number.parseInt(newTruck.capacity),
        phone: newTruck.phone,
        active: true,
      })

      setNewTruck({
        driverName: "",
        capacity: "",
        phone: "",
      })

      setAddDialogOpen(false)
      fetchTrucks()
    } catch (error) {
      console.error("Error adding truck:", error)
    }
  }

  async function handleUpdateTruck() {
    if (!editingTruck || !editingTruck.driver_name || !editingTruck.capacity) return

    try {
      await updateTruck({
        id: editingTruck.id,
        driver_name: editingTruck.driver_name,
        capacity: editingTruck.capacity,
        phone: editingTruck.phone,
      })

      setEditingTruck(null)
      setEditDialogOpen(false)
      fetchTrucks()
    } catch (error) {
      console.error("Error updating truck:", error)
    }
  }

  async function handleToggleTruckActive(truck: Truck) {
    try {
      await updateTruck({
        id: truck.id,
        active: !truck.active,
      })

      fetchTrucks()
    } catch (error) {
      console.error("Error toggling truck active status:", error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading trucks...</div>
  }

  if (selectedTruck) {
    return (
      <TruckDetails
        truck={selectedTruck}
        onBack={() => {
          setSelectedTruck(null)
          fetchTrucks()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Trucks</h2>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Truck
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Truck</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="driver-name">Driver Name</Label>
                <Input
                  id="driver-name"
                  value={newTruck.driverName}
                  onChange={(e) => setNewTruck({ ...newTruck, driverName: e.target.value })}
                  placeholder="Enter driver name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (bags)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={newTruck.capacity}
                  onChange={(e) => setNewTruck({ ...newTruck, capacity: e.target.value })}
                  placeholder="Enter capacity in bags"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={newTruck.phone}
                  onChange={(e) => setNewTruck({ ...newTruck, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleAddTruck}>Add Truck</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {trucks.length === 0 ? (
        <div className="text-center py-8 bg-muted rounded-lg">
          <p className="text-muted-foreground mb-4">No trucks found</p>
          <Button variant="outline" onClick={() => setAddDialogOpen(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Your First Truck
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {trucks.map((truck) => (
            <Card key={truck.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <TruckIcon className="h-4 w-4 mr-2" />
                      {truck.driver_name}
                    </CardTitle>
                    <CardDescription>
                      {truck.phone && (
                        <a href={`tel:${truck.phone}`} className="underline">
                          {truck.phone}
                        </a>
                      )}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={truck.active ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleToggleTruckActive(truck)}
                  >
                    {truck.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pb-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Capacity</div>
                    <div className="font-medium">{truck.capacity} bags</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Current Stops</div>
                    <div className="font-medium">{truck.currentStops?.length || 0}</div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedTruck(truck)}>
                  Manage Stops
                </Button>

                <Dialog
                  open={editDialogOpen}
                  onOpenChange={(open) => {
                    setEditDialogOpen(open)
                    if (open) setEditingTruck(truck)
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <EditIcon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Truck</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-driver-name">Driver Name</Label>
                        <Input
                          id="edit-driver-name"
                          value={editingTruck?.driver_name || ""}
                          onChange={(e) =>
                            setEditingTruck(
                              editingTruck
                                ? {
                                    ...editingTruck,
                                    driver_name: e.target.value,
                                  }
                                : null,
                            )
                          }
                          placeholder="Enter driver name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-capacity">Capacity (bags)</Label>
                        <Input
                          id="edit-capacity"
                          type="number"
                          value={editingTruck?.capacity || ""}
                          onChange={(e) =>
                            setEditingTruck(
                              editingTruck
                                ? {
                                    ...editingTruck,
                                    capacity: Number.parseInt(e.target.value),
                                  }
                                : null,
                            )
                          }
                          placeholder="Enter capacity in bags"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-phone">Phone Number</Label>
                        <Input
                          id="edit-phone"
                          value={editingTruck?.phone || ""}
                          onChange={(e) =>
                            setEditingTruck(
                              editingTruck
                                ? {
                                    ...editingTruck,
                                    phone: e.target.value,
                                  }
                                : null,
                            )
                          }
                          placeholder="Enter phone number"
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={handleUpdateTruck}>Update Truck</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
