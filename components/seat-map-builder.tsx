"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  MousePointer2,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Circle,
  Square,
  Upload,
  Download,
  Eye,
  Settings,
  Sun,
  Moon,
} from "lucide-react"

// Types for the theater system
interface Seat {
  id: string
  type: "seat"
  label: string
  x: number
  y: number
  z: number
  sectionId: string
  status: "available" | "selected" | "sold" | "blocked"
  tier: string
  pricingTier: string
  viewAngle?: number
  obstructed?: boolean
}

interface Section {
  id: string
  type: "curved-section" | "straight-section"
  label: string
  x: number
  y: number
  z: number
  tier: string
  seats: Seat[]
  pricingTier: string
  color?: string
  // Curved section properties
  startAngle?: number
  endAngle?: number
  innerRadius?: number
  outerRadius?: number
  // Straight section properties
  width?: number
  height?: number
  rows?: number
  seatsPerRow?: number
}

interface Stage {
  id: string
  type: "stage"
  label: string
  x: number
  y: number
  z: number
  width: number
  height: number
  shape: "rectangle" | "arc" | "circle"
  color: string
}

interface PricingTier {
  id: string
  name: string
  price: number
  color: string
}

interface Tier {
  id: string
  name: string
  elevation: number
  objects: (Section | Stage)[]
}

interface TheaterMap {
  id: string
  name: string
  tiers: Tier[]
  currentTier: number
  pricingTiers: PricingTier[]
  objects: (Section | Stage)[]
  settings: {
    perspective: number
    cameraHeight: number
    showGrid: boolean
    show3D: boolean
  }
}

type Tool = "select" | "move" | "curved-section" | "straight-section" | "stage" | "seat" | "view-from-seat"

