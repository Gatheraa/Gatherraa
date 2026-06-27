import { useState } from "react";
import { useWaitlist } from "./useWaitlist";

export const JoinWaitlist = () => {
  const [email, setEmail] = useState("");
  const { joinWaitlist, loading, position } = useWaitlist();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await joinWaitlist(email);
  };

  return (
    <div className="waitlist-card">
      <h2>Join Waitlist</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button disabled={loading}>
          {loading ? "Joining..." : "Join Waitlist"}
        </button>
      </form>

      {position && (
        <p className="success">
          You are # {position} on the waitlist 🎉
        </p>
      )}
    </div>
  );
};