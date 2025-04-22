"use server"

import { createServerClient } from "@/lib/supabase"
import type { Route, Truck, Stop, Problem, StopProduct } from "@/lib/types"
import { revalidatePath } from "next/cache"

// Products
export async function getProducts() {
  try {
    const supabase = createServerClient()

    console.log("Fetching products...")
    const { data, error } = await supabase.from("products").select("*").order("name")

    if (error) {
      console.error("Error fetching products:", error)
      throw new Error(`Failed to fetch products: ${error.message}`)
    }

    console.log(`Found ${data.length} products`)
    return data
  } catch (error) {
    console.error("Error in getProducts:", error)
    return []
  }
}

// Example of updating the addProductToStop function to return the created product
export async function addProductToStop(
  stopProduct: Omit<StopProduct, "id" | "created_at" | "updated_at" | "delivered_quantity" | "is_spread">,
) {
  try {
    const supabase = createServerClient()

    // Initialize with delivered_quantity = 0 and is_spread = false
    const productToAdd = {
      ...stopProduct,
      delivered_quantity: 0,
      is_spread: false,
    }

    console.log(`Adding product ${stopProduct.product_id} to stop ${stopProduct.stop_id}...`)
    const { data, error } = await supabase.from("stop_products").insert([productToAdd]).select()

    if (error) {
      console.error("Error adding product to stop:", error)
      throw new Error(`Failed to add product to stop: ${error.message}`)
    }

    revalidatePath(`/routes`)
    return { success: true, product: data?.[0] }
  } catch (error) {
    console.error("Error in addProductToStop:", error)
    return { success: false }
  }
}

export async function updateStopProduct(stopProduct: Partial<StopProduct>) {
  try {
    const supabase = createServerClient()

    console.log(`Updating stop product ${stopProduct.id}...`)
    const { error } = await supabase.from("stop_products").update(stopProduct).eq("id", stopProduct.id)

    if (error) {
      console.error("Error updating stop product:", error)
      throw new Error(`Failed to update stop product: ${error.message}`)
    }

    // After updating the product, update the stop status
    if (stopProduct.stop_id) {
      await updateStopStatusBasedOnProducts(stopProduct.stop_id)
    }

    revalidatePath(`/routes`)
    return { success: true }
  } catch (error) {
    console.error("Error in updateStopProduct:", error)
    return { success: false }
  }
}

export async function updateProductDeliveryStatus(stopProductId: string, deliveredQuantity: number, stopId: string) {
  try {
    const supabase = createServerClient()

    console.log(`Updating delivery status for product ${stopProductId}...`)
    const { error } = await supabase
      .from("stop_products")
      .update({ delivered_quantity: deliveredQuantity })
      .eq("id", stopProductId)

    if (error) {
      console.error("Error updating product delivery status:", error)
      throw new Error(`Failed to update product delivery status: ${error.message}`)
    }

    // Update the stop status based on all products
    await updateStopStatusBasedOnProducts(stopId)

    revalidatePath(`/routes`)
    return { success: true }
  } catch (error) {
    console.error("Error in updateProductDeliveryStatus:", error)
    return { success: false }
  }
}

export async function markProductAsSpread(stopProductId: string, stopId: string) {
  try {
    const supabase = createServerClient()

    console.log(`Marking product ${stopProductId} as spread...`)
    const { error } = await supabase.from("stop_products").update({ is_spread: true }).eq("id", stopProductId)

    if (error) {
      console.error("Error marking product as spread:", error)
      throw new Error(`Failed to mark product as spread: ${error.message}`)
    }

    // Update the stop status based on all products
    await updateStopStatusBasedOnProducts(stopId)

    revalidatePath(`/routes`)
    return { success: true }
  } catch (error) {
    console.error("Error in markProductAsSpread:", error)
    return { success: false }
  }
}

export async function markAllProductsDelivered(stopId: string) {
  try {
    const supabase = createServerClient()

    // First, get all products for this stop
    const { data: products, error: fetchError } = await supabase
      .from("stop_products")
      .select("id, quantity")
      .eq("stop_id", stopId)

    if (fetchError) {
      console.error("Error fetching stop products:", fetchError)
      throw new Error(`Failed to fetch stop products: ${fetchError.message}`)
    }

    // Update each product to mark it as fully delivered
    for (const product of products) {
      const { error } = await supabase
        .from("stop_products")
        .update({ delivered_quantity: product.quantity })
        .eq("id", product.id)

      if (error) {
        console.error(`Error marking product ${product.id} as delivered:`, error)
        throw new Error(`Failed to mark product as delivered: ${error.message}`)
      }
    }

    // Update the stop status
    await updateStopStatusBasedOnProducts(stopId)

    revalidatePath(`/routes`)
    return { success: true }
  } catch (error) {
    console.error("Error in markAllProductsDelivered:", error)
    return { success: false }
  }
}

