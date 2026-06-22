// ── PCI Company Knowledge Base ─────────────────────────────────────
// Comprehensive, authoritative data about Premier Choice International.
// Scraped from premierchoiceint.com + company profile PDFs.
// Injected into Gemini's system prompt so the bot never hallucinates company facts.

export const PCI_KNOWLEDGE = {
  company: {
    name: "Premier Choice International",
    shortName: "PCI",
    founded: 2011,
    foundedIn: "Pakistan",
    expandedToDubai: 2021,
    certification: "ISO 9001:2015 (Quality Management Systems)",
    philosophy: "Client-centric approach, delivering superior investment returns and stress-free real estate experiences through comprehensive end-to-end service.",
    globalPresence: ["Pakistan", "United Arab Emirates (UAE)", "Canada", "United States"],
    totalProjects: "25+",
    website: "https://premierchoiceint.com",
  },

  leadership: [
    { name: "Mr. Amran Zia", role: "Founder & CEO" },
    { name: "Mahhad Imran", role: "Managing Director" },
  ],

  coreServices: [
    "Real Estate Development — Residential, commercial, and mixed-use projects from design to delivery",
    "Expert Investment Management — Consultancy for investors, market trend advice, superior returns",
    "Project & Development Management — Comprehensive design and development services",
    "Rental and Leasing Assistance — Professional bridge between property owners and tenants",
    "Property Facilities Management — Ongoing maintenance and operational care of properties",
    "International Brokerage — Buying and selling properties internationally",
  ],

  contact: {
    email: "info@premierchoiceint.com",
    phones: {
      pakistanLandline: "+(92) 51 8738545 / 459",
      generalSales: "+92 301 123 3333",
      dubaiHeadOffice: "+971 4 591 7499",
    },
    offices: {
      pakistan: "Plot No. 67 A-1, Bahria Food Street, Bahria Springs North Commercial, Phase 7, Bahria Town, Islamabad, Pakistan",
      dubai: "Office 1013, Onyx Tower 1, The Greens, Dubai, United Arab Emirates",
    },
    businessHours: "Monday to Saturday: 9:00 AM to 8:00 PM",
  },

  achievements: [
    "25+ development projects in portfolio",
    "International expansion from Pakistan to Dubai, Canada, and USA",
    "Partnership with Ramada by Wyndham (River Courtyard) — Pakistan's first internationally approved serviced apartments",
    "Partnership with Hilton Garden Inn (Grand Orchard)",
    "ISO 9001:2015 certified",
    "First thermal club in Pakistan (The Rohtas Thermal Club at River Courtyard)",
  ],

  projects: {
    completed: [
      {
        name: "68 High Street",
        location: "Bahria Food Street, Phase 7, Bahria Town, Islamabad",
        type: "Mall (Luxury Retail & Dining)",
        area: "200,000 sq. ft.",
        structure: "7-story building",
        features: "Dine-in and takeaway restaurants, retail outlets, entertainment facilities, river-facing corniche boardwalk",
      },
      {
        name: "Box Park",
        location: "Bahria Food Street, Phase 7, Bahria Town, Islamabad",
        type: "Mall",
        area: "130,000 sq. ft.",
      },
      {
        name: "River Hills 1-4",
        location: "Bahria Town Phase 7, Islamabad",
        type: "Residential",
      },
      {
        name: "River Loft",
        location: "Bahria Intellectual Village, Phase 7, Islamabad",
        type: "Residential",
      },
    ],
    underConstruction: [
      {
        name: "River Courtyard (Tower 1)",
        location: "Bahria Intellectual Village, Corniche Road, Phase 7, Bahria Town, Islamabad",
        type: "Ultra-luxurious mixed-use high-rise (Residential + Serviced Apartments)",
        structure: "15-storey building (2 basement parking, Lower Ground, Ground, 15 upper floors)",
        area: "~450,000 sq. ft.",
        partnership: "Licensed by Ramada by Wyndham — Pakistan's first internationally approved serviced apartments",
        unitTypes: "1, 2, and 3-bedroom apartments",
        keyAmenities: [
          "The Rohtas Thermal Club — Pakistan's first-ever thermal club",
          "Full health and spa club",
          "Indoor temperature-controlled swimming pool",
          "Walking and jogging tracks",
          "Tennis, basketball, and skating courts",
          "Fine-dining restaurants",
          "Gated security with 24/7 CCTV surveillance",
          "Landscape gardens and children's play areas",
          "Corniche Walk access",
        ],
        proximity: "~1 min from DHA-1, ~3 min from Main GT Road, ~12 min from Saddar Rawalpindi",
      },
      {
        name: "River Courtyard II (Tower 2)",
        location: "Bahria Intellectual Village, Phase 7, Islamabad",
        type: "Resort-style serviced and residential apartments",
        structure: "3 basement parking + Ground + 18 upper floors + amenities floor",
        area: "400,000 sq. ft.",
      },
      {
        name: "Grand Orchard",
        location: "Orchard Boulevard, DHA Phase 1, Islamabad (at the entrance of DHA Phase 1)",
        type: "Mixed-use (Hotel + Luxury Apartments + Retail + Office)",
        partnership: "Hilton Garden Inn (Tower A) — 115-120 guest rooms, all-day dining, rooftop café, fitness center, pool, meeting rooms. Anticipated opening: ~2027",
        amenities: "Swimming pool, paddle pool, gym, landscaped gardens, 24/7 security, 24/7 help desk, guest sitting areas",
        proximity: "Near GT Road, Fauji Foundation University/Hospital, Al Shifa Eye Hospital",
      },
      {
        name: "Gateway",
        location: "Jumeirah Village Circle (JVC), District 10, Dubai, UAE",
        type: "Residential (Tech-enabled, mixed-use)",
        structure: "Ground floor + 4 podium parking + 11 residential floors + recreational zone on top",
        unitTypes: "Studio, 1, 2, 3-bedroom apartments + 2 and 3-bedroom duplexes",
        smartFeatures: [
          "Card access control",
          "Amazon Echo Show 10 (3rd gen) + Orvibo smart home technology",
          "Customizable interior themes (light/radiant or dark/alluring)",
          "Open or closed kitchen layout options",
          "Automated human-free grocery store",
        ],
        amenities: [
          "Rooftop infinity pool",
          "Rooftop cinema",
          "Sky barbecue deck",
          "Padel tennis court",
          "Indoor & outdoor gymnasiums",
          "Jogging trails",
          "Kids' play areas & splash pools",
          "Multi-purpose lounge",
          "Co-working area",
          "24/7 security, high-speed elevators",
        ],
        paymentPlans: "Flexible 60/40 or 50/50 plans, ~10% down payment",
        nearby: "JSS International School, major community outlets",
      },
      {
        name: "Barari Views",
        location: "Majan, Al Barari, Dubai, UAE",
        type: "Residential",
        structure: "G+6 Floors",
        area: "56,000 sq. ft.",
      },
      {
        name: "Buraq Heights",
        location: "Bahria Intellectual Village, Phase 7, Islamabad",
        type: "Residential & Commercial (resort-style serviced apartments)",
        structure: "2 Basement Parking + G + 11 + Penthouse",
        area: "200,000 sq. ft.",
        features: "Resort-style facilities, river-front views",
      },
      {
        name: "Box Park II",
        location: "Bahria Food Street, Phase 7, Bahria Town, Islamabad",
        type: "Commercial",
        structure: "Lower Ground + Ground + Mezzanine + 3 Floors",
        area: "30,000 sq. ft.",
      },
      {
        name: "Spring Arch",
        location: "District Commercial, Bahria Town Phase 8, Islamabad",
        type: "Commercial & Residential",
        structure: "LG + G + 8 Floors (9 floors total)",
        area: "80,000 sq. ft.",
      },
      {
        name: "River Hills 5",
        location: "DHA Phase 1, Sector F, Islamabad",
        type: "Residential",
        structure: "12-story building",
      },
      {
        name: "River Hills 6",
        type: "Residential",
      },
      {
        name: "Bahria Intellectual Village",
        location: "Phase 7, Bahria Town, Islamabad",
        type: "Residential",
      },
    ],
  },

  faqs: [
    {
      q: "What does PCI do?",
      a: "Premier Choice International is an international real estate development company specializing in high-end residential and commercial projects in Pakistan and the UAE. We offer end-to-end services from investment management to property maintenance.",
    },
    {
      q: "Where are PCI's offices?",
      a: "PCI has offices in Islamabad, Pakistan (Bahria Food Street, Phase 7, Bahria Town) and Dubai, UAE (Office 1013, Onyx Tower 1, The Greens).",
    },
    {
      q: "What projects are currently under construction?",
      a: "River Courtyard (Tower 1 & 2), Grand Orchard (with Hilton Garden Inn), Gateway (Dubai, JVC), Barari Views (Dubai), Buraq Heights, Box Park II, Spring Arch, River Hills 5 & 6, and Bahria Intellectual Village.",
    },
    {
      q: "What international partnerships does PCI have?",
      a: "PCI is partnered with Ramada by Wyndham for River Courtyard (Pakistan's first internationally approved serviced apartments) and Hilton Garden Inn for Grand Orchard in DHA Phase 1, Islamabad.",
    },
    {
      q: "What payment plans are available?",
      a: "Payment plans vary by project. Generally, PCI offers full payment and installment plans (typically 30-50% down payment, with 6-36 month installment options). For Dubai's Gateway project, flexible 60/40 or 50/50 plans are available with ~10% down payment. Use the payment calculator for specific unit pricing.",
    },
    {
      q: "Is PCI ISO certified?",
      a: "Yes, PCI holds ISO 9001:2015 certification for Quality Management Systems, reflecting our commitment to construction efficiency, high-quality standards, and customer satisfaction.",
    },
    {
      q: "Who founded PCI?",
      a: "PCI was founded in 2011 by Mr. Amran Zia, who serves as the CEO. Mahhad Imran is the Managing Director.",
    },
    {
      q: "What is The Rohtas Thermal Club?",
      a: "The Rohtas Thermal Club at River Courtyard is Pakistan's first-ever thermal club, featuring a full health and spa experience, indoor temperature-controlled swimming pool, and premium wellness facilities.",
    },
    {
      q: "Does PCI operate in Dubai?",
      a: "Yes, PCI expanded to Dubai in 2021. Current Dubai projects include Gateway (JVC, District 10) and Barari Views (Majan, Al Barari).",
    },
    {
      q: "How can I contact PCI?",
      a: "Email: info@premierchoiceint.com. Pakistan: +92 301 123 3333. Dubai: +971 4 591 7499. Business hours: Monday to Saturday, 9:00 AM to 8:00 PM.",
    },
    {
      q: "What are the business hours?",
      a: "Monday to Saturday: 9:00 AM to 8:00 PM.",
    },
    {
      q: "Can I visit the project sites?",
      a: "Yes! PCI encourages site visits. You can also take a virtual 360° live tour at digimag360.com. Contact us to schedule an in-person visit.",
    },
    {
      q: "What is the cancellation/refund policy?",
      a: "For payment concerns, cancellations, or refund queries, please contact the Customer Care team directly at +92 301 123 3333 or email info@premierchoiceint.com. A dedicated care specialist will assist you.",
    },
  ],
} as const;
