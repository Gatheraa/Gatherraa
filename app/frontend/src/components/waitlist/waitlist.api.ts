export type WaitlistEntry = {
  id: string;
  email: string;
  position: number;
  createdAt: string;
};

let waitlist: WaitlistEntry[] = [];

export const joinWaitlistAPI = async (email: string) => {
  const newEntry: WaitlistEntry = {
    id: crypto.randomUUID(),
    email,
    position: waitlist.length + 1,
    createdAt: new Date().toISOString(),
  };

  waitlist.push(newEntry);

  return newEntry;
};

export const getPositionAPI = async (email: string) => {
  const entry = waitlist.find((w) => w.email === email);
  return entry?.position || null;
};

export const checkAvailabilityAPI = async () => {
  // simulate availability logic
  return waitlist.length >= 5;
};