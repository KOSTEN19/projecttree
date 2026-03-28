import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { apiGet } from "./api.js";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import Profile from "./pages/Profile.jsx";
import Layout from "./components/Layout.jsx";

import Relatives from "./pages/Relatives.jsx";
import Tree from "./pages/Tree.jsx";
import MapPage from "./pages/Map.jsx";
import AdminPage from "./pages/Admin.jsx";

function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState(() => {
    const stored = window.localStorage.getItem("theme");
    return stored === "dark" || stored === "light" ? stored : "dark";
  });

  async function loadMe() {
    try {
      const data = await apiGet("/api/auth/me");
      flushSync(() => {
        setUser(data.user);
        setLoaded(true);
      });
    } catch {
      flushSync(() => {
        setUser(null);
        setLoaded(true);
      });
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  if (!loaded) {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-3 pt-6 text-center">
            <Skeleton className="mx-auto h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <p className="text-muted-foreground text-sm">Загрузка…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onAuth={loadMe} />} />
        <Route path="/register" element={<Register onAuth={loadMe} />} />

        <Route
          path="/app"
          element={
            <RequireAuth user={user}>
              <Layout
                user={user}
                onLogout={() => setUser(null)}
                theme={theme}
                onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              />
            </RequireAuth>
          }
        >
          <Route
            path="home"
            element={<Home user={user} />}
          />
          <Route path="profile" element={<Profile onProfileUpdated={loadMe} />} />
          <Route path="relatives" element={<Relatives />} />
          <Route path="tree" element={<Tree />} />
          <Route path="map" element={<MapPage />} />
          <Route
            path="admin"
            element={user?.isAdmin ? <AdminPage /> : <Navigate to="/app/home" replace />}
          />
          <Route index element={<Navigate to="/app/home" replace />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? "/app/home" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
