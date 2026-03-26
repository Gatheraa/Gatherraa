import React from "react";
import NotificationItem from "./NotificationItem";

const NotificationContainer = ({ notifications }) => {
  return (
    <div style={styles.container}>
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} {...notification} />
      ))}
    </div>
  );
};

const styles = {
  container: {
    position: "fixed",
    top: "20px",
    right: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    zIndex: 9999,
  },
};

export default NotificationContainer;