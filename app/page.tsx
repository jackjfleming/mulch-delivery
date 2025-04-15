import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Dashboard from "@/components/dashboard"
import RoutesManagement from "@/components/routes-management"
import TrucksManagement from "@/components/trucks-management"
import ProblemsManagement from "@/components/problems-management"
import SeedButton from "@/components/seed-button"

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mulch Delivery Management</h1>
        <SeedButton />
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="trucks">Trucks</TabsTrigger>
          <TabsTrigger value="problems">Problems</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <Dashboard />
        </TabsContent>

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
    </main>
  )
}
