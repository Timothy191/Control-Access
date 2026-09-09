export default function GlobalBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: "brightness(0.65) contrast(1.1)" }}
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>

      {/* Fallback CSS background (behind video if it fails, or overlaid if opacity adjusted) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] via-black to-black opacity-80" />

      {/* Red ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-red-primary/10 blur-[120px] mix-blend-screen animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-red-dark/10 blur-[100px] mix-blend-screen" />
    </div>
  );
}
