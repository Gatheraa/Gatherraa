import { useNotificationContext } from "./NotificationProvider";

const useNotification = () => {
  const { addNotification } = useNotificationContext();

  return {
    notify: addNotification,
    success: (msg) => addNotification(msg, "success"),
    error: (msg) => addNotification(msg, "error"),
    info: (msg) => addNotification(msg, "info"),
    warning: (msg) => addNotification(msg, "warning"),
  };
};

export default useNotification;