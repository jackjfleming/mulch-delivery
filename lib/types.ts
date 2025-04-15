export interface Route {
  id: string
  name: string
  created_at?: string
  updated_at?: string
  // Derived properties
  assignedTrucks?: Truck[]
  stops?: Stop[]
}

export interface Truck {
  id: string
  driver_name: string
  capacity: number
  phone?: string
  active: boolean
  created_at?: string
  updated_at?: string
  // Derived properties
  currentStops?: Stop[]
  completedStops?: Stop[]
  assignedScouts?: Scout[] // New property
}

export interface Scout {
  id: string
  name: string
  created_at?: string
}

export interface Product {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export interface StopProduct {
  id: string
  stop_id: string
  product_id: string
  quantity: number
  spread_requested: boolean
  delivered_quantity: number
  is_spread: boolean
  created_at?: string
  updated_at?: string
  // Derived properties
  product?: Product
}

export interface Stop {
  id: string
  route_id: string
  customer_name: string
  address: string
  phone?: string
  paid: boolean
  status: "pending" | "partial" | "delivered" | "pending_spread" | "complete"
  delivered_quantity?: number
  assigned_truck_id?: string
  instructions?: string
  has_problems: boolean
  created_at?: string
  updated_at?: string
  // Derived properties
  assignedTruck?: Truck
  assignedScouts?: string[]
  scoutRoles?: Record<string, string[]>
  problems?: Problem[]
  products?: StopProduct[]
  // Calculated properties
  totalQuantity?: number
  deliveredQuantity?: number
}

export interface Problem {
  id: string
  stop_id: string
  description: string
  resolved: boolean
  created_at?: string
  updated_at?: string
}

export interface StopScout {
  stop_id: string
  scout_id: string
  role: "drop" | "spread"
}

export interface RouteTruck {
  route_id: string
  truck_id: string
}

export interface TruckScout {
  truck_id: string
  scout_id: string
}
