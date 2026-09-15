export default function GlobalBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none select-none">
      {/* Zero-Overhead Hardware-Accelerated Dark Carbon Fluid Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/background-poster.webp"
        className="absolute inset-0 w-full h-full object-cover transform-gpu motion-reduce:hidden"
      >
        <source src="/background.webm" type="video/webm" />
        <source src="/background.mp4" type="video/mp4" />
      </video>

      {/* Fallback Static Poster for Reduced-Motion & Battery-Saver Mode */}
      <div
        className="absolute inset-0 bg-cover bg-center hidden motion-reduce:block"
        style={{ backgroundImage: "url('/background-poster.webp')" }}
      />

      {/* Subtle industrial vignette (pre-baked dark carbon depth) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/25 to-black/75 pointer-events-none" />

      {/* Subtle industrial ambient glows */}
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[#007AFF]/10 blur-[120px] mix-blend-screen pointer-events-none animate-pulse" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[30%] h-[30%] rounded-full bg-cyan-500/5 blur-[100px] mix-blend-screen pointer-events-none" />
    </div>
  );
}

