import { SidebarProvider, useSidebar } from "../../context/SidebarContext";
import PageMeta from "../../components/common/PageMeta";
import HeaderSix from "../../components/example-layout/example-header/header-six";
import Backdrop from "../../layout/Backdrop";
import SidebarTwo from "../../components/example-layout/example-sidebar/sidebar-two";

const LayoutTwoContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex bg-gray-50 dark:bg-gray-950">
      <SidebarTwo />
      <Backdrop />
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "xl:ml-[290px]" : "xl:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <HeaderSix />
        <main className="flex-1 p-4 md:p-6 pb-20 w-full mx-auto max-w-screen-2xl">
          {/* Page content goes here */}
          <div className="space-y-6">
            <div className="grid auto-rows-min gap-6 sm:grid-cols-2 xl:grid-cols-4">
              <div className="h-40 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3"></div>
              <div className="h-40 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3"></div>
              <div className="h-40 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3"></div>
              <div className="h-40 rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3"></div>
            </div>

            <div className="grid auto-rows-min gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <div className="min-h-dvh rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3"></div>
              <div className="min-h-dvh rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3"></div>
              <div className="min-h-dvh rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3"></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default function LayoutTwo() {
  return (
    <>
      <PageMeta
        title="React.js Layout Two Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Layout Two Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <SidebarProvider>
        <LayoutTwoContent />
      </SidebarProvider>
    </>
  );
}
