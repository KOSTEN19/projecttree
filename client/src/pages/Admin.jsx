import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function fmtBytes(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = n;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(val >= 10 ? 0 : 1)} ${units[i]}`;
}

export default function AdminPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const d = await apiGet("/api/admin/overview");
        if (alive) setData(d);
      } catch (e) {
        if (alive) setError(e?.message || "Ошибка загрузки админ-панели");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persons = useMemo(() => data?.family?.persons || [], [data]);
  const blockedHosts = useMemo(() => data?.blockedHosts || [], [data]);
  const system = data?.system || {};
  const family = data?.family || {};

  if (loading) return <div className="text-sm text-muted-foreground">Загрузка админ-панели...</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Панель администратора</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Нагрузка сервера, хосты сканеров и все добавленные родственники
        </p>
      </div>

      <Separator />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">CPU</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{Number(system.cpuPercent || 0).toFixed(1)}%</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Память (alloc/sys)</CardTitle></CardHeader>
          <CardContent className="text-sm">{fmtBytes(system.memBytes?.alloc)} / {fmtBytes(system.memBytes?.sys)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Диск (used/total)</CardTitle></CardHeader>
          <CardContent className="text-sm">{fmtBytes(system.diskBytes?.used)} / {fmtBytes(system.diskBytes?.total)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Uptime / goroutines</CardTitle></CardHeader>
          <CardContent className="text-sm">{Math.floor(Number(system.uptimeSec || 0) / 60)} мин · {system.goRoutines || 0}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Заблокированные хосты (по scanners.log)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {blockedHosts.length === 0 && <div className="text-sm text-muted-foreground">Попыток сканирования не найдено.</div>}
          {blockedHosts.slice(0, 40).map((row) => (
            <div key={row.host} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span className="font-mono">{row.host}</span>
              <Badge variant="secondary">{row.hits} hits</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Родственники в системе</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge>Пользователи: {family.usersCount || 0}</Badge>
            <Badge>Люди: {family.personsCount || 0}</Badge>
            <Badge>Связи: {family.relationshipsCount || 0}</Badge>
          </div>
          <div className="max-h-[420px] overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2">ФИО</th>
                  <th className="px-3 py-2">Город</th>
                  <th className="px-3 py-2">Дата рождения</th>
                  <th className="px-3 py-2">User ID</th>
                </tr>
              </thead>
              <tbody>
                {persons.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.fullName || "Без имени"}</td>
                    <td className="px-3 py-2">{p.birthCity || "—"}</td>
                    <td className="px-3 py-2">{p.birthDate || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.userId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
