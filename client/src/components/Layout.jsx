import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../api.js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Главная", to: "/app/home" },
  { label: "Семья", to: "/app/relatives" },
  { label: "Древо", to: "/app/tree" },
  { label: "Карта", to: "/app/map" },
  { label: "Профиль", to: "/app/profile" },
];

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map(({ label, to }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onToggleTheme} aria-label="Переключить тему">
              {theme === "dark" ? "Светлая" : "Тёмная"}
            </Button>
            <Avatar className="size-8">
              <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-medium">{user?.firstName || "Пользователь"}</div>
              <div className="text-muted-foreground truncate text-xs">Личный кабинет</div>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              Выход
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div key={location.pathname} className="app-page-transition">
            <Outlet />
          </div>
        </div>
      </main>

      <footer className="border-t py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="size-5 rounded opacity-70" />
            <span>Память России</span>
          </div>
          <span>ProfIU BMSTU · 2024–2026</span>
        </div>
      </footer>
    </div>
  );
}
