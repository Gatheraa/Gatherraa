"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Hash,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";

export type MintingState = "pending" | "processing" | "confirmed" | "failed";

export interface MintingStatus {
  id: string;
  ticketId?: string;
  eventName: string;
  state: MintingState;
  txHash?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  maxRetries: number;
}

interface MintingStatusTrackerProps {
  statuses: MintingStatus[];
  onRetry?: (id: string) => void;
  onViewTx?: (txHash: string) => void;
}

const stateConfig: Record<
  MintingState,
  {
    color: string;
    icon: React.ReactNode;
    label: string;
    progress: number;
  }
> = {
  pending: {
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <Clock className="w-4 h-4" />,
    label: "Pending",
    progress: 10,
  },
  processing: {
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: "Processing",
    progress: 50,
  },
  confirmed: {
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 className="w-4 h-4" />,
    label: "Confirmed",
    progress: 100,
  },
  failed: {
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="w-4 h-4" />,
    label: "Failed",
    progress: 0,
  },
};

const MintingStatusTracker: React.FC<MintingStatusTrackerProps> = ({
  statuses,
  onRetry,
  onViewTx,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const truncateHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const activeCount = statuses.filter(
    (s) => s.state === "pending" || s.state === "processing"
  ).length;
  const confirmedCount = statuses.filter(
    (s) => s.state === "confirmed"
  ).length;
  const failedCount = statuses.filter((s) => s.state === "failed").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Minting Status</h2>
        <div className="flex gap-2">
          {activeCount > 0 && (
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {activeCount} active
            </Badge>
          )}
          {confirmedCount > 0 && (
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {confirmedCount} confirmed
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge className="bg-red-100 text-red-800 border-red-200">
              <XCircle className="w-3 h-3 mr-1" />
              {failedCount} failed
            </Badge>
          )}
        </div>
      </div>

      {/* Status List */}
      <div className="space-y-3">
        {statuses.map((status) => {
          const config = stateConfig[status.state];
          const isExpanded = expandedId === status.id;
          const canRetry =
            status.state === "failed" &&
            status.retryCount < status.maxRetries;

          return (
            <motion.div
              key={status.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  status.state === "confirmed"
                    ? "border-green-200"
                    : status.state === "failed"
                    ? "border-red-200"
                    : status.state === "processing"
                    ? "border-blue-200"
                    : ""
                }`}
                onClick={() => setExpandedId(isExpanded ? null : status.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={config.color}>
                        {config.icon}
                        <span className="ml-1">{config.label}</span>
                      </Badge>
                      <div>
                        <CardTitle className="text-base">
                          {status.eventName}
                        </CardTitle>
                        {status.ticketId && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Ticket #{status.ticketId}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(status.updatedAt)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{config.progress}%</span>
                    </div>
                    <Progress
                      value={config.progress}
                      className={
                        status.state === "failed"
                          ? "[&>div]:bg-red-500"
                          : status.state === "confirmed"
                          ? "[&>div]:bg-green-500"
                          : ""
                      }
                    />
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 pt-2 border-t"
                    >
                      {/* Transaction Hash */}
                      {status.txHash && (
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Tx:</span>
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                            {truncateHash(status.txHash)}
                          </code>
                          {onViewTx && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewTx(status.txHash!);
                              }}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Error Message */}
                      {status.error && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3">
                          <p className="text-sm text-red-700">
                            <XCircle className="w-4 h-4 inline mr-1" />
                            {status.error}
                          </p>
                        </div>
                      )}

                      {/* Retry Info */}
                      {status.state === "failed" && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Retries: {status.retryCount}/{status.maxRetries}
                          </span>
                          {canRetry && onRetry && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRetry(status.id);
                              }}
                            >
                              <RefreshCw className="w-3.5 h-3.5 mr-1" />
                              Retry
                            </Button>
                          )}
                          {!canRetry && status.retryCount >= status.maxRetries && (
                            <span className="text-xs text-red-600">
                              Max retries reached
                            </span>
                          )}
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">Created:</span>{" "}
                          {formatTime(status.createdAt)}
                        </div>
                        <div>
                          <span className="font-medium">Updated:</span>{" "}
                          {formatTime(status.updatedAt)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {statuses.length === 0 && (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No minting activity
          </h3>
          <p className="text-gray-600">
            Minting status will appear here when you start minting tickets.
          </p>
        </div>
      )}
    </div>
  );
};

export default MintingStatusTracker;
