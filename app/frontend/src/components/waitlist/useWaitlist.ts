import { useState } from "react";
import {
  joinWaitlistAPI,
  getPositionAPI,
  checkAvailabilityAPI,
} from "./waitlist.api";

export const useWaitlist = () => {
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);

  const joinWaitlist = async (email: string) => {
    setLoading(true);
    const res = await joinWaitlistAPI(email);
    setPosition(res.position);
    setLoading(false);
  };

  const getPosition = async (email: string) => {
    const pos = await getPositionAPI(email);
    setPosition(pos);
  };

  const checkAvailability = async () => {
    const status = await checkAvailabilityAPI();
    setAvailable(status);
  };

  return {
    loading,
    position,
    available,
    joinWaitlist,
    getPosition,
    checkAvailability,
  };
};