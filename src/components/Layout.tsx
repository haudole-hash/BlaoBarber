import { NavLink, Outlet } from "react-router-dom";
import { labels } from "../labels";
import { Icon } from "./Icon";
import { LOGO_URL } from "../utils";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center px-6 py-3 transition-all ${
    isActive
      ? "bg-primary-container text-on-primary-container font-bold border-r-4 border-primary translate-x-1"
      : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
  }`;

export function Layout() {
  const { app, nav } = labels;

  return (
    <div className="flex min-h-screen bg-background text-on-surface">
      <aside className="hidden md:flex flex-col h-screen w-64 shrink-0 py-8 border-r border-outline-variant bg-surface">
        <div className="px-6 mb-10 flex items-center gap-3">
          <img alt={app.brand} className="w-10 h-10 object-contain" src={LOGO_URL} />
          <div>
            <h1 className="text-headline-md font-headline-md font-bold text-primary">{app.brand}</h1>
            <p className="text-label-sm text-on-surface-variant">{app.subtitle}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink to="/" end className={navClass}>
            <Icon name="dashboard" className="mr-3" filled />
            <span className="text-label-sm">{nav.dashboard}</span>
          </NavLink>
          <NavLink to="/services" className={navClass}>
            <Icon name="content_cut" className="mr-3" />
            <span className="text-label-sm">{nav.services}</span>
          </NavLink>
          <NavLink to="/orders" className={navClass}>
            <Icon name="receipt_long" className="mr-3" />
            <span className="text-label-sm">{nav.orders}</span>
          </NavLink>
          <NavLink to="/employees" className={navClass}>
            <Icon name="groups" className="mr-3" />
            <span className="text-label-sm">{nav.employees}</span>
          </NavLink>
          <NavLink to="/depreciations" className={navClass}>
            <Icon name="request_quote" className="mr-3" />
            <span className="text-label-sm">{nav.depreciations}</span>
          </NavLink>
          <NavLink to="/profit" className={navClass}>
            <Icon name="trending_up" className="mr-3" />
            <span className="text-label-sm">{nav.profit}</span>
          </NavLink>
          <NavLink to="/maintenance" className={navClass}>
            <Icon name="delete_sweep" className="mr-3" />
            <span className="text-label-sm">{nav.maintenance}</span>
          </NavLink>
          <NavLink to="/trash" className={navClass}>
            <Icon name="delete" className="mr-3" />
            <span className="text-label-sm">{nav.trash}</span>
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 min-h-screen pb-16 md:pb-0">
        <Outlet />
      </main>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-outline-variant flex justify-around h-16 z-50">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="dashboard" filled />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.dashboard}</span>
        </NavLink>
        <NavLink
          to="/services"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="content_cut" />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.services}</span>
        </NavLink>
        <NavLink
          to="/orders"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="receipt_long" />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.orders}</span>
        </NavLink>
        <NavLink
          to="/employees"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="groups" />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.employees}</span>
        </NavLink>
        <NavLink
          to="/depreciations"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="request_quote" />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.depreciations}</span>
        </NavLink>
        <NavLink
          to="/profit"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="trending_up" />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.profit}</span>
        </NavLink>
        <NavLink
          to="/maintenance"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="delete_sweep" />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.maintenance}</span>
        </NavLink>
        <NavLink
          to="/trash"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center ${isActive ? "text-primary" : "text-on-surface-variant"}`
          }
        >
          <Icon name="delete" />
          <span className="text-[10px] font-bold uppercase mt-1">{nav.trash}</span>
        </NavLink>
      </nav>
    </div>
  );
}
