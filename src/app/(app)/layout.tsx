import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <TopBar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </>
  );
}
