import { EpisodeInputForm } from "@/components/EpisodeInputForm";
import { LandingHero } from "@/components/LandingHero";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#09090b] text-white">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.2),transparent_30%),linear-gradient(135deg,#09090b_0%,#111827_55%,#030712_100%)]" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10">
        <LandingHero />
        <EpisodeInputForm />
      </div>
    </main>
  );
}
