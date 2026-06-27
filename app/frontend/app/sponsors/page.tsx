import { SponsorShowcase } from "@/components/sponsors/SponsorShowcase";
import { sponsors } from "@/lib/data/sponsors";

export default function SponsorsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <SponsorShowcase sponsors={sponsors} />
    </div>
  );
}