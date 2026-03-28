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

  const crumbLabel = useMemo(() => {
    const path = location.pathname.replace(/\/$/, "") || "/app/home";
    return ROUTE_CRUMB_LABEL[path] || "Раздел";
  }, [location.pathname]);

  const isHome = location.pathname.replace(/\/$/, "") === "/app/home";

  return (
    <div className="layout-shell flex min-h-screen flex-col bg-background text-foreground">
      <header className="layout-header sticky top-0 z-50 border-b">
        <div className="layout-header-inner mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
          <div className="layout-brand hidden items-center gap-2 md:flex">
            <img src="/logo.svg" alt="" className="size-6 rounded-sm opacity-90" />
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

      <main className="flex-1">
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
      </main>

      <footer className="layout-footer border-t py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <div className="layout-footer-brand flex items-center gap-2">
            <img src="/logo.svg" alt="" className="size-5 rounded opacity-70" />
            <span>Память России</span>
          </div>
          <span className="layout-footer-note">ProfIU BMSTU · 2024–2026</span>
        </div>
      </footer>
    </div>
  );
}
