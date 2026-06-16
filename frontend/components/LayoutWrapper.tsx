"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const publicPages = ["/", "/login", "/signup"];

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublic = publicPages.includes(pathname);

  // Public pages: no sidebar, no margin, no wrapper at all
  if (isPublic) {
    return <>{children}</>;
  }

  // Authenticated app pages: sidebar + offset main
  return (
    <>
      <Sidebar />
      <main className="md:ml-60 ml-0 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </>
  );
}