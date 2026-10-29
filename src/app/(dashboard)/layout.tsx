import { AppSidebar, AppTopBar, PageHeading } from "@/components/AppShell";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <AppSidebar />
      <div className="min-w-0">
        <AppTopBar />
        <main className="mx-auto max-w-360 px-4 py-6 sm:px-8 lg:pt-8">
          <PageHeading />
          {children}
        </main>
      </div>
    </div>
  );
}
