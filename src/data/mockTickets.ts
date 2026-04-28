import type { TicketRecord } from "../types/ticket";

export const initialTickets: TicketRecord[] = [
  {
    id: "ticket-pvg-syd",
    ticketType: "flight",
    carrierName: "China Eastern",
    code: "MU561",
    departure: {
      name: "Shanghai Pudong International Airport",
      code: "PVG",
      timezone: "Asia/Shanghai",
    },
    arrival: {
      name: "Sydney Airport",
      code: "SYD",
      timezone: "Australia/Sydney",
    },
    departureTimeLocal: "2026-05-08T10:30",
    arrivalTimeLocal: "2026-05-08T21:00",
    classInfo: "Economy",
    seatInfo: "12A",
    notes: "Window seat",
    routeLabel: "Shanghai Pudong International Airport -> Sydney Airport",
    status: "saved",
    createdAt: "2026-04-29T10:00:00.000Z",
    updatedAt: "2026-04-29T10:00:00.000Z",
  },
  {
    id: "ticket-shhq-nj",
    ticketType: "train",
    carrierName: "China Railway",
    code: "G7012",
    departure: {
      name: "Shanghai Hongqiao",
      code: "SHH",
      timezone: "Asia/Shanghai",
    },
    arrival: {
      name: "Nanjing South",
      code: "NKH",
      timezone: "Asia/Shanghai",
    },
    departureTimeLocal: "2026-05-16T09:15",
    arrivalTimeLocal: "2026-05-16T10:28",
    classInfo: "Second Class",
    seatInfo: "05C",
    notes: "Morning meeting trip",
    routeLabel: "Shanghai Hongqiao -> Nanjing South",
    status: "saved",
    createdAt: "2026-04-29T10:05:00.000Z",
    updatedAt: "2026-04-29T10:05:00.000Z",
  },
];
