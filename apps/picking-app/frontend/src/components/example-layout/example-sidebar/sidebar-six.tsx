import { useState } from "react";
import {
  DashboardAltIcon,
  CalendarAltIcon,
  ProfileAltIcon,
  ChartAltIcon,
  EmailAltIcon,
  InboxAltIcon,
  HeadphoneAltIcon,
  SettingsAltIcon,
  IntegrationAltIcon,
  BoxCubeIcon,
  BellAltIcon,
} from "../../../icons";
import { useSidebar } from "../../../context/SidebarContext";

type NavItemType = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItemType[] = [
  { id: "dashboard", label: "Dashboard", icon: <DashboardAltIcon /> },
  { id: "calendar", label: "Calendar", icon: <CalendarAltIcon /> },
  { id: "profiles", label: "Profiles", icon: <ProfileAltIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsAltIcon /> },
  { id: "design", label: "Design Engineering", icon: <BellAltIcon /> },
  { id: "email", label: "Email", icon: <EmailAltIcon /> },
  { id: "inbox", label: "Inbox", icon: <InboxAltIcon /> },
  { id: "support", label: "Customer Support", icon: <HeadphoneAltIcon /> },
  { id: "analytics", label: "Analytics", icon: <ChartAltIcon /> },
  { id: "integrations", label: "Integrations", icon: <IntegrationAltIcon /> },
  { id: "components", label: "Components", icon: <BoxCubeIcon /> },
];

type NavItemProps = {
  item: NavItemType;
  isActive: boolean;
  onClick: () => void;
};

function NavItem({ item, isActive, onClick }: NavItemProps) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={`nav-icon-item ${
          isActive ? "nav-icon-item-active" : "nav-icon-item-inactive"
        }`}
        aria-label={item.label}
      >
        <span className="[&_svg]:size-5">{item.icon}</span>
      </button>
      <span className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-lg bg-gray-800 px-3 py-1.5 text-sm whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {item.label}
      </span>
    </div>
  );
}

export default function SidebarSix() {
  const { isExpanded, isMobileOpen } = useSidebar();
  const [activeNav, setActiveNav] = useState("dashboard");

  // Desktop: use isExpanded to slide in/out
  // Mobile: use isMobileOpen to slide in/out
  const isVisible = isMobileOpen || isExpanded;

  return (
    <aside
      className={`fixed top-16 xl:top-0 xl:sticky left-0 z-9999 flex h-screen flex-col items-center bg-gray-50 pt-7 pb-5 transition-all duration-300 dark:bg-gray-900 ${
        isVisible
          ? "translate-x-0 w-[92px] border-r border-gray-200 dark:border-gray-800"
          : "-translate-x-full w-0 overflow-hidden border-none"
      }`}
    >
      {/* Logo */}
      <a
        href="#"
        className="bg-brand-500 mb-8 flex size-8 shrink-0 items-center justify-center rounded-xl xl:mb-16"
      >
        <img src="./images/logo/logo-icon.svg" alt="Logo" className="h-8 w-8" />
      </a>

      {/* Nav Icons */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeNav === item.id}
            onClick={() => setActiveNav(item.id)}
          />
        ))}
      </nav>
    </aside>
  );
}
