"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SeatMapBuilder } from "@/components/seat-map-builder"
import { SeatMapClient } from "@/components/seat-map-client"
import { Settings, Users } from "lucide-react"

export default function Home() {
  const [currentView, setCurrentView] = useState<"builder" | "client">("builder")

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      <nav className="h-14 border-b bg-card px-4 flex items-center justify-between">
        <div className="font-semibold">SeatMap</div>
        <div className="flex gap-2">
          <Button
            variant={currentView === "builder" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentView("builder")}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Editor
          </Button>
          <Button
            variant={currentView === "client" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentView("client")}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Client View
          </Button>
        </div>
      </nav>

      <div className="flex-1 min-h-0">
        {currentView === "builder" ? <SeatMapBuilder /> : <SeatMapClient />}
      </div>
    </div>
  )
}
