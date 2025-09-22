"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import type { Seat, Section, Stage, PricingTier, Tier, TheaterMap, CartItem, CustomerInfo } from "@/types/theater"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ShoppingCart, Eye, X, CreditCard } from "lucide-react"

// Types moved to @/types/theater

function SeatMapClient() {
  const [theaterMap, setTheaterMap] = useState<TheaterMap>({
    id: "theater-1",
    name: "Teatro Principal",
    tiers: [
      {
        id: "platea",
        name: "Platea",
        elevation: 0,
        objects: [
          {
            id: "section-1",
            type: "straight-section",
            label: "Sección A",
            x: 200,
            y: 300,
            z: 0,
            tier: "platea",
            pricingTier: "premium",
            color: "#ef4444",
            width: 300,
            height: 200,
            rows: 8,
            seatsPerRow: 12,
            group: 1,
            seats: Array.from({ length: 96 }, (_, i) => {
              const row = Math.floor(i / 12) + 1
              const seatNum = (i % 12) + 1
              const rowLetter = String.fromCharCode(64 + row) // A, B, C, etc.

              let status: Seat["status"] = "available"
              if ([5, 6, 23, 24, 41, 42, 67, 68].includes(i)) {
                status = "reserved"
              }

              return {
                id: `seat-${i}`,
                type: "seat" as const,
                label: `${rowLetter}${seatNum}`,
                x: 200 + (seatNum - 1) * 25 + (row % 2) * 12,
                y: 300 + (row - 1) * 25,
                z: 0,
                sectionId: "section-1",
                status,
                tier: "platea",
                pricingTier: "premium",
                row: rowLetter,
                number: seatNum.toString(),
              }
            }),
          },
          {
            id: "section-2",
            type: "straight-section",
            label: "Sección B",
            x: 600,
            y: 300,
            z: 0,
            tier: "platea",
            pricingTier: "standard",
            color: "#3b82f6",
            width: 250,
            height: 150,
            rows: 6,
            seatsPerRow: 10,
            group: 2,
            seats: Array.from({ length: 60 }, (_, i) => {
              const row = Math.floor(i / 10) + 1
              const seatNum = (i % 10) + 1
              const rowLetter = String.fromCharCode(64 + row)

              let status: Seat["status"] = "available"
              if ([15, 16, 35, 36].includes(i)) {
                status = "reserved"
              }

              return {
                id: `seat-b-${i}`,
                type: "seat" as const,
                label: `${rowLetter}${seatNum}`,
                x: 600 + (seatNum - 1) * 25,
                y: 300 + (row - 1) * 25,
                z: 0,
                sectionId: "section-2",
                status,
                tier: "platea",
                pricingTier: "standard",
                row: rowLetter,
                number: seatNum.toString(),
              }
            }),
          },
        ],
      },
      {
        id: "balcon",
        name: "Balcón",
        elevation: 100,
        objects: [
          {
            id: "section-3",
            type: "curved-section",
            label: "Balcón Central",
            x: 400,
            y: 200,
            z: 100,
            tier: "balcon",
            pricingTier: "balcony",
            color: "#f59e0b",
            group: 3,
            startAngle: -60,
            endAngle: 60,
            innerRadius: 150,
            outerRadius: 250,
            seats: Array.from({ length: 40 }, (_, i) => {
              const angle = -60 + (i * 120) / 39
              const radius = 200
              const x = 400 + radius * Math.cos((angle * Math.PI) / 180)
              const y = 200 + radius * Math.sin((angle * Math.PI) / 180)
              const row = Math.floor(i / 20) + 1
              const seatNum = (i % 20) + 1
              const rowLetter = String.fromCharCode(64 + row)

              let status: Seat["status"] = "available"
              if ([10, 11, 28, 29].includes(i)) {
                status = "reserved"
              }

              return {
                id: `seat-c-${i}`,
                type: "seat" as const,
                label: `${rowLetter}${seatNum}`,
                x,
                y,
                z: 100,
                sectionId: "section-3",
                status,
                tier: "balcon",
                pricingTier: "balcony",
                row: rowLetter,
                number: seatNum.toString(),
              }
            }),
          },
        ],
      },
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
      showGrid: false,
      show3D: true,
    },
  })

  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedSeatCard, setSelectedSeatCard] = useState<{
    seat: Seat
    position: { x: number; y: number }
  } | null>(null)
  const [activeGroup, setActiveGroup] = useState<number>(1)
  const [viewFromSeat, setViewFromSeat] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: "",
    email: "",
    phone: "",
  })
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)

  // Canvas state
  const [zoom, setZoom] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const getCurrentTierObjects = useCallback(() => {
    return theaterMap.tiers[theaterMap.currentTier]?.objects || []
  }, [theaterMap.tiers, theaterMap.currentTier])

  const getAllSeats = useCallback(() => {
    return getCurrentTierObjects().flatMap((obj) =>
      obj.type === "curved-section" || obj.type === "straight-section" ? obj.seats : [],
    )
  }, [getCurrentTierObjects])

  const handleSeatClick = useCallback(
    (seatId: string, e: React.MouseEvent) => {
      e.stopPropagation()

      const allSeats = getAllSeats()
      const seat = allSeats.find((s) => s.id === seatId)

      if (!seat) return

      if (seat.status === "reserved") {
        return
      }

      const containerRect = containerRef.current?.getBoundingClientRect()
      const posX = containerRect ? e.clientX - containerRect.left : e.clientX
      const posY = containerRect ? e.clientY - containerRect.top : e.clientY
      setSelectedSeatCard({ seat, position: { x: posX, y: posY } })
    },
    [getAllSeats],
  )

  const addSeatToCart = useCallback(
    (seat: Seat) => {
      const isInCart = cart.some((item) => item.seat.id === seat.id)

      if (isInCart) {
        // Remove from cart
        setCart((prev) => prev.filter((item) => item.seat.id !== seat.id))
      } else {
        // Add to cart
        const section = getCurrentTierObjects().find(
          (obj) =>
            (obj.type === "curved-section" || obj.type === "straight-section") &&
            obj.seats.some((s) => s.id === seat.id),
        ) as Section

        const pricingTier = theaterMap.pricingTiers.find((p) => p.id === seat.pricingTier)

        if (section && pricingTier) {
          setCart((prev) => [...prev, { seat, section, pricingTier }])
        }
      }
      setSelectedSeatCard(null)
    },
    [cart, getCurrentTierObjects, theaterMap.pricingTiers],
  )

  const renderSeat = useCallback(
    (seat: Seat) => {
      const isInCart = cart.some((item) => item.seat.id === seat.id)
      const pricingTier = theaterMap.pricingTiers.find((p) => p.id === seat.pricingTier)
      const perspective = theaterMap.settings.perspective
      const cameraHeight = theaterMap.settings.cameraHeight

      const perspectiveY = seat.y - (seat.z * Math.sin((perspective * Math.PI) / 180)) / 2
      const perspectiveScale = 1 + seat.z / cameraHeight

      let statusColor = pricingTier?.color || "#6b7280"
      let cursor = "cursor-pointer"

      if (seat.status === "reserved") {
        statusColor = "#9ca3af" // Gray for reserved
        cursor = "cursor-not-allowed"
      } else if (isInCart) {
        statusColor = "#fbbf24" // Yellow for selected
      }

      return (
        <div
          key={seat.id}
          className={`absolute transition-all duration-200 hover:scale-110 ${cursor}`}
          style={{
            left: seat.x - 6,
            top: perspectiveY - 6,
            transform: `scale(${perspectiveScale})`,
            zIndex: Math.floor(seat.z + seat.y),
          }}
          onClick={(e) => handleSeatClick(seat.id, e)}
        >
          <div className="w-3 h-3 rounded-sm border border-gray-300" style={{ backgroundColor: statusColor }} />
        </div>
      )
    },
    [cart, theaterMap.pricingTiers, theaterMap.settings, handleSeatClick],
  )

  const renderStage = useCallback(
    (stage: Stage) => {
      const perspective = theaterMap.settings.perspective
      const perspectiveY = stage.y - (stage.z * Math.sin((perspective * Math.PI) / 180)) / 2

      return (
        <div
          key={stage.id}
          className="absolute border-2 border-gray-600"
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
        >
          <div className="flex items-center justify-center h-full text-white text-sm font-medium">{stage.label}</div>
        </div>
      )
    },
    [theaterMap.settings],
  )

  const cartTotal = cart.reduce((total, item) => total + item.pricingTier.price, 0)

  const handleCheckout = async () => {
    setIsProcessingPayment(true)

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setIsProcessingPayment(false)
    setOrderComplete(true)

    // Clear cart after successful order
    setTimeout(() => {
      setCart([])
      setShowCheckout(false)
      setOrderComplete(false)
      setCustomerInfo({ name: "", email: "", phone: "" })
    }, 3000)
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{theaterMap.name}</h1>
          <p className="text-sm text-muted-foreground">Selecciona tus asientos</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Tier selector */}
          <div className="flex gap-2">
            {theaterMap.tiers.map((tier, index) => (
              <Button
                key={tier.id}
                variant={theaterMap.currentTier === index ? "default" : "outline"}
                size="sm"
                onClick={() => setTheaterMap((prev) => ({ ...prev, currentTier: index }))}
              >
                {tier.name}
              </Button>
            ))}
          </div>

          {/* Cart */}
          <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
            <DialogTrigger asChild>
              <Button variant="outline" className="relative bg-transparent">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Carrito ({cart.length})
                {cart.length > 0 && <Badge className="absolute -top-2 -right-2 px-1 min-w-5 h-5">{cart.length}</Badge>}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Carrito de Compras</DialogTitle>
              </DialogHeader>

              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay asientos seleccionados</p>
              ) : (
                <div className="space-y-4">
                  {/* Cart items */}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {cart.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium">{item.seat.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.section.label} - {item.pricingTier.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${item.pricingTier.price}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCart((prev) => prev.filter((_, i) => i !== index))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center font-bold">
                    <span>Total:</span>
                    <span>${cartTotal}</span>
                  </div>

                  {!orderComplete ? (
                    <div className="space-y-4">
                      {/* Customer info form */}
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre completo</Label>
                        <Input
                          id="name"
                          value={customerInfo.name}
                          onChange={(e) => setCustomerInfo((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Tu nombre"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={customerInfo.email}
                          onChange={(e) => setCustomerInfo((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="tu@email.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                          id="phone"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="Tu teléfono"
                        />
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleCheckout}
                        disabled={isProcessingPayment || !customerInfo.name || !customerInfo.email}
                      >
                        {isProcessingPayment ? (
                          "Procesando pago..."
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Pagar ${cartTotal}
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-green-600 text-lg font-bold mb-2">¡Compra exitosa!</div>
                      <p className="text-sm text-muted-foreground">Recibirás un email con los detalles de tu compra</p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main content */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <div
          className="w-full h-full relative"
          style={{
            backgroundColor: "hsl(var(--background))",
            backgroundImage:
              `linear-gradient(to right, var(--grid-minor) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-minor) 1px, transparent 1px), linear-gradient(to right, var(--grid-major) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-major) 1px, transparent 1px)`,
            backgroundSize: "20px 20px, 20px 20px, 100px 100px, 100px 100px",
            transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: "center center",
          }}
          onClick={() => setSelectedSeatCard(null)}
        >
          {/* Render current tier objects */}
          {getCurrentTierObjects().map((obj) => {
            if (obj.type === "curved-section" || obj.type === "straight-section") {
              if (obj.group && obj.group !== activeGroup) return null
              return <div key={obj.id}>{obj.seats.map(renderSeat)}</div>
            }
            if (obj.type === "stage") {
              return renderStage(obj)
            }
            return null
          })}
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((prev) => Math.min(prev + 0.1, 2))}
            className="w-10 h-10 p-0"
          >
            +
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((prev) => Math.max(prev - 0.1, 0.5))}
            className="w-10 h-10 p-0"
          >
            -
          </Button>
          <div className="text-xs text-center text-muted-foreground">{Math.round(zoom * 100)}%</div>
        </div>

        {/* Section group switcher 1-5 */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-card/90 border rounded-lg p-2">
          {[1, 2, 3, 4, 5].map((g) => (
            <Button
              key={g}
              variant={activeGroup === g ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveGroup(g)}
              className="w-8 h-8 p-0"
            >
              {g}
            </Button>
          ))}
        </div>

        {selectedSeatCard && (
          <Card
            className="absolute z-50 w-80 shadow-lg border-2"
            style={{
              left: Math.max(
                8,
                Math.min(
                  selectedSeatCard.position.x,
                  (containerRef.current?.clientWidth || window.innerWidth) - 320 - 8,
                ),
              ),
              top: Math.max(
                8,
                Math.min(
                  selectedSeatCard.position.y,
                  (containerRef.current?.clientHeight || window.innerHeight) - 300 - 8,
                ),
              ),
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-lg">
                Asiento {selectedSeatCard.seat.label}
                <Button variant="ghost" size="sm" onClick={() => setSelectedSeatCard(null)} className="h-6 w-6 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Fila:</span>
                  <p className="font-medium">{selectedSeatCard.seat.row}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Número:</span>
                  <p className="font-medium">{selectedSeatCard.seat.number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sección:</span>
                  <p className="font-medium">
                    {
                      getCurrentTierObjects().find(
                        (obj) =>
                          (obj.type === "curved-section" || obj.type === "straight-section") &&
                          obj.seats.some((s) => s.id === selectedSeatCard.seat.id),
                      )?.label
                    }
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Precio:</span>
                  <p className="font-medium text-green-600">
                    ${theaterMap.pricingTiers.find((p) => p.id === selectedSeatCard.seat.pricingTier)?.price}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => addSeatToCart(selectedSeatCard.seat)}
                  variant={cart.some((item) => item.seat.id === selectedSeatCard.seat.id) ? "secondary" : "default"}
                >
                  {cart.some((item) => item.seat.id === selectedSeatCard.seat.id)
                    ? "Quitar del carrito"
                    : "Agregar al carrito"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewFromSeat(selectedSeatCard.seat.id)
                    setSelectedSeatCard(null)
                  }}
                  className="px-3"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t bg-card">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
            <span>Seleccionado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded-sm"></div>
            <span>Reservado</span>
          </div>
        </div>
      </div>

      {/* View from seat modal */}
      {viewFromSeat && (
        <Dialog open={!!viewFromSeat} onOpenChange={() => setViewFromSeat(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Vista desde el asiento {getAllSeats().find((s) => s.id === viewFromSeat)?.label}
              </DialogTitle>
            </DialogHeader>
            <div className="aspect-video bg-gradient-to-t from-slate-800 to-slate-600 rounded-lg flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-6xl mb-4">🎭</div>
                <p className="text-lg">Vista simulada del escenario</p>
                <p className="text-sm opacity-75">Desde {getAllSeats().find((s) => s.id === viewFromSeat)?.label}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export { SeatMapClient }
export default SeatMapClient