export async function markAllProductsSpread(stopId: string) {
  try {
    const supabase = createServerClient()

    // First, get all products for this stop that need spreading
    const { data: products, error: fetchError } = await supabase
      .from("stop_products")
      .select("id")
      .eq("stop_id", stopId)
      .eq("spread_requested", true)

    if (fetchError) {
      console.error("Error fetching stop products:", fetchError)
      throw new Error(`Failed to fetch stop products: ${fetchError.message}`)
    }

    // Update each product to mark it as spread
    for (const product of products) {
      const { error } = await supabase.from("stop_products").update({ is_spread: true }).eq("id", product.id)

      if (error) {
        console.error(`Error marking product ${product.id} as spread:`, error)
        throw new Error(`Failed to mark product as spread: ${error.message}`)
      }
    }

    // Update the stop status
    await updateStopStatusBasedOnProducts(stopId)

    revalidatePath(`/routes`)
    return { success: true }
  } catch (error) {
    console.error("Error in markAllProductsSpread:", error)
    return { success: false }
  }
}

// Helper function to update stop status based on product delivery status
async function updateStopStatusBasedOnProducts(stopId: string) {
  try {
    const supabase = createServerClient()

    // Get all products for this stop
    const { data: products, error: fetchError } = await supabase
      .from("stop_products")
      .select("quantity, delivered_quantity, spread_requested, is_spread")
      .eq("stop_id", stopId)

    if (fetchError) {
      console.error("Error fetching stop products:", fetchError)
      throw new Error(`Failed to fetch stop products: ${fetchError.message}`)
    }

    if (!products || products.length === 0) {
      return
    }

    // Calculate totals
    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0)
    const deliveredQuantity = products.reduce((sum, p) => sum + (p.delivered_quantity || 0), 0)
    const needsSpread = products.some((p) => p.spread_requested)
    const allSpreadComplete = !products.some((p) => p.spread_requested && !p.is_spread)
    const allDelivered = totalQuantity === deliveredQuantity

    // Determine status
    let status = "pending"

    if (deliveredQuantity === 0) {
      status = "pending"
    } else if (deliveredQuantity < totalQuantity) {
      status = "partial"
    } else if (allDelivered && needsSpread && !allSpreadComplete) {
      status = "pending_spread"
    } else if (allDelivered && (!needsSpread || allSpreadComplete)) {
      status = "complete"
    }

    // Update the stop status
    const { error } = await supabase
      .from("stops")
      .update({
        status,
        delivered_quantity: deliveredQuantity,
      })
      .eq("id", stopId)

    if (error) {
      console.error("Error updating stop status:", error)
      throw new Error(`Failed to update stop status: ${error.message}`)
    }
  } catch (error) {
    console.error("Error in updateStopStatusBasedOnProducts:", error)
  }
}

export async function removeProductFromStop(stopProductId: string) {
  try {
    const supabase = createServerClient()

    // First get the stop_id for this product
    const { data: product, error: fetchError } = await supabase
      .from("stop_products")
      .select("stop_id")
      .eq("id", stopProductId)
      .single()

    if (fetchError) {
      console.error("Error fetching stop product:", fetchError)
      throw new Error(`Failed to fetch stop product: ${fetchError.message}`)
    }

    const stopId = product.stop_id

    console.log(`Removing stop product ${stopProductId}...`)
    const { error } = await supabase.from("stop_products").delete().eq("id", stopProductId)

    if (error) {
      console.error("Error removing product from stop:", error)
      throw new Error(`Failed to remove product from stop: ${error.message}`)
    }

    // Update the stop status
    await updateStopStatusBasedOnProducts(stopId)

    revalidatePath(`/routes`)
    return { success: true }
  } catch (error) {
    console.error("Error in removeProductFromStop:", error)
    return { success: false }
  }
}

// Routes
export async function getRoutes() {
  try {
    const supabase = createServerClient()

    console.log("Fetching routes...")

    // Check if we have a valid Supabase client
    if (!supabase) {
      console.error("Supabase client not initialized - missing environment variables")
      return []
    }

    const { data: routes, error } = await supabase.from("routes").select("*").order("name")

    if (error) {
      console.error("Error fetching routes:", error)
      throw new Error(`Failed to fetch routes: ${error.message}`)
    }

    console.log(`Found ${routes.length} routes`)

    // Get all stops for these routes
    const { data: stops, error: stopsError } = await supabase
      .from("stops")
      .select("*")
      .in(
        "route_id",
        routes.map((route) => route.id),
      )

    if (stopsError && routes.length > 0) {
      console.error("Error fetching stops:", stopsError)
      throw new Error(`Failed to fetch stops: ${stopsError.message}`)
    }

    // Get all stop products
    const stopIds = stops?.map((stop) => stop.id) || []
    let stopProducts = []
    let products = []

    if (stopIds.length > 0) {
      const { data: stopProductsData, error: spError } = await supabase
        .from("stop_products")
        .select("*")
        .in("stop_id", stopIds)

      if (spError) {
        console.error("Error fetching stop products:", spError)
        throw new Error(`Failed to fetch stop products: ${spError.message}`)
      }

      stopProducts = stopProductsData || []

      // Get all products
      const { data: productsData, error: productsError } = await supabase.from("products").select("*")

      if (productsError) {
        console.error("Error fetching products:", productsError)
        throw new Error(`Failed to fetch products: ${productsError.message}`)
      }

      products = productsData || []
    }

    // Get all route-truck assignments
    const { data: routeTrucks, error: rtError } = await supabase
      .from("route_trucks")
      .select("*")
      .in(
        "route_id",
        routes.map((route) => route.id),
      )

    if (rtError && routes.length > 0) {
      console.error("Error fetching route trucks:", rtError)
      throw new Error(`Failed to fetch route trucks: ${rtError.message}`)
    }

    // Get all trucks
    const { data: trucks, error: trucksError } = await supabase.from("trucks").select("*")

    if (trucksError) {
      console.error("Error fetching trucks:", trucksError)
      throw new Error(`Failed to fetch trucks: ${trucksError.message}`)
    }

    // Combine the data
    const routesWithRelations = routes.map((route) => {
      const routeStops = stops?.filter((stop) => stop.route_id === route.id) || []

      // Add products to stops
      const stopsWithProducts = routeStops.map((stop) => {
        const stopProductsList = stopProducts.filter((sp) => sp.stop_id === stop.id) || []

        // Add product details to each stop product
        const stopProductsWithDetails = stopProductsList.map((sp) => {
          const product = products.find((p) => p.id === sp.product_id)
          return { ...sp, product }
        })

        // Calculate total quantity
        const totalQuantity = stopProductsList.reduce((sum, sp) => sum + sp.quantity, 0)
        const deliveredQuantity = stopProductsList.reduce((sum, sp) => sum + (sp.delivered_quantity || 0), 0)

        return {
          ...stop,
          products: stopProductsWithDetails,
          totalQuantity,
          deliveredQuantity,
        }
      })

      const routeTruckIds = routeTrucks?.filter((rt) => rt.route_id === route.id).map((rt) => rt.truck_id) || []
      const assignedTrucks = trucks?.filter((truck) => routeTruckIds.includes(truck.id)) || []

      return {
        ...route,
        stops: stopsWithProducts,
        assignedTrucks,
      }
    })

    return routesWithRelations
  } catch (error) {
    console.error("Error in getRoutes:", error)
    return []
  }
}

