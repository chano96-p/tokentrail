import { AppHeader } from "@/components/AppHeader";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}
