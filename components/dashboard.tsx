"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import RoutesManagement from "@/components/routes-management"
import TrucksManagement from "@/components/trucks-management"
import ProblemsManagement from "@/components/problems-management"
import SeedButton from "@/components/seed-button"

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("routes")

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mulch Delivery Dashboard</h1>
        <SeedButton />
      </div>

      <Tabs defaultValue="routes" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="trucks">Trucks</TabsTrigger>
          <TabsTrigger value="problems">Problems</TabsTrigger>
        </TabsList>
        <TabsContent value="routes">
          <RoutesManagement />
        </TabsContent>
        <TabsContent value="trucks">
          <TrucksManagement />
        </TabsContent>
        <TabsContent value="problems">
          <ProblemsManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}
