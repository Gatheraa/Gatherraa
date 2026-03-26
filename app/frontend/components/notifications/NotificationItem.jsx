import React from "react";

const NotificationItem = ({ message, type }) => {
  const getBackground = () => {
    switch (type) {
      case "success":
        return "#16a34a";
      case "error":
        return "#dc2626";
      case "warning":
        return "#f59e0b";
      default:
        return "#2563eb";
    }
  };

  return (
    <div style={{ ...styles.notification, background: getBackground() }}>
      {message}
    </div>
  );
};

const styles = {
  notification: {
    color: "#fff",
    padding: "12px 16px",
    borderRadius: "8px",
    minWidth: "250px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
    fontSize: "14px",
  },
};

export default NotificationItem;