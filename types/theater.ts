export interface Seat {
    id: string
    type: "seat"
    label: string
    x: number
    y: number
    z: number
    sectionId: string
    status: "available" | "selected" | "sold" | "blocked" | "reserved"
    tier: string
    pricingTier: string
    viewAngle?: number
    obstructed?: boolean
    row?: string
    number?: string
}

export interface Section {
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
    group?: number
    startAngle?: number
    endAngle?: number
    innerRadius?: number
    outerRadius?: number
    width?: number
    height?: number
    rows?: number
    seatsPerRow?: number
}

export interface Stage {
    id: string
    type: "stage"
    label: string
    x: number
    y: number
    z: number
    width: number
    height: number
    color: string
    shape: "rectangle" | "circle" | "arc"
}

export interface PricingTier {
    id: string
    name: string
    price: number
    color: string
}

export interface Tier {
    id: string
    name: string
    elevation: number
    objects: (Section | Stage)[]
}

export interface TheaterMap {
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

export interface CartItem {
    seat: Seat
    section: Section
    pricingTier: PricingTier
}

export interface CustomerInfo {
    name: string
    email: string
    phone: string
}