function SeatMapBuilder() {
  // State management
  const [theaterMap, setTheaterMap] = useState<TheaterMap>({
    id: "theater-1",
    name: "Mi Teatro",
    tiers: [
      { id: "platea", name: "Platea", elevation: 0, objects: [] },
      { id: "palcos", name: "Palcos", elevation: 50, objects: [] },
      { id: "balcon", name: "Balcón", elevation: 100, objects: [] },
    ],
    currentTier: 0,
    pricingTiers: [
      { id: "premium", name: "Premium", price: 150, color: "#ef4444" },
      { id: "standard", name: "Estándar", price: 100, color: "#3b82f6" },
      { id: "economy", name: "Económico", price: 50, color: "#10b981" },
      { id: "balcony", name: "Balcón", price: 75, color: "#f59e0b" },
    ],
    objects: [],
    settings: {
      perspective: 45,
      cameraHeight: 200,
      showGrid: true,
      show3D: true,
    },
  })

  const [tool, setTool] = useState<Tool>("select")
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [selectedObject, setSelectedObject] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [viewFromSeat, setViewFromSeat] = useState<string | null>(null)
  const [selectedSeatDetails, setSelectedSeatDetails] = useState<Seat | null>(null)

  // Canvas state
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, width: 0, height: 0 })

  // Dialog states
  const [curvedSectionDialog, setCurvedSectionDialog] = useState(false)
  const [straightSectionDialog, setStraightSectionDialog] = useState(false)
  const [stageDialog, setStageDialog] = useState(false)

  // Form states for new elements
  const [newCurvedSection, setNewCurvedSection] = useState({
    startAngle: 30,
    endAngle: 150,
    innerRadius: 80,
    outerRadius: 200,
    rows: 5,
    pricingTier: "standard",
  })

  const [newStraightSection, setNewStraightSection] = useState({
    rows: 5,
    seatsPerRow: 10,
    spacing: 25, // Increased default spacing
    rowSpacing: 35, // Increased default row spacing
    pricingTier: "standard",
  })

  const [newStage, setNewStage] = useState({
    width: 200,
    height: 100,
    shape: "rectangle" as const,
  })

  const [isDarkMode, setIsDarkMode] = useState(true)

  const canvasRef = useRef<HTMLDivElement>(null)

  // Get current tier objects
  const getCurrentTierObjects = useCallback(() => {
    return theaterMap.tiers[theaterMap.currentTier]?.objects || []
  }, [theaterMap.tiers, theaterMap.currentTier])

  // Canvas interaction handlers
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left - panOffset.x) / zoom
      const y = (e.clientY - rect.top - panOffset.y) / zoom

      if (tool === "move" || e.button === 1) {
        setIsPanning(true)
        setLastPanPoint({ x: e.clientX, y: e.clientY })
      } else if (tool === "select") {
        setIsSelecting(true)
        setSelectionBox({ x, y, width: 0, height: 0 })
      } else {
        // Handle creation tools
        handleCreateElement(x, y)
      }
    },
    [tool, zoom, panOffset],
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - lastPanPoint.x
        const deltaY = e.clientY - lastPanPoint.y
        setPanOffset((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }))
        setLastPanPoint({ x: e.clientX, y: e.clientY })
      } else if (isSelecting) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return

        const currentX = (e.clientX - rect.left - panOffset.x) / zoom
        const currentY = (e.clientY - rect.top - panOffset.y) / zoom

        setSelectionBox((prev) => ({
          ...prev,
          width: currentX - prev.x,
          height: currentY - prev.y,
        }))
      }
    },
    [isPanning, isSelecting, lastPanPoint, zoom, panOffset],
  )

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false)
    if (isSelecting) {
      // Handle multi-selection
      const currentTier = theaterMap.tiers[theaterMap.currentTier]
      const selectedSeatIds: string[] = []

      currentTier.objects.forEach((obj) => {
        if (obj.type === "curved-section" || obj.type === "straight-section") {
          obj.seats.forEach((seat) => {
            const seatScreenX = seat.x * zoom + panOffset.x
            const seatScreenY = seat.y * zoom + panOffset.y
            const boxLeft = Math.min(selectionBox.x, selectionBox.x + selectionBox.width) * zoom + panOffset.x
            const boxRight = Math.max(selectionBox.x, selectionBox.x + selectionBox.width) * zoom + panOffset.x
            const boxTop = Math.min(selectionBox.y, selectionBox.y + selectionBox.height) * zoom + panOffset.y
            const boxBottom = Math.max(selectionBox.y, selectionBox.y + selectionBox.height) * zoom + panOffset.y

            if (
              seatScreenX >= boxLeft &&
              seatScreenX <= boxRight &&
              seatScreenY >= boxTop &&
              seatScreenY <= boxBottom
            ) {
              selectedSeatIds.push(seat.id)
            }
          })
        }
      })

      setSelectedSeats(selectedSeatIds)
      setIsSelecting(false)
      setSelectionBox({ x: 0, y: 0, width: 0, height: 0 })
    }
  }, [isSelecting, selectionBox, theaterMap, zoom, panOffset])

  const handleCreateElement = useCallback(
    (x: number, y: number) => {
      let newObject: Section | Stage | null = null
      const currentTier = theaterMap.tiers[theaterMap.currentTier]

      switch (tool) {
        case "curved-section":
          newObject = createCurvedSection(x, y, currentTier)
          break
        case "straight-section":
          newObject = createStraightSection(x, y, currentTier)
          break
        case "stage":
          newObject = createStage(x, y)
          break
      }

      if (newObject) {
        setTheaterMap((prev) => ({
          ...prev,
          objects: [...prev.objects, newObject!],
          tiers: prev.tiers.map((tier, index) =>
            index === prev.currentTier ? { ...tier, objects: [...tier.objects, newObject!] } : tier,
          ),
        }))
        setTool("select")
        console.log("[v0] Created object:", newObject)
      }
    },
    [tool, newCurvedSection, newStraightSection, newStage, theaterMap.currentTier, theaterMap.tiers],
  )

  const createCurvedSection = useCallback(
    (x: number, y: number, currentTier: Tier): Section => {
      const seats: Seat[] = []
      const sectionId = `curved-section-${Date.now()}`
      const { startAngle, endAngle, innerRadius, outerRadius, rows, pricingTier } = newCurvedSection

      const radiusStep = (outerRadius - innerRadius) / rows
      const totalAngle = endAngle - startAngle

      for (let row = 0; row < rows; row++) {
        const radius = innerRadius + row * radiusStep
        const seatsInRow = Math.max(8, Math.floor((radius * totalAngle * Math.PI) / (180 * 20))) // Better spacing
        const angleStep = totalAngle / (seatsInRow - 1)

        for (let seat = 0; seat < seatsInRow; seat++) {
          const angle = startAngle + seat * angleStep
          const seatX = x + radius * Math.cos((angle * Math.PI) / 180)
          const seatY = y + radius * Math.sin((angle * Math.PI) / 180)
          const rowLabel = String.fromCharCode(65 + row)
          const seatNumber = seat + 1

          seats.push({
            id: `seat-${sectionId}-${row}-${seat}`,
            type: "seat",
            label: `${rowLabel}${seatNumber}`,
            x: seatX,
            y: seatY,
            z: currentTier.elevation,
            sectionId,
            status: "available",
            tier: currentTier.id,
            pricingTier,
            viewAngle: angle,
          })
        }
      }

      return {
        id: sectionId,
        type: "curved-section",
        label: `Sección ${theaterMap.objects.length + 1}`,
        x,
        y,
        z: currentTier.elevation,
        tier: currentTier.id,
        seats,
        pricingTier,
        color: theaterMap.pricingTiers.find((p) => p.id === pricingTier)?.color,
        startAngle,
        endAngle,
        innerRadius,
        outerRadius,
      }
    },
    [newCurvedSection, theaterMap],
  )

  const createStraightSection = useCallback(
    (x: number, y: number, currentTier: Tier): Section => {
      const seats: Seat[] = []
      const sectionId = `straight-section-${Date.now()}`

      for (let row = 0; row < newStraightSection.rows; row++) {
        for (let seat = 0; seat < newStraightSection.seatsPerRow; seat++) {
          const seatX = x + seat * newStraightSection.spacing
          const seatY = y + row * newStraightSection.rowSpacing
          const rowLabel = String.fromCharCode(65 + row) // A, B, C, etc.
          const seatNumber = seat + 1

          seats.push({
            id: `seat-${sectionId}-${row}-${seat}`,
            type: "seat",
            label: `${rowLabel}${seatNumber}`,
            x: seatX,
            y: seatY,
            z: currentTier.elevation,
            sectionId,
            status: "available",
            tier: currentTier.id,
            pricingTier: newStraightSection.pricingTier,
            viewAngle: 0,
          })
        }
      }

      return {
        id: sectionId,
        type: "straight-section",
        label: `Sección ${theaterMap.objects.length + 1}`,
        x,
        y,
        z: currentTier.elevation,
        tier: currentTier.id,
        seats,
        pricingTier: newStraightSection.pricingTier,
        color: theaterMap.pricingTiers.find((p) => p.id === newStraightSection.pricingTier)?.color,
        width: newStraightSection.seatsPerRow * newStraightSection.spacing,
        height: newStraightSection.rows * newStraightSection.rowSpacing,
        rows: newStraightSection.rows,
        seatsPerRow: newStraightSection.seatsPerRow,
      }
    },
    [newStraightSection, theaterMap],
  )

  const createStage = useCallback(
    (x: number, y: number): Stage => {
      return {
        id: `stage-${Date.now()}`,
        type: "stage",
        label: "Escenario",
        x,
        y,
        z: 0,
        width: newStage.width,
        height: newStage.height,
        shape: newStage.shape,
        color: "#1f2937",
      }
    },
    [newStage],
  )

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.2, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.2, 0.1))
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  // Seat interaction
  const handleSeatClick = useCallback(
    (seatId: string, e: React.MouseEvent) => {
      e.stopPropagation()

      const currentTierObjects = getCurrentTierObjects()
      const seat = currentTierObjects
        .flatMap((obj) => (obj.type === "curved-section" || obj.type === "straight-section" ? obj.seats : []))
        .find((s) => s.id === seatId)
      if (seat) {
        setSelectedSeatDetails(seat)
      }

      if (tool === "view-from-seat") {
        setViewFromSeat(seatId)
        return
      }

      if (e.ctrlKey || e.metaKey) {
        setSelectedSeats((prev) => (prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]))
      } else {
        setSelectedSeats([seatId])
      }
    },
    [tool, getCurrentTierObjects],
  )

  // Render 3D seat with perspective
  const renderSeat = useCallback(
    (seat: Seat) => {
      const isSelected = selectedSeats.includes(seat.id)
      const pricingTier = theaterMap.pricingTiers.find((p) => p.id === seat.pricingTier)
      const perspective = theaterMap.settings.perspective
      const cameraHeight = theaterMap.settings.cameraHeight

      // Calculate 3D perspective
      const perspectiveY = seat.y - (seat.z * Math.sin((perspective * Math.PI) / 180)) / 2
      const perspectiveScale = 1 + seat.z / cameraHeight

      let statusColor = pricingTier?.color || "#6b7280"
      if (seat.status === "selected" || isSelected) statusColor = "#fbbf24"
      if (seat.status === "sold") statusColor = "#ef4444"
      if (seat.status === "blocked") statusColor = "#6b7280"

      return (
        <div
          key={seat.id}
          className="absolute cursor-pointer transition-all duration-200 hover:scale-110"
          style={{
            left: seat.x - 6,
            top: perspectiveY - 6,
            transform: `scale(${perspectiveScale})`,
            zIndex: Math.floor(seat.z + seat.y),
          }}
          onClick={(e) => handleSeatClick(seat.id, e)}
          title={`${seat.label} - ${pricingTier?.name} ($${pricingTier?.price})`}
        >
          <div
            className="w-3 h-3 rounded-sm border border-gray-300 shadow-sm"
            style={{
              backgroundColor: statusColor,
              boxShadow: theaterMap.settings.show3D ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
            }}
          />
          {isSelected && <div className="absolute -inset-1 border-2 border-yellow-400 rounded-md animate-pulse" />}
        </div>
      )
    },
    [selectedSeats, theaterMap.pricingTiers, theaterMap.settings, handleSeatClick],
  )

  // Render stage with 3D perspective
  const renderStage = useCallback(
    (stage: Stage) => {
      const perspective = theaterMap.settings.perspective
      const perspectiveY = stage.y - (stage.z * Math.sin((perspective * Math.PI) / 180)) / 2

      return (
        <div
          key={stage.id}
          className="absolute border-2 border-gray-600 cursor-pointer"
          style={{
            left: stage.x,
            top: perspectiveY,
            width: stage.width,
            height: stage.height,
            backgroundColor: stage.color,
            borderRadius: stage.shape === "circle" ? "50%" : stage.shape === "arc" ? "50% 50% 0 0" : "4px",
            boxShadow: theaterMap.settings.show3D ? "0 4px 8px rgba(0,0,0,0.3)" : "none",
            zIndex: Math.floor(stage.z + stage.y),
          }}
          onClick={() => setSelectedObject(stage.id)}
        >
          <div className="flex items-center justify-center h-full text-white text-sm font-medium">{stage.label}</div>
        </div>
      )
    },
    [theaterMap.settings],
  )

  // Import/Export functionality
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          setTheaterMap(data)
        } catch (error) {
          console.error("Error importing theater map:", error)
        }
      }
      reader.readAsText(file)
    }
  }, [])

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(theaterMap, null, 2)
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
    const exportFileDefaultName = `${theaterMap.name.replace(/\s+/g, "-").toLowerCase()}.json`

    const linkElement = document.createElement("a")
    linkElement.setAttribute("href", dataUri)
    linkElement.setAttribute("download", exportFileDefaultName)
    linkElement.click()
  }, [theaterMap])

  const toggleTheme = useCallback(() => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle("dark")
  }, [isDarkMode])

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Main Canvas Area */}
      <div className={`flex-1 relative transition-all duration-300 ${sidebarCollapsed ? "mr-0" : "mr-80"}`}>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-card-foreground">{theaterMap.name}</h1>
              <div className="flex items-center gap-2">
                {theaterMap.tiers.map((tier, index) => (
                  <Button
                    key={tier.id}
                    variant={index === theaterMap.currentTier ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTheaterMap((prev) => ({ ...prev, currentTier: index }))}
                  >
                    {tier.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                title={isDarkMode ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" id="import-file" />
              <Button variant="outline" size="sm" onClick={() => document.getElementById("import-file")?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="absolute top-20 left-4 z-10 bg-card rounded-lg shadow-lg border border-border p-2">
          <div className="flex flex-col gap-2">
            <Button
              variant={tool === "select" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("select")}
              title="Seleccionar"
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
            <Button
              variant={tool === "move" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("move")}
              title="Mover"
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              variant={tool === "view-from-seat" ? "default" : "outline"}
              size="sm"
              onClick={() => setTool("view-from-seat")}
              title="Vista desde asiento"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="absolute inset-0 pt-16 overflow-hidden cursor-grab active:cursor-grabbing"
          style={{
            background: isDarkMode
              ? "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)"
              : "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)",
            backgroundImage: isDarkMode
              ? "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)"
              : "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          <div
            className="relative origin-top-left transition-transform duration-200"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              width: "2000px",
              height: "1500px",
            }}
          >
            {/* Render current tier objects */}
            {getCurrentTierObjects().map((obj) => {
              if (obj.type === "stage") {
                return renderStage(obj)
              } else if (obj.type === "curved-section" || obj.type === "straight-section") {
                return <div key={obj.id}>{obj.seats.map((seat) => renderSeat(seat))}</div>
              }
              return null
            })}

            {/* Selection box */}
            {isSelecting && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30"
                style={{
                  left: Math.min(selectionBox.x, selectionBox.x + selectionBox.width),
                  top: Math.min(selectionBox.y, selectionBox.y + selectionBox.height),
                  width: Math.abs(selectionBox.width),
                  height: Math.abs(selectionBox.height),
                }}
              />
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(zoom * 1.2, 3))}
            className="bg-card/80 backdrop-blur-sm"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(zoom / 1.2, 0.1))}
            className="bg-card/80 backdrop-blur-sm"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setZoom(1)
              setPanOffset({ x: 0, y: 0 })
            }}
            className="bg-card/80 backdrop-blur-sm"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="text-xs text-center text-muted-foreground bg-card/80 backdrop-blur-sm px-2 py-1 rounded">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Tool Status */}
        {tool !== "select" && tool !== "move" && (
          <div className="absolute bottom-4 right-4 z-10 bg-card/90 backdrop-blur-sm text-card-foreground px-3 py-2 rounded-lg shadow-lg border border-border">
            {tool === "curved-section" && "Haz clic para crear sección curva"}
            {tool === "straight-section" && "Haz clic para crear sección recta"}
            {tool === "stage" && "Haz clic para crear escenario"}
            {tool === "view-from-seat" && "Haz clic en un asiento para ver desde esa perspectiva"}
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div
        className={`fixed right-0 top-0 h-full bg-card border-l border-border transition-all duration-300 z-20 ${
          sidebarCollapsed ? "w-12" : "w-80"
        }`}
      >
        {/* Sidebar Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute -left-6 top-4 bg-card border border-border rounded-l-md rounded-r-none"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>

        {!sidebarCollapsed && (
          <div className="p-4 h-full overflow-y-auto">
            <div className="space-y-6">
              {/* Properties Header */}
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Propiedades</h2>
              </div>

              <Separator />

              {/* Tools */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Herramientas</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={tool === "select" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTool("select")}
                  >
                    <MousePointer2 className="h-4 w-4" />
                  </Button>
                  <Button variant={tool === "move" ? "default" : "outline"} size="sm" onClick={() => setTool("move")}>
                    <Move className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Creation Tools */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Crear Elementos</Label>
                <div className="space-y-2">
                  <Dialog open={curvedSectionDialog} onOpenChange={setCurvedSectionDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                        <Circle className="h-4 w-4 mr-2" />
                        Sección Curva
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card text-card-foreground">
                      <DialogHeader>
                        <DialogTitle>Nueva Sección Curva</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Ángulo Inicial</Label>
                            <Input
                              type="number"
                              value={newCurvedSection.startAngle}
                              onChange={(e) =>
                                setNewCurvedSection((prev) => ({
                                  ...prev,
                                  startAngle: Number.parseInt(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Ángulo Final</Label>
                            <Input
                              type="number"
                              value={newCurvedSection.endAngle}
                              onChange={(e) =>
                                setNewCurvedSection((prev) => ({
                                  ...prev,
                                  endAngle: Number.parseInt(e.target.value),
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Radio Interior</Label>
                            <Input
                              type="number"
                              value={newCurvedSection.innerRadius}
                              onChange={(e) =>
                                setNewCurvedSection((prev) => ({
                                  ...prev,
                                  innerRadius: Number.parseInt(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Radio Exterior</Label>
                            <Input
                              type="number"
                              value={newCurvedSection.outerRadius}
                              onChange={(e) =>
                                setNewCurvedSection((prev) => ({
                                  ...prev,
                                  outerRadius: Number.parseInt(e.target.value),
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Filas</Label>
                            <Input
                              type="number"
                              value={newCurvedSection.rows}
                              onChange={(e) =>
                                setNewCurvedSection((prev) => ({ ...prev, rows: Number.parseInt(e.target.value) }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Espaciado Base</Label>
                            <Input
                              type="number"
                              value={20} // Placeholder for base spacing, actual calculation is in createCurvedSection
                              onChange={(e) => {
                                // This affects the seat calculation in createCurvedSection
                              }}
                              placeholder="Espaciado entre asientos"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Nivel de Precio</Label>
                          <Select
                            value={newCurvedSection.pricingTier}
                            onValueChange={(value) => setNewCurvedSection((prev) => ({ ...prev, pricingTier: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {theaterMap.pricingTiers.map((tier) => (
                                <SelectItem key={tier.id} value={tier.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded" style={{ backgroundColor: tier.color }} />
                                    {tier.name} - ${tier.price}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => {
                            setTool("curved-section")
                            setCurvedSectionDialog(false)
                          }}
                          className="w-full"
                        >
                          Crear Sección Curva
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={straightSectionDialog} onOpenChange={setStraightSectionDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                        <Square className="h-4 w-4 mr-2" />
                        Sección Recta
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card text-card-foreground">
                      <DialogHeader>
                        <DialogTitle>Nueva Sección Recta</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Filas</Label>
                            <Input
                              type="number"
                              value={newStraightSection.rows}
                              onChange={(e) =>
                                setNewStraightSection((prev) => ({ ...prev, rows: Number.parseInt(e.target.value) }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Asientos por Fila</Label>
                            <Input
                              type="number"
                              value={newStraightSection.seatsPerRow}
                              onChange={(e) =>
                                setNewStraightSection((prev) => ({
                                  ...prev,
                                  seatsPerRow: Number.parseInt(e.target.value),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Total Asientos</Label>
                            <Input
                              type="number"
                              value={newStraightSection.rows * newStraightSection.seatsPerRow}
                              disabled
                              className="bg-muted"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Espaciado</Label>
                            <Input
                              type="number"
                              value={newStraightSection.spacing}
                              onChange={(e) =>
                                setNewStraightSection((prev) => ({ ...prev, spacing: Number.parseInt(e.target.value) }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Espaciado de Filas</Label>
                            <Input
                              type="number"
                              value={newStraightSection.rowSpacing}
                              onChange={(e) =>
                                setNewStraightSection((prev) => ({
                                  ...prev,
                                  rowSpacing: Number.parseInt(e.target.value),
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Nivel de Precio</Label>
                          <Select
                            value={newStraightSection.pricingTier}
                            onValueChange={(value) =>
                              setNewStraightSection((prev) => ({ ...prev, pricingTier: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {theaterMap.pricingTiers.map((tier) => (
                                <SelectItem key={tier.id} value={tier.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded" style={{ backgroundColor: tier.color }} />
                                    {tier.name} - ${tier.price}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => {
                            setTool("straight-section")
                            setStraightSectionDialog(false)
                          }}
                          className="w-full"
                        >
                          Crear Sección Recta
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={stageDialog} onOpenChange={setStageDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                        <Square className="h-4 w-4 mr-2" />
                        Escenario
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card text-card-foreground">
                      <DialogHeader>
                        <DialogTitle>Nuevo Escenario</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Ancho</Label>
                            <Input
                              type="number"
                              value={newStage.width}
                              onChange={(e) =>
                                setNewStage((prev) => ({ ...prev, width: Number.parseInt(e.target.value) }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Alto</Label>
                            <Input
                              type="number"
                              value={newStage.height}
                              onChange={(e) =>
                                setNewStage((prev) => ({ ...prev, height: Number.parseInt(e.target.value) }))
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Forma</Label>
                          <Select
                            value={newStage.shape}
                            onValueChange={(value: "rectangle" | "arc" | "circle") =>
                              setNewStage((prev) => ({ ...prev, shape: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rectangle">Rectangular</SelectItem>
                              <SelectItem value="arc">Arco</SelectItem>
                              <SelectItem value="circle">Circular</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => {
                            setTool("stage")
                            setStageDialog(false)
                          }}
                          className="w-full"
                        >
                          Crear Escenario
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <Separator />

              {/* Selected Seats Info */}
              {selectedSeats.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-3 block">Asientos Seleccionados</Label>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-sm">
                        <p className="font-medium">{selectedSeats.length} asientos seleccionados</p>
                        <div className="mt-2 space-y-1">
                          <Button size="sm" variant="outline" className="w-full bg-transparent">
                            Marcar como Vendidos
                          </Button>
                          <Button size="sm" variant="outline" className="w-full bg-transparent">
                            Marcar como Bloqueados
                          </Button>
                          <Button size="sm" variant="outline" className="w-full bg-transparent">
                            Marcar como Disponibles
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedSeatDetails && (
                <div>
                  <Label className="text-sm font-medium mb-3 block">Detalles del Asiento</Label>
                  <Card>
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Asiento:</span>
                          <span className="text-sm">{selectedSeatDetails.label}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Estado:</span>
                          <span className="text-sm capitalize">{selectedSeatDetails.status}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Nivel:</span>
                          <span className="text-sm capitalize">{selectedSeatDetails.tier}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Precio:</span>
                          <span className="text-sm">
                            ${theaterMap.pricingTiers.find((t) => t.id === selectedSeatDetails.pricingTier)?.price || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Posición:</span>
                          <span className="text-sm">
                            ({Math.round(selectedSeatDetails.x)}, {Math.round(selectedSeatDetails.y)})
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 bg-transparent"
                          onClick={() => setViewFromSeat(selectedSeatDetails.id)}
                        >
                          Ver desde este asiento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Pricing Tiers */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Niveles de Precio</Label>
                <div className="space-y-2">
                  {theaterMap.pricingTiers.map((tier) => (
                    <div key={tier.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: tier.color }} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{tier.name}</div>
                        <div className="text-xs text-muted-foreground">${tier.price}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* View from Seat */}
              {viewFromSeat && (
                <div>
                  <Label className="text-sm font-medium mb-3 block">Vista desde Asiento</Label>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-sm">
                        <p className="font-medium">Asiento: {viewFromSeat}</p>
                        <div className="mt-2 h-32 bg-gradient-to-b from-blue-100 to-gray-100 rounded flex items-center justify-center">
                          <p className="text-gray-600">Vista del escenario</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 bg-transparent"
                          onClick={() => setViewFromSeat(null)}
                        >
                          Cerrar Vista
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { SeatMapBuilder }
