"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { labelHex } from "@/lib/labels";
import type { BoardAnalytics } from "@/server/analytics-actions";

type Props = {
  analytics: BoardAnalytics;
};

export function AnalyticsView({ analytics }: Props) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
          Сводка
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat
            label="Активных"
            value={analytics.totals.activeCards}
            hint="Карточки на доске сейчас (не в архиве)"
          />
          <Stat
            label="В архиве"
            value={analytics.totals.archivedCards}
            hint="Спрятанные карточки — можно вернуть"
          />
          <Stat
            label="Колонок"
            value={analytics.totals.totalColumns}
            hint="Этапы потока работы"
          />
          <Stat
            label="Участников"
            value={analytics.totals.activeMembers}
            hint="Все, у кого есть доступ к доске"
          />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Поток работы по неделям
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
          Сколько карточек появилось и сколько ушло в архив за каждую из
          последних 8 недель. Если «Создано» растёт, а «В архив» — нет, значит
          задачи накапливаются. Если наоборот — команда разбирает завалы.
        </p>
        <div className="rounded-lg border border-border/60 p-4 bg-card">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics.throughput}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                opacity={0.1}
              />
              <XAxis
                dataKey="week"
                tick={{ fill: "currentColor", fontSize: 11 }}
                stroke="currentColor"
                opacity={0.5}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 11 }}
                stroke="currentColor"
                opacity={0.5}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(label) => `Неделя с ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="created"
                name="Создано карточек"
                fill="hsl(200 60% 55%)"
              />
              <Bar
                dataKey="archived"
                name="Ушло в архив"
                fill="hsl(140 50% 45%)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            По меткам
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Сколько активных карточек носят каждую метку. Если «срочно» больше
            всех — стоит разгребать.
          </p>
          {analytics.byLabel.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Меток на карточках пока нет.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {analytics.byLabel.map((l) => {
                const max = analytics.byLabel[0].count;
                const w = (l.count / max) * 100;
                return (
                  <li key={l.name} className="text-sm">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="truncate">{l.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {l.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${w}%`,
                          background: labelHex(l.color),
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
            По исполнителям
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Сколько активных карточек назначено каждому участнику.
          </p>
          {analytics.byAssignee.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Никому ничего не назначено.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {analytics.byAssignee.map((a) => {
                const max = analytics.byAssignee[0].count;
                const w = (a.count / max) * 100;
                return (
                  <li
                    key={a.userId ?? "none"}
                    className="text-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="truncate">{a.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {a.count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-brand"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="font-display text-3xl tracking-tight mt-1">{value}</div>
      {hint ? (
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
