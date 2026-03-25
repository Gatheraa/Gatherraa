import React from "react";
import TicketDetailRow from "./TicketDetailRow";

const TicketPreview = ({ ticket }) => {
  // ticket = { name, event, date, holder, seat, qrCodeUrl }

  return (
    <div className="w-full max-w-sm mx-auto bg-gray-900 rounded-2xl shadow-lg p-6 text-gray-200">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-green-400">{ticket.name}</h2>
        <p className="text-sm text-gray-400">{ticket.event}</p>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        <TicketDetailRow label="Date" value={ticket.date} />
        <TicketDetailRow label="Holder" value={ticket.holder} />
        <TicketDetailRow label="Seat" value={ticket.seat} />
      </div>

      {/* QR Code / Image */}
      {ticket.qrCodeUrl && (
        <div className="flex justify-center mt-4">
          <img
            src={ticket.qrCodeUrl}
            alt="QR Code"
            className="w-32 h-32 rounded-lg border border-gray-700"
          />
        </div>
      )}
    </div>
  );
};

export default TicketPreview;