import React from "react";

const TicketDetailRow = ({ label, value }) => {
  return (
    <div className="flex justify-between items-center border-b border-gray-700 pb-1">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="font-medium text-gray-200 text-sm">{value}</span>
    </div>
  );
};

export default TicketDetailRow;