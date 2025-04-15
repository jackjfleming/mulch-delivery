"use server"

import { createServerClient } from "@/lib/supabase"

export async function seedDatabase() {
  try {
    const supabase = createServerClient()
    console.log("Starting database seeding...")

    // Check if we already have data
    const { data: existingRoutes } = await supabase.from("routes").select("id").limit(1)

    if (existingRoutes && existingRoutes.length > 0) {
      console.log("Database already has data, skipping seed")
      return { success: true, message: "Database already has data" }
    }

    // 1. Create routes
    console.log("Creating routes...")
    const { data: routes, error: routesError } = await supabase
      .from("routes")
      .insert([{ name: "North Route" }, { name: "South Route" }, { name: "East Route" }])
      .select()

    if (routesError) {
      console.error("Error creating routes:", routesError)
      return { success: false, message: `Error creating routes: ${routesError.message}` }
    }

    // 2. Create trucks
    console.log("Creating trucks...")
    const { data: trucks, error: trucksError } = await supabase
      .from("trucks")
      .insert([
        { driver_name: "David Wilson", capacity: 50, phone: "555-111-2222", active: true },
        { driver_name: "Lisa Martinez", capacity: 40, phone: "555-333-4444", active: true },
        { driver_name: "James Thompson", capacity: 60, phone: "555-555-6666", active: true },
        { driver_name: "Karen Anderson", capacity: 45, phone: "555-777-8888", active: true },
        { driver_name: "Mark Davis", capacity: 55, phone: "555-999-0000", active: false },
      ])
      .select()

    if (trucksError) {
      console.error("Error creating trucks:", trucksError)
      return { success: false, message: `Error creating trucks: ${trucksError.message}` }
    }

    // 3. Create scouts
    console.log("Creating scouts...")
    const { data: scouts, error: scoutsError } = await supabase
      .from("scouts")
      .insert([
        { name: "Alex Johnson" },
        { name: "Sam Wilson" },
        { name: "Chris Taylor" },
        { name: "Jamie Lee" },
        { name: "Pat Smith" },
      ])
      .select()

    if (scoutsError) {
      console.error("Error creating scouts:", scoutsError)
      return { success: false, message: `Error creating scouts: ${scoutsError.message}` }
    }

    // 4. Create stops
    console.log("Creating stops...")
    const northRoute = routes.find((r) => r.name === "North Route")
    const southRoute = routes.find((r) => r.name === "South Route")
    const eastRoute = routes.find((r) => r.name === "East Route")

    const davidTruck = trucks.find((t) => t.driver_name === "David Wilson")
    const lisaTruck = trucks.find((t) => t.driver_name === "Lisa Martinez")
    const karenTruck = trucks.find((t) => t.driver_name === "Karen Anderson")

    if (!northRoute || !southRoute || !eastRoute || !davidTruck || !lisaTruck || !karenTruck) {
      return { success: false, message: "Missing required data for stops" }
    }

    const { data: stops, error: stopsError } = await supabase
      .from("stops")
      .insert([
        {
          route_id: northRoute.id,
          customer_name: "John Smith",
          address: "123 Main St, Anytown, USA",
          phone: "555-123-4567",
          mulch_type: "Premium Hardwood",
          mulch_quantity: 10,
          spread_requested: true,
          paid: true,
          status: "delivered",
          assigned_truck_id: davidTruck.id,
          instructions: "Place mulch near the garden in the backyard.",
          has_problems: false,
        },
        {
          route_id: northRoute.id,
          customer_name: "Emily Davis",
          address: "456 Oak Ave, Anytown, USA",
          phone: "555-987-6543",
          mulch_type: "Pine Bark",
          mulch_quantity: 5,
          spread_requested: false,
          paid: true,
          status: "pending",
          assigned_truck_id: davidTruck.id,
          instructions: "",
          has_problems: true,
        },
        {
          route_id: northRoute.id,
          customer_name: "Michael Johnson",
          address: "789 Pine Rd, Anytown, USA",
          phone: "555-456-7890",
          mulch_type: "Premium Hardwood",
          mulch_quantity: 15,
          spread_requested: true,
          paid: false,
          status: "pending",
          assigned_truck_id: null,
          instructions: "Call before arrival",
          has_problems: false,
        },
        {
          route_id: southRoute.id,
          customer_name: "Sarah Williams",
          address: "101 Maple Dr, Anytown, USA",
          phone: "555-222-3333",
          mulch_type: "Cedar",
          mulch_quantity: 8,
          spread_requested: false,
          paid: true,
          status: "partial",
          delivered_quantity: 5,
          assigned_truck_id: lisaTruck.id,
          instructions: "",
          has_problems: true,
        },
        {
          route_id: southRoute.id,
          customer_name: "Robert Brown",
          address: "202 Elm St, Anytown, USA",
          phone: "555-444-5555",
          mulch_type: "Premium Hardwood",
          mulch_quantity: 12,
          spread_requested: true,
          paid: true,
          status: "delivered",
          assigned_truck_id: lisaTruck.id,
          instructions: "Spread mulch in front flower beds only",
          has_problems: false,
        },
        {
          route_id: eastRoute.id,
          customer_name: "Jennifer Miller",
          address: "303 Birch Ln, Anytown, USA",
          phone: "555-666-7777",
          mulch_type: "Pine Bark",
          mulch_quantity: 7,
          spread_requested: false,
          paid: false,
          status: "pending",
          assigned_truck_id: karenTruck.id,
          instructions: "",
          has_problems: false,
        },
      ])
      .select()

    if (stopsError) {
      console.error("Error creating stops:", stopsError)
      return { success: false, message: `Error creating stops: ${stopsError.message}` }
    }

    // 5. Create route-truck assignments
    console.log("Creating route-truck assignments...")
    const { error: rtError } = await supabase.from("route_trucks").insert([
      { route_id: northRoute.id, truck_id: davidTruck.id },
      { route_id: northRoute.id, truck_id: trucks.find((t) => t.driver_name === "James Thompson").id },
      { route_id: southRoute.id, truck_id: lisaTruck.id },
      { route_id: eastRoute.id, truck_id: karenTruck.id },
    ])

    if (rtError) {
      console.error("Error creating route-truck assignments:", rtError)
      return { success: false, message: `Error creating route-truck assignments: ${rtError.message}` }
    }

    // 6. Create stop-scout assignments
    console.log("Creating stop-scout assignments...")
    const alexScout = scouts.find((s) => s.name === "Alex Johnson")
    const samScout = scouts.find((s) => s.name === "Sam Wilson")
    const chrisScout = scouts.find((s) => s.name === "Chris Taylor")
    const jamieScout = scouts.find((s) => s.name === "Jamie Lee")

    if (!alexScout || !samScout || !chrisScout || !jamieScout) {
      return { success: false, message: "Missing required data for scout assignments" }
    }

    const johnStop = stops.find((s) => s.customer_name === "John Smith")
    const emilyStop = stops.find((s) => s.customer_name === "Emily Davis")
    const sarahStop = stops.find((s) => s.customer_name === "Sarah Williams")
    const robertStop = stops.find((s) => s.customer_name === "Robert Brown")

    if (!johnStop || !emilyStop || !sarahStop || !robertStop) {
      return { success: false, message: "Missing required data for scout assignments" }
    }

    const { error: ssError } = await supabase.from("stop_scouts").insert([
      { stop_id: johnStop.id, scout_id: alexScout.id, role: "drop" },
      { stop_id: johnStop.id, scout_id: samScout.id, role: "spread" },
      { stop_id: emilyStop.id, scout_id: alexScout.id, role: "drop" },
      { stop_id: sarahStop.id, scout_id: chrisScout.id, role: "drop" },
      { stop_id: robertStop.id, scout_id: chrisScout.id, role: "drop" },
      { stop_id: robertStop.id, scout_id: jamieScout.id, role: "spread" },
    ])

    if (ssError) {
      console.error("Error creating stop-scout assignments:", ssError)
      return { success: false, message: `Error creating stop-scout assignments: ${ssError.message}` }
    }

    // 7. Create problems
    console.log("Creating problems...")
    const { error: problemsError } = await supabase.from("problems").insert([
      {
        stop_id: emilyStop.id,
        description: "Customer not home, couldn't access backyard",
        resolved: false,
      },
      {
        stop_id: sarahStop.id,
        description: "Not enough mulch on truck, need to return with 3 more bags",
        resolved: false,
      },
    ])

    if (problemsError) {
      console.error("Error creating problems:", problemsError)
      return { success: false, message: `Error creating problems: ${problemsError.message}` }
    }

    console.log("Database seeding completed successfully")
    return { success: true, message: "Database seeded successfully" }
  } catch (error) {
    console.error("Error seeding database:", error)
    return { success: false, message: `Error seeding database: ${error.message}` }
  }
}
