import TabBar from "@/components/nav/tab-bar";

export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh flex-col bg-zinc-950 pt-[env(safe-area-inset-top)]">
      <div className="min-h-0 flex-1">{children}</div>
      <TabBar />
    </div>
  );
}
