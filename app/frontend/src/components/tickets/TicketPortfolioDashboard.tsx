"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  Calendar,
  Filter,
  Search,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type TicketStatus = "active" | "used" | "expired";

interface TicketItem {
  id: string;
  eventName: string;
  eventId: string;
  eventType: string;
  eventDate: string;
  status: TicketStatus;
  tokenId?: string;
  imageUrl?: string;
  venue?: string;
}

interface TicketPortfolioDashboardProps {
  tickets?: TicketItem[];
}

const statusConfig: Record<
  TicketStatus,
  {
    color: string;
    icon: React.ReactNode;
    label: string;
    badgeVariant: "success" | "error" | "warning";
  }
> = {
  active: {
    color: "text-green-600",
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "Active",
    badgeVariant: "success",
  },
  used: {
    color: "text-gray-500",
    icon: <Clock className="w-4 h-4" />,
    label: "Used",
    badgeVariant: "default" as const,
  },
  expired: {
    color: "text-red-500",
    icon: <XCircle className="w-4 h-4" />,
    label: "Expired",
    badgeVariant: "error",
  },
};

const eventTypeColors: Record<string, string> = {
  conference: "bg-blue-100 text-blue-800",
  workshop: "bg-purple-100 text-purple-800",
  meetup: "bg-green-100 text-green-800",
  hackathon: "bg-orange-100 text-orange-800",
  webinar: "bg-cyan-100 text-cyan-800",
  concert: "bg-pink-100 text-pink-800",
  default: "bg-gray-100 text-gray-800",
};

// Generate mock data for demonstration
const generateMockTickets = (): TicketItem[] => [
  {
    id: "t-001",
    eventName: "Web3 Summit 2026",
    eventId: "evt-001",
    eventType: "conference",
    eventDate: "2026-07-15",
    status: "active",
    tokenId: "0x1a2b3c4d",
    imageUrl: "/nft-placeholder.png",
    venue: "San Francisco, CA",
  },
  {
    id: "t-002",
    eventName: "DeFi Workshop",
    eventId: "evt-002",
    eventType: "workshop",
    eventDate: "2026-06-20",
    status: "used",
    tokenId: "0x5e6f7g8h",
    venue: "Online",
  },
  {
    id: "t-003",
    eventName: "NFT Artists Meetup",
    eventId: "evt-003",
    eventType: "meetup",
    eventDate: "2026-05-10",
    status: "expired",
    tokenId: "0x9i0j1k2l",
    venue: "New York, NY",
  },
  {
    id: "t-004",
    eventName: "Hackathon 2026",
    eventId: "evt-004",
    eventType: "hackathon",
    eventDate: "2026-08-01",
    status: "active",
    tokenId: "0x3m4n5o6p",
    imageUrl: "/nft-placeholder-2.png",
    venue: "Austin, TX",
  },
  {
    id: "t-005",
    eventName: "Blockchain Basics Webinar",
    eventId: "evt-005",
    eventType: "webinar",
    eventDate: "2026-04-22",
    status: "expired",
    tokenId: "0x7q8r9s0t",
    venue: "Online",
  },
  {
    id: "t-006",
    eventName: "Crypto Music Fest",
    eventId: "evt-006",
    eventType: "concert",
    eventDate: "2026-09-15",
    status: "active",
    tokenId: "0x1u2v3w4x",
    imageUrl: "/nft-placeholder-3.png",
    venue: "Miami, FL",
  },
];