// Get a single route with all its details
export async function getRouteDetails(routeId: string) {
  try {
    const supabase = createServerClient()

    console.log(`Fetching route details for ID: ${routeId}`)

    // Get the route
    const { data: route, error: routeError } = await supabase.from("routes").select("*").eq("id", routeId).maybeSingle()

    if (routeError) {
      console.error("Error fetching route:", routeError)
      throw new Error(`Failed to fetch route: ${routeError.message}`)
    }

    if (!route) {
      console.error("Route not found:", routeId)
      return null
    }

    // Get all stops for this route
    const { data: stops, error: stopsError } = await supabase.from("stops").select("*").eq("route_id", routeId)

    if (stopsError) {
      console.error("Error fetching stops:", stopsError)
      throw new Error(`Failed to fetch stops: ${stopsError.message}`)
    }

    const stopsArray = stops || []

    // Get all products
    const { data: products, error: productsError } = await supabase.from("products").select("*")

    if (productsError) {
      console.error("Error fetching products:", productsError)
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    // Get all stop products
    let stopProducts = []
    if (stopsArray.length > 0) {
      const { data: stopProductsData, error: spError } = await supabase
        .from("stop_products")
        .select("*")
        .in(
          "stop_id",
          stopsArray.map((stop) => stop.id),
        )

      if (spError) {
        console.error("Error fetching stop products:", spError)
        throw new Error(`Failed to fetch stop products: ${spError.message}`)
      }

      stopProducts = stopProductsData || []
    }

    // Get all problems for these stops
    let problems = []
    if (stopsArray.length > 0) {
      const { data: problemsData, error: problemsError } = await supabase
        .from("problems")
        .select("*")
        .in(
          "stop_id",
          stopsArray.map((stop) => stop.id),
        )

      if (problemsError) {
        console.error("Error fetching problems:", problemsError)
        throw new Error(`Failed to fetch problems: ${problemsError.message}`)
      }

      problems = problemsData || []
    }

    // Get all stop-scout assignments
    let stopScouts = []
    if (stopsArray.length > 0) {
      const { data: stopScoutsData, error: ssError } = await supabase
        .from("stop_scouts")
        .select("*")
        .in(
          "stop_id",
          stopsArray.map((stop) => stop.id),
        )

      if (ssError) {
        console.error("Error fetching stop scouts:", ssError)
        throw new Error(`Failed to fetch stop scouts: ${ssError.message}`)
      }

      stopScouts = stopScoutsData || []
    }

    // Get all scouts
    const { data: scouts, error: scoutsError } = await supabase.from("scouts").select("*")

    if (scoutsError) {
      console.error("Error fetching scouts:", scoutsError)
      throw new Error(`Failed to fetch scouts: ${scoutsError.message}`)
    }

    // Get all route-truck assignments
    const { data: routeTrucks, error: rtError } = await supabase
      .from("route_trucks")
      .select("*")
      .eq("route_id", routeId)

    if (rtError) {
      console.error("Error fetching route trucks:", rtError)
      throw new Error(`Failed to fetch route trucks: ${rtError.message}`)
    }

    // Get all trucks
    const { data: trucks, error: trucksError } = await supabase.from("trucks").select("*")

    if (trucksError) {
      console.error("Error fetching trucks:", trucksError)
      throw new Error(`Failed to fetch trucks: ${trucksError.message}`)
    }

    // Combine the data
    const stopsWithRelations = stopsArray.map((stop) => {
      const stopProblems = problems.filter((problem) => problem.stop_id === stop.id) || []
      const stopScoutAssignments = stopScouts.filter((ss) => ss.stop_id === stop.id) || []
      const assignedScouts = scouts
        .filter((scout) => stopScoutAssignments.some((ss) => ss.scout_id === scout.id))
        .map((scout) => scout.name)

      const scoutRoles = stopScoutAssignments.reduce(
        (acc, ss) => {
          const scout = scouts.find((s) => s.id === ss.scout_id)
          if (scout) {
            if (!acc[scout.name]) {
              acc[scout.name] = []
            }
            if (!acc[scout.name].includes(ss.role)) {
              acc[scout.name].push(ss.role)
            }
          }
          return acc
        },
        {} as Record<string, string[]>,
      )

      const assignedTruck = trucks.find((truck) => truck.id === stop.assigned_truck_id)

      // Add products to stop
      const stopProductsList = stopProducts.filter((sp) => sp.stop_id === stop.id) || []

      // Add product details to each stop product
      const stopProductsWithDetails = stopProductsList.map((sp) => {
        const product = products.find((p) => p.id === sp.product_id)
        return { ...sp, product }
      })

      // Calculate total quantity
      const totalQuantity = stopProductsList.reduce((sum, sp) => sum + sp.quantity, 0)

      return {
        ...stop,
        problems: stopProblems,
        assignedScouts,
        scoutRoles,
        assignedTruck,
        products: stopProductsWithDetails,
        totalQuantity,
      }
    })

    const assignedTrucks = trucks.filter((truck) => routeTrucks.some((rt) => rt.truck_id === truck.id))

    return {
      ...route,
      stops: stopsWithRelations,
      assignedTrucks,
    }
  } catch (error) {
    console.error("Error in getRouteDetails:", error)
    return null
  }
}

// Trucks
export async function getTrucks() {
  try {
    const supabase = createServerClient()

    console.log("Fetching trucks...")
    const { data, error } = await supabase.from("trucks").select("*").order("driver_name")

    if (error) {
      console.error("Error fetching trucks:", error)
      throw new Error(`Failed to fetch trucks: ${error.message}`)
    }

    console.log(`Found ${data.length} trucks`)

    // Get all stops to determine current and completed stops
    const { data: stops, error: stopsError } = await supabase.from("stops").select("*")

    if (stopsError) {
      console.error("Error fetching stops:", stopsError)
      throw new Error(`Failed to fetch stops: ${stopsError.message}`)
    }

    // Combine the data
    const trucksWithStops = data.map((truck) => {
      const truckStops = stops?.filter((stop) => stop.assigned_truck_id === truck.id) || []
      const currentStops = truckStops.filter((stop) => stop.status !== "delivered")
      const completedStops = truckStops.filter((stop) => stop.status === "delivered")

      return {
        ...truck,
        currentStops,
        completedStops,
      }
    })

    return trucksWithStops
  } catch (error) {
    console.error("Error in getTrucks:", error)
    return []
  }
}

// Scouts
export async function getScouts() {
  try {
    const supabase = createServerClient()

    console.log("Fetching scouts...")
    const { data, error } = await supabase.from("scouts").select("*").order("name")

    if (error) {
      console.error("Error fetching scouts:", error)
      throw new Error(`Failed to fetch scouts: ${error.message}`)
    }

    console.log(`Found ${data.length} scouts`)
    return data
  } catch (error) {
    console.error("Error in getScouts:", error)
    return []
  }
}

// Problems
export async function getProblems() {
  try {
    const supabase = createServerClient()

    console.log("Fetching problems...")
    // Get all problems that are not resolved
    const { data: problems, error: problemsError } = await supabase.from("problems").select("*").eq("resolved", false)

    if (problemsError) {
      console.error("Error fetching problems:", problemsError)
      throw new Error(`Failed to fetch problems: ${problemsError.message}`)
    }

    console.log(`Found ${problems.length} unresolved problems`)

    if (problems.length === 0) {
      return []
    }

    // Get all stops for these problems
    const { data: stops, error: stopsError } = await supabase
      .from("stops")
      .select("*")
      .in(
        "id",
        problems.map((problem) => problem.stop_id),
      )

    if (stopsError) {
      console.error("Error fetching stops:", stopsError)
      throw new Error(`Failed to fetch stops: ${stopsError.message}`)
    }

    // Get all routes for these stops
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .select("*")
      .in(
        "id",
        stops.map((stop) => stop.route_id),
      )

    if (routesError) {
      console.error("Error fetching routes:", routesError)
      throw new Error(`Failed to fetch routes: ${routesError.message}`)
    }

    // Combine the data
    const problemsWithRelations = problems.map((problem) => {
      const stop = stops.find((s) => s.id === problem.stop_id)
      const route = stop ? routes.find((r) => r.id === stop.route_id) : null

      return {
        ...problem,
        stop,
        route,
      }
    })

    return problemsWithRelations
  } catch (error) {
    console.error("Error in getProblems:", error)
    return []
  }
}

export async function createRoute(name: string) {
  try {
    const supabase = createServerClient()

    console.log("Creating route with name:", name)
    console.log("Using Supabase client:", supabase ? "Valid client" : "Invalid client")

    // Check if we're using the service role
    const { data: authData, error: authError } = await supabase.auth.getSession()
    console.log("Auth session check:", authError ? "Error" : "Success", "Role:", authData?.session?.role || "No role")

    const { data, error } = await supabase.from("routes").insert([{ name }]).select()

    if (error) {
      console.error("Error creating route:", error)
      console.error("Error details:", JSON.stringify(error))
      throw new Error(`Failed to create route: ${error.message}`)
    }

    console.log("Route created successfully:", data)
    revalidatePath("/routes")
    return { success: true, route: data?.[0] }
  } catch (error) {
    console.error("Error in createRoute:", error)
    return { success: false, error: error.message }
  }
}

export async function updateRoute(route: Partial<Route>) {
  try {
    const supabase = createServerClient()

    console.log(`Updating route ${route.id}...`)
    const { error } = await supabase.from("routes").update(route).eq("id", route.id)

    if (error) {
      console.error("Error updating route:", error)
      throw new Error(`Failed to update route: ${error.message}`)
    }

    revalidatePath("/routes")
    return { success: true }
  } catch (error) {
    console.error("Error in updateRoute:", error)
    return { success: false }
  }
}

export async function createTruck(truck: Omit<Truck, "id" | "created_at" | "updated_at">) {
  try {
    const supabase = createServerClient()

    console.log("Creating truck...")
    const { error } = await supabase.from("trucks").insert([truck])

    if (error) {
      console.error("Error creating truck:", error)
      throw new Error(`Failed to create truck: ${error.message}`)
    }

    revalidatePath("/trucks")
    return { success: true }
  } catch (error) {
    console.error("Error in createTruck:", error)
    return { success: false }
  }
}

export async function updateTruck(truck: Partial<Truck>) {
  try {
    const supabase = createServerClient()

    console.log(`Updating truck ${truck.id}...`)
    const { error } = await supabase.from("trucks").update(truck).eq("id", truck.id)

    if (error) {
      console.error("Error updating truck:", error)
      throw new Error(`Failed to update truck: ${error.message}`)
    }

    revalidatePath("/trucks")
    return { success: true }
  } catch (error) {
    console.error("Error in updateTruck:", error)
    return { success: false }
  }
}

export async function createStop(stop: Omit<Stop, "id" | "created_at" | "updated_at">) {
  try {
    const supabase = createServerClient()

    console.log("Creating stop...")
    const { data, error } = await supabase.from("stops").insert([stop]).select()

    if (error) {
      console.error("Error creating stop:", error)
      throw new Error(`Failed to create stop: ${error.message}`)
    }

    revalidatePath(`/routes/${stop.route_id}`)
    return { success: true, stopId: data?.[0]?.id }
  } catch (error) {
    console.error("Error in createStop:", error)
    return { success: false }
  }
}

export async function updateStop(stop: Partial<Stop>) {
  try {
    const supabase = createServerClient()

    console.log(`Updating stop ${stop.id}...`)
    const { error } = await supabase.from("stops").update(stop).eq("id", stop.id)

    if (error) {
      console.error("Error updating stop:", error)
      throw new Error(`Failed to update stop: ${error.message}`)
    }

    revalidatePath(`/routes/${stop.route_id}`)
    return { success: true }
  } catch (error) {
    console.error("Error in updateStop:", error)
    return { success: false }
  }
}

// Example of updating the createProblem function to return the created problem
export async function createProblem(problem: Omit<Problem, "id" | "created_at" | "updated_at">) {
  try {
    const supabase = createServerClient()

    console.log("Creating problem...")
    const { data, error } = await supabase.from("problems").insert([problem]).select()

    if (error) {
      console.error("Error creating problem:", error)
      throw new Error(`Failed to create problem: ${error.message}`)
    }

    revalidatePath(`/routes/${problem.stop_id}`)
    return { success: true, problem: data?.[0] }
  } catch (error) {
    console.error("Error in createProblem:", error)
    return { success: false }
  }
}

export async function resolveProblem(id: string) {
  try {
    const supabase = createServerClient()

    console.log(`Resolving problem ${id}...`)
    const { error } = await supabase.from("problems").update({ resolved: true }).eq("id", id)

    if (error) {
      console.error("Error resolving problem:", error)
      throw new Error(`Failed to resolve problem: ${error.message}`)
    }

    revalidatePath("/problems")
    return { success: true }
  } catch (error) {
    console.error("Error in resolveProblem:", error)
    return { success: false }
  }
}

export async function assignScoutToStop(stop_id: string, scout_id: string, role: "drop" | "spread") {
  try {
    const supabase = createServerClient()

    console.log(`Assigning scout ${scout_id} to stop ${stop_id}...`)
    const { error } = await supabase.from("stop_scouts").insert([{ stop_id, scout_id, role }])

    if (error) {
      console.error("Error assigning scout to stop:", error)
      throw new Error(`Failed to assign scout to stop: ${error.message}`)
    }

    revalidatePath(`/routes/${stop_id}`)
    return { success: true }
  } catch (error) {
    console.error("Error in assignScoutToStop:", error)
    return { success: false }
  }
}

export async function removeScoutFromStop(stop_id: string, scout_id: string, role: "drop" | "spread") {
  try {
    const supabase = createServerClient()

    console.log(`Removing scout ${scout_id} from stop ${stop_id} with role ${role}...`)
    const { error } = await supabase
      .from("stop_scouts")
      .delete()
      .eq("stop_id", stop_id)
      .eq("scout_id", scout_id)
      .eq("role", role)

    if (error) {
      console.error("Error removing scout from stop:", error)
      throw new Error(`Failed to remove scout from stop: ${error.message}`)
    }

    revalidatePath(`/routes/${stop_id}`)
    return { success: true }
  } catch (error) {
    console.error("Error in removeScoutFromStop:", error)
    return { success: false, error: error.message }
  }
}

export async function assignTruckToStops(route_id: string, truck_id: string) {
  try {
    const supabase = createServerClient()

    console.log(`Assigning truck ${truck_id} to stops on route ${route_id}...`)

    // Fetch all unassigned stops for the route
    const { data: stops, error: stopsError } = await supabase
      .from("stops")
      .select("id")
      .eq("route_id", route_id)
      .is("assigned_truck_id", null)

    if (stopsError) {
      console.error("Error fetching unassigned stops:", stopsError)
      throw new Error(`Failed to fetch unassigned stops: ${stopsError.message}`)
    }

    if (stops.length === 0) {
      console.log("No unassigned stops found for this route.")
      return { success: true, message: "No unassigned stops found for this route." }
    }

    // Update the stops to assign the truck
    const { error: updateError } = await supabase
      .from("stops")
      .update({ assigned_truck_id: truck_id })
      .in(
        "id",
        stops.map((stop) => stop.id),
      )

    if (updateError) {
      console.error("Error assigning truck to stops:", updateError)
      throw new Error(`Failed to assign truck to stops: ${updateError.message}`)
    }

    // Also add the truck to the route_trucks table if it's not already there
    const { data: existingRouteTruck, error: checkError } = await supabase
      .from("route_trucks")
      .select("*")
      .eq("route_id", route_id)
      .eq("truck_id", truck_id)
      .maybeSingle()

    if (checkError) {
      console.error("Error checking existing route truck:", checkError)
    }

    if (!existingRouteTruck) {
      const { error: insertError } = await supabase.from("route_trucks").insert([{ route_id, truck_id }])

      if (insertError) {
        console.error("Error adding truck to route:", insertError)
      }
    }

    revalidatePath(`/routes/${route_id}`)
    return { success: true }
  } catch (error) {
    console.error("Error in assignTruckToStops:", error)
    return { success: false }
  }
}

export async function getTruckDetails(truckId: string) {
  try {
    const supabase = createServerClient()

    console.log(`Fetching truck details for ID: ${truckId}`)

    // Get the truck
    const { data: truck, error: truckError } = await supabase.from("trucks").select("*").eq("id", truckId).maybeSingle()

    if (truckError) {
      console.error("Error fetching truck:", truckError)
      throw new Error(`Failed to fetch truck: ${truckError.message}`)
    }

    if (!truck) {
      console.error("Truck not found:", truckId)
      return null
    }

    // Get all stops assigned to this truck
    const { data: stops, error: stopsError } = await supabase.from("stops").select("*").eq("assigned_truck_id", truckId)

    if (stopsError) {
      console.error("Error fetching stops:", stopsError)
      throw new Error(`Failed to fetch stops: ${stopsError.message}`)
    }

    const stopsArray = stops || []

    // Get all products
    const { data: products, error: productsError } = await supabase.from("products").select("*")

    if (productsError) {
      console.error("Error fetching products:", productsError)
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    // Get all stop products
    let stopProducts = []
    if (stopsArray.length > 0) {
      const { data: stopProductsData, error: spError } = await supabase
        .from("stop_products")
        .select("*")
        .in(
          "stop_id",
          stopsArray.map((stop) => stop.id),
        )

      if (spError) {
        console.error("Error fetching stop products:", spError)
        throw new Error(`Failed to fetch stop products: ${spError.message}`)
      }

      stopProducts = stopProductsData || []
    }

    // Get all problems for these stops
    let problems = []
    if (stopsArray.length > 0) {
      const { data: problemsData, error: problemsError } = await supabase
        .from("problems")
        .select("*")
        .in(
          "stop_id",
          stopsArray.map((stop) => stop.id),
        )

      if (problemsError) {
        console.error("Error fetching problems:", problemsError)
        throw new Error(`Failed to fetch problems: ${problemsError.message}`)
      }

      problems = problemsData || []
    }

    // Get all stop-scout assignments
    let stopScouts = []
    if (stopsArray.length > 0) {
      const { data: stopScoutsData, error: ssError } = await supabase
        .from("stop_scouts")
        .select("*")
        .in(
          "stop_id",
          stopsArray.map((stop) => stop.id),
        )

      if (ssError) {
        console.error("Error fetching stop scouts:", ssError)
        throw new Error(`Failed to fetch stop scouts: ${ssError.message}`)
      }

      stopScouts = stopScoutsData || []
    }

    // Get all scouts
    const { data: scouts, error: scoutsError } = await supabase.from("scouts").select("*")

    if (scoutsError) {
      console.error("Error fetching scouts:", scoutsError)
      throw new Error(`Failed to fetch scouts: ${scoutsError.message}`)
    }

    // Get all truck-scout assignments
    const { data: truckScouts, error: tsError } = await supabase
      .from("truck_scouts")
      .select("*")
      .eq("truck_id", truckId)

    if (tsError) {
      console.error("Error fetching truck scouts:", tsError)
      throw new Error(`Failed to fetch truck scouts: ${tsError.message}`)
    }

    // Get assigned scouts for this truck
    const assignedScouts = scouts.filter((scout) => truckScouts.some((ts) => ts.scout_id === scout.id))

    // Get all routes
    const { data: routes, error: routesError } = await supabase.from("routes").select("*")

    if (routesError) {
      console.error("Error fetching routes:", routesError)
      throw new Error(`Failed to fetch routes: ${routesError.message}`)
    }

    // Combine the data
    const stopsWithRelations = stopsArray.map((stop) => {
      const stopProblems = problems.filter((problem) => problem.stop_id === stop.id) || []
      const stopScoutAssignments = stopScouts.filter((ss) => ss.stop_id === stop.id) || []
      const assignedScouts = scouts
        .filter((scout) => stopScoutAssignments.some((ss) => ss.scout_id === scout.id))
        .map((scout) => scout.name)

      const scoutRoles = stopScoutAssignments.reduce(
        (acc, ss) => {
          const scout = scouts.find((s) => s.id === ss.scout_id)
          if (scout) {
            // Check if we already have an entry for this scout
            if (acc[scout.name]) {
              // If yes, push the new role into the existing array
              // (Optional: Add a check if you want to avoid duplicate roles in the array)
              if (!acc[scout.name].includes(ss.role)) {
                acc[scout.name].push(ss.role)
              }
            } else {
              // If no, create a new array containing this role
              acc[scout.name] = [ss.role]
            }
          }
          return acc
        },
        {} as Record<string, string[]>, // Initialize accumulator as Record<string, array of strings>
      )

      const route = routes.find((route) => route.id === stop.route_id)

      // Add products to stop
      const stopProductsList = stopProducts.filter((sp) => sp.stop_id === stop.id) || []

      // Add product details to each stop product
      const stopProductsWithDetails = stopProductsList.map((sp) => {
        const product = products.find((p) => p.id === sp.product_id)
        return { ...sp, product }
      })

      // Calculate total quantity
      const totalQuantity = stopProductsList.reduce((sum, sp) => sum + sp.quantity, 0)

      return {
        ...stop,
        problems: stopProblems,
        assignedScouts,
        scoutRoles,
        route,
        products: stopProductsWithDetails,
        totalQuantity,
      }
    })

    const currentStops = stopsWithRelations.filter((stop) => stop.status !== "delivered")
    const completedStops = stopsWithRelations.filter((stop) => stop.status === "delivered")

    return {
      ...truck,
      currentStops,
      completedStops,
      assignedScouts,
    }
  } catch (error) {
    console.error("Error in getTruckDetails:", error)
    return null
  }
}

export async function assignStopToTruck(stopId: string, truckId: string) {
  try {
    const supabase = createServerClient()

    console.log(`Assigning stop ${stopId} to truck ${truckId}...`)
    const { error } = await supabase.from("stops").update({ assigned_truck_id: truckId }).eq("id", stopId)

    if (error) {
      console.error("Error assigning stop to truck:", error)
      throw new Error(`Failed to assign stop to truck: ${error.message}`)
    }

    // Get the route_id for this stop
    const { data: stop, error: stopError } = await supabase.from("stops").select("route_id").eq("id", stopId).single()

    if (stopError) {
      console.error("Error fetching stop route:", stopError)
    } else if (stop) {
      // Check if the truck is already assigned to this route
      const { data: existingRouteTruck, error: checkError } = await supabase
        .from("route_trucks")
        .select("*")
        .eq("route_id", stop.route_id)
        .eq("truck_id", truckId)
        .maybeSingle()

      if (checkError) {
        console.error("Error checking existing route truck:", checkError)
      }

      // If not, add the truck to the route
      if (!existingRouteTruck) {
        const { error: insertError } = await supabase
          .from("route_trucks")
          .insert([{ route_id: stop.route_id, truck_id: truckId }])

        if (insertError) {
          console.error("Error adding truck to route:", insertError)
        }
      }
    }

    revalidatePath("/trucks")
    return { success: true }
  } catch (error) {
    console.error("Error in assignStopToTruck:", error)
    return { success: false }
  }
}

export async function unassignStopFromTruck(stopId: string) {
  try {
    const supabase = createServerClient()

    console.log(`Unassigning stop ${stopId} from truck...`)
    const { error } = await supabase.from("stops").update({ assigned_truck_id: null }).eq("id", stopId)

    if (error) {
      console.error("Error unassigning stop from truck:", error)
      throw new Error(`Failed to unassign stop from truck: ${error.message}`)
    }

    revalidatePath("/trucks")
    return { success: true }
  } catch (error) {
    console.error("Error in unassignStopFromTruck:", error)
    return { success: false }
  }
}

export async function assignScoutToTruck(truck_id: string, scout_id: string) {
  try {
    const supabase = createServerClient()

    console.log(`Assigning scout ${scout_id} to truck ${truck_id}...`)
    const { error } = await supabase.from("truck_scouts").insert([{ truck_id, scout_id }])

    if (error) {
      console.error("Error assigning scout to truck:", error)
      throw new Error(`Failed to assign scout to truck: ${error.message}`)
    }

    // Don't revalidate the path since we're updating the UI directly
    // revalidatePath("/trucks")

    return { success: true }
  } catch (error) {
    console.error("Error in assignScoutToTruck:", error)
    return { success: false }
  }
}

export async function removeScoutFromTruck(truck_id: string, scout_id: string) {
  try {
    const supabase = createServerClient()

    console.log(`Removing scout ${scout_id} from truck ${truck_id}...`)
    const { error } = await supabase.from("truck_scouts").delete().eq("truck_id", truck_id).eq("scout_id", scout_id)

    if (error) {
      console.error("Error removing scout from truck:", error)
      throw new Error(`Failed to remove scout from truck: ${error.message}`)
    }

    // Don't revalidate the path since we're updating the UI directly
    // revalidatePath("/trucks")

    return { success: true }
  } catch (error) {
    console.error("Error in removeScoutFromTruck:", error)
    return { success: false, error: error.message }
  }
}

export async function assignTruckScoutsToStop(
  stop_id: string,
  truck_id: string,
  roles: { drop: boolean; spread: boolean },
) {
  try {
    const supabase = createServerClient()

    // Get all scouts assigned to this truck
    const { data: truckScouts, error: fetchError } = await supabase
      .from("truck_scouts")
      .select("scout_id")
      .eq("truck_id", truck_id)

    if (fetchError) {
      console.error("Error fetching truck scouts:", fetchError)
      throw new Error(`Failed to fetch truck scouts: ${fetchError.message}`)
    }

    if (!truckScouts || truckScouts.length === 0) {
      return { success: true, message: "No scouts assigned to this truck" }
    }

    // Get the full scout objects for the response
    const scoutIds = truckScouts.map((ts) => ts.scout_id)
    const { data: scoutObjects, error: scoutsError } = await supabase.from("scouts").select("*").in("id", scoutIds)

    if (scoutsError) {
      console.error("Error fetching scout details:", scoutsError)
      throw new Error(`Failed to fetch scout details: ${scoutsError.message}`)
    }

    // Prepare assignments
    const assignments = []

    if (roles.drop) {
      truckScouts.forEach((ts) => {
        assignments.push({
          stop_id,
          scout_id: ts.scout_id,
          role: "drop",
        })
      })
    }

    if (roles.spread) {
      truckScouts.forEach((ts) => {
        assignments.push({
          stop_id,
          scout_id: ts.scout_id,
          role: "spread",
        })
      })
    }

    if (assignments.length === 0) {
      return { success: true, message: "No roles selected for assignment" }
    }

    // Insert all assignments
    const { error } = await supabase.from("stop_scouts").insert(assignments)

    if (error) {
      console.error("Error assigning truck scouts to stop:", error)
      throw new Error(`Failed to assign truck scouts to stop: ${error.message}`)
    }

    // Return the full scout objects
    return {
      success: true,
      assignedScouts: scoutObjects || [],
    }
  } catch (error) {
    console.error("Error in assignTruckScoutsToStop:", error)
    return { success: false, error: error.message }
  }
}
