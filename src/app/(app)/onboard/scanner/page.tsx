import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminZeroTouchSection from "@/components/admin/AdminZeroTouchSection";
import { getTunnelUrl } from "@/lib/tunnel";
import { IconArrowLeft, IconDeviceMobile, IconExternalLink } from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export default async function ScannerOnboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/onboard/scanner")}`);
  }

  const tunnelUrl = await getTunnelUrl();
  const serverUrl = process.env.BASE_URL || "http://127.0.0.1:8080";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/onboard"
              className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1 font-mono"
            >
              <IconArrowLeft size={14} />
              <span>Back to Onboarding Hub</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Scanner Onboarding &amp; Zero-Touch Provisioning
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            Pair and configure mobile Android Chainway C66 terminals for mine gate access control.
          </p>
        </div>

        <Link
          href="/scanner"
          target="_blank"
          className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] text-white text-xs font-semibold font-mono flex items-center gap-2 transition shadow-md self-start sm:self-auto"
        >
          <IconDeviceMobile size={18} />
          <span>Launch Fullscreen Kiosk</span>
          <IconExternalLink size={14} />
        </Link>
      </div>

      {/* Embedded Zero-Touch Setup Generator */}
      <AdminZeroTouchSection
        serverUrl={serverUrl}
        tunnelUrl={tunnelUrl}
        defaultGate="GATE-MAIN-01"
      />
    </div>
  );
}