const TicketPortfolioDashboard: React.FC<TicketPortfolioDashboardProps> = ({
  tickets,
}) => {
  const [ticketData, setTicketData] = useState<TicketItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateSort, setDateSort] = useState<"asc" | "desc">("desc");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTickets = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/tickets/portfolio");
        if (response.ok) {
          const data = await response.json();
          setTicketData(data.tickets || []);
        } else {
          // Use mock data when API is unavailable
          setTicketData(tickets || generateMockTickets());
        }
      } catch {
        setTicketData(tickets || generateMockTickets());
      } finally {
        setLoading(false);
      }
    };
    loadTickets();
  }, [tickets]);

  // Get unique event types for filter
  const eventTypes = useMemo(() => {
    const types = new Set(ticketData.map((t) => t.eventType));
    return Array.from(types).sort();
  }, [ticketData]);

  // Group tickets by event
  const groupedTickets = useMemo(() => {
    const filtered = ticketData.filter((ticket) => {
      const matchesSearch =
        !searchQuery ||
        ticket.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.eventType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;
      const matchesType =
        typeFilter === "all" || ticket.eventType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });

    const grouped = filtered.reduce(
      (acc, ticket) => {
        if (!acc[ticket.eventId]) {
          acc[ticket.eventId] = {
            eventId: ticket.eventId,
            eventName: ticket.eventName,
            eventType: ticket.eventType,
            eventDate: ticket.eventDate,
            venue: ticket.venue,
            tickets: [],
          };
        }
        acc[ticket.eventId].tickets.push(ticket);
        return acc;
      },
      {} as Record<
        string,
        {
          eventId: string;
          eventName: string;
          eventType: string;
          eventDate: string;
          venue?: string;
          tickets: TicketItem[];
        }
      >
    );

    return Object.values(grouped).sort((a, b) => {
      const dateA = new Date(a.eventDate).getTime();
      const dateB = new Date(b.eventDate).getTime();
      return dateSort === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [ticketData, searchQuery, statusFilter, typeFilter, dateSort]);

  const totalTickets = ticketData.length;
  const activeCount = ticketData.filter((t) => t.status === "active").length;
  const usedCount = ticketData.filter((t) => t.status === "used").length;
  const expiredCount = ticketData.filter((t) => t.status === "expired").length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">My Ticket Portfolio</h2>
          <p className="text-gray-600">
            View and manage all your event tickets across multiple events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "primary" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "primary" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Ticket className="w-4 h-4" />
              <span className="text-sm">Total</span>
            </div>
            <div className="text-2xl font-bold">{totalTickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Active</span>
            </div>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Used</span>
            </div>
            <div className="text-2xl font-bold">{usedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-sm">Expired</span>
            </div>
            <div className="text-2xl font-bold">{expiredCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as TicketStatus | "all")
          }
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="used">Used</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDateSort(dateSort === "desc" ? "asc" : "desc")}
        >
          <Calendar className="w-4 h-4 mr-1" />
          {dateSort === "desc" ? "Newest" : "Oldest"}
        </Button>
      </div>

      {/* Grouped Tickets */}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 gap-4"
            : "space-y-4"
        }
      >
        <AnimatePresence>
          {groupedTickets.map((group) => {
            const isExpanded = expandedEventId === group.eventId;
            const activeTickets = group.tickets.filter(
              (t) => t.status === "active"
            );

            return (
              <motion.div
                key={group.eventId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() =>
                    setExpandedEventId(isExpanded ? null : group.eventId)
                  }
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <CardTitle className="text-base">
                            {group.eventName}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                eventTypeColors[group.eventType] ||
                                eventTypeColors.default
                              }`}
                            >
                              {group.eventType}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(group.eventDate)}
                            </span>
                            {group.venue && (
                              <span className="text-xs text-gray-400">
                                • {group.venue}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {group.tickets.length} ticket
                          {group.tickets.length !== 1 ? "s" : ""}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <CardContent className="pt-0">
                          <div className="space-y-3 pt-2 border-t">
                            {group.tickets.map((ticket) => {
                              const config = statusConfig[ticket.status];
                              return (
                                <div
                                  key={ticket.id}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-center gap-3">
                                    {/* NFT Preview */}
                                    {ticket.imageUrl ? (
                                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden">
                                        <ImageIcon className="w-6 h-6 text-white" />
                                      </div>
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                        <Ticket className="w-6 h-6 text-gray-400" />
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                          Ticket #{ticket.id}
                                        </span>
                                        <Badge
                                          variant={config.badgeVariant}
                                          className="text-xs"
                                        >
                                          {config.icon}
                                          <span className="ml-1">
                                            {config.label}
                                          </span>
                                        </Badge>
                                      </div>
                                      {ticket.tokenId && (
                                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                                          Token: {ticket.tokenId.slice(0, 10)}...
                                          {ticket.tokenId.slice(-4)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {ticket.status === "active" && (
                                    <Button size="sm" variant="outline">
                                      View
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {groupedTickets.length === 0 && (
        <div className="text-center py-12">
          <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No tickets found
          </h3>
          <p className="text-gray-600">
            {searchQuery || statusFilter !== "all" || typeFilter !== "all"
              ? "Try adjusting your filters"
              : "Your ticket portfolio is empty. Purchase tickets to events to see them here."}
          </p>
        </div>
      )}
    </div>
  );
};

export default TicketPortfolioDashboard;
