import type { UserClient } from "@/types/api";
import { clearToken } from "@/shared/api";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

export default function Layout({
  user,
  onLogout,
}: {
  user: UserClient | null;
  onLogout?: () => void;
}) {
  const nav = useNavigate();

  function logout() {
    clearToken();
    onLogout?.();
    nav("/login");
  }

  const initials = ((user?.firstName || "?")[0] + (user?.lastName || "")[0]).toUpperCase();

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-inner">
          <NavLink to="/app/home" className="navbar-brand">
            <img className="navbar-logo" src="/logo.svg" alt="" />
            <div>
              <div className="navbar-title">Память России</div>
              <div className="navbar-sub">Генеалогический портал</div>
            </div>
          </NavLink>

          <div className="navbar-links">
            <NavLink
              to="/app/home"
              className={({ isActive }) => "navbar-link" + (isActive ? " active" : "")}
            >
              Главная
            </NavLink>
            <NavLink
              to="/app/relatives"
              className={({ isActive }) => "navbar-link" + (isActive ? " active" : "")}
            >
              Моя семья
            </NavLink>
            <NavLink
              to="/app/tree"
              className={({ isActive }) => "navbar-link" + (isActive ? " active" : "")}
            >
              Древо
            </NavLink>
            <NavLink
              to="/app/map"
              className={({ isActive }) => "navbar-link" + (isActive ? " active" : "")}
            >
              Карта
            </NavLink>
            <NavLink
              to="/app/profile"
              className={({ isActive }) => "navbar-link" + (isActive ? " active" : "")}
            >
              Профиль
            </NavLink>
          </div>

          <div className="navbar-user">
            <div className="navbar-avatar">{initials}</div>
            <div>
              <div className="navbar-uname">{user?.firstName || "Пользователь"}</div>
              <div className="navbar-usub">Личный кабинет</div>
            </div>
            <button type="button" className="navbar-logout" onClick={logout}>
              Выход
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src="/logo.svg" alt="" style={{ width: 24, height: 24, borderRadius: 6, opacity: 0.6 }} />
            Память России
          </div>
          <div className="footer-text">Developed by ProfIU BMSTU &middot; 2024&ndash;2026</div>
          <div className="footer-links">
            <a href="#!">О проекте</a>
            <a href="#!">Документация</a>
            <a href="#!">Поддержка</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
