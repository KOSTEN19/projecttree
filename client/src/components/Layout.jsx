import React, { useMemo } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../api.js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_SRC } from "@/lib/brandLogo";

const NAV_ITEMS = [
  { label: "Главная", to: "/app/home" },
  { label: "Семья", to: "/app/relatives" },
  { label: "Древо", to: "/app/tree" },
  { label: "Карта", to: "/app/map" },
  { label: "Профиль", to: "/app/profile" },
];

const ROUTE_CRUMB_LABEL = {
  "/app/home": "Главная",
  "/app/relatives": "Семья",
  "/app/tree": "Древо",
  "/app/map": "Карта",
  "/app/profile": "Профиль",
  "/app/admin": "Админ",
};

export default function Layout({ user, onLogout, theme = "dark", onToggleTheme }) {
  const nav = useNavigate();
  const location = useLocation();

  function logout() {
    clearToken();
    onLogout?.();
    nav("/login");
  }

  const initials = ((user?.firstName || "?")[0] + (user?.lastName || "")[0]).toUpperCase();

  const navItems = user?.isAdmin
    ? [...NAV_ITEMS, { label: "Админ", to: "/app/admin" }]
    : NAV_ITEMS;

  const pathNorm = location.pathname.replace(/\/$/, "") || "/app/home";

  const crumbLabel = useMemo(() => {
    return ROUTE_CRUMB_LABEL[pathNorm] || "Раздел";
  }, [pathNorm]);

  const isHome = pathNorm === "/app/home";
  /** Древо на всю ширину и высоту между шапкой и подвалом, без крошек (они перекрывали полотно). */
  const isTreeRoute = pathNorm === "/app/tree";

  return (
    <div className="layout-shell flex min-h-screen flex-col bg-background text-foreground">
      <header className="layout-header sticky top-0 z-50 border-b">
        <div className="layout-header-inner mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div className="layout-brand hidden items-center gap-2 md:flex">
            <img
              src={BRAND_LOGO_SRC}
              alt="Память России"
              width={24}
              height={24}
              className="app-brand-logo size-6 shrink-0 rounded-sm opacity-90"
              decoding="async"
            />
            <div>
              <div className="layout-brand-title">Память России</div>
              <div className="layout-brand-sub">Семейная летопись</div>
            </div>
          </div>

          <nav className="layout-nav flex flex-wrap items-center">
            {navItems.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "layout-nav-link inline-flex items-center transition-colors",
                    isActive
                      ? "layout-nav-link-active"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="layout-user flex items-center gap-3">
            <Button variant="ghost" size="sm" className="layout-theme-btn" onClick={onToggleTheme} aria-label="Переключить тему">
              {theme === "dark" ? "Светлая" : "Тёмная"}
            </Button>
            <Avatar className="size-8">
              <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-medium">{user?.firstName || "Пользователь"}</div>
              <div className="text-muted-foreground truncate text-xs">Личный кабинет</div>
            </div>
            <Button variant="outline" size="sm" className="layout-logout-btn" onClick={logout}>
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className={cn("flex-1", isTreeRoute && "flex min-h-0 flex-col")}>
        {isTreeRoute ? (
          <div key={location.pathname} className="app-page-transition flex min-h-0 min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        ) : (
          <div className="mx-auto max-w-6xl px-4 py-6">
            <Breadcrumb className="layout-breadcrumb">
              <BreadcrumbList>
                {!isHome ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink render={(props) => <Link {...props} to="/app/home" />}>Главная</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                ) : null}
                <BreadcrumbItem>
                  <BreadcrumbPage>{crumbLabel}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div key={location.pathname} className="app-page-transition">
              <Outlet />
            </div>
          </div>
        )}
      </main>

      <footer className="layout-footer border-t py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <div className="layout-footer-brand flex items-center gap-2">
            <img
              src={BRAND_LOGO_SRC}
              alt=""
              width={20}
              height={20}
              className="app-brand-logo size-5 shrink-0 rounded opacity-70"
              decoding="async"
            />
            <span>Память России</span>
          </div>
          <span className="layout-footer-note">ProfIU BMSTU · 2024–2026</span>
        </div>
      </footer>
    </div>
  );
}
