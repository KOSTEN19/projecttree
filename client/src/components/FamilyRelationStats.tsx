import type { ReactNode } from "react";

export type FamilyRelationStatsData = {
  father: number;
  mother: number;
  child: number;
  spouse: number;
  sibling: number;
  uncleAunt: number;
  grand: number;
  lineMale: number;
  lineFemale: number;
  total: number;
};

type Props = { stats: FamilyRelationStatsData };

function StatTile({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rel-stats-tile ${className}`.trim()}>
      <div className="rel-stats-tile-label">{label}</div>
      {children}
    </div>
  );
}

export default function FamilyRelationStats({ stats }: Props) {
  const lineSum = stats.lineMale + stats.lineFemale;
  const showRatio = lineSum > 0;

  return (
    <section className="rel-stats" aria-label="Статистика связей в семье">
      <header className="rel-stats-head">
        <div className="rel-stats-head-icon" aria-hidden>
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16 4v6M16 22v6M8 10c0-2.2 1.8-4 4-4h8c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4h-2l-2 3-2-3h-2c-2.2 0-4-1.8-4-4v-4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.85"
            />
            <circle cx="10" cy="24" r="2.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
            <circle cx="22" cy="24" r="2.5" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
          </svg>
        </div>
        <div className="rel-stats-head-text">
          <h2 className="rel-stats-heading">Сводка по связям</h2>
          <p className="rel-stats-lead">Распределение родственных линий и типов связей в вашей базе</p>
        </div>
      </header>

      <div className="rel-stats-main">
        <div className="rel-stats-total">
          <span className="rel-stats-total-ring" aria-hidden />
          <span className="rel-stats-total-num">{stats.total}</span>
          <span className="rel-stats-total-label">связей</span>
          <span className="rel-stats-total-sub">учтено в древе</span>
        </div>

        <div className="rel-stats-side">
          <div className="rel-stats-lines">
            <div className="rel-stats-line rel-stats-line--paternal">
              <div className="rel-stats-line-text">
                <span className="rel-stats-line-name">Отцовская линия</span>
                <span className="rel-stats-line-hint">по полю «линия»</span>
              </div>
              <span className="rel-stats-line-val">{stats.lineMale}</span>
            </div>
            <div className="rel-stats-line rel-stats-line--maternal">
              <div className="rel-stats-line-text">
                <span className="rel-stats-line-name">Материнская линия</span>
                <span className="rel-stats-line-hint">по полю «линия»</span>
              </div>
              <span className="rel-stats-line-val">{stats.lineFemale}</span>
            </div>
          </div>

          {showRatio ? (
            <div
              className="rel-stats-ratio"
              title={`Отцовская: ${stats.lineMale}, материнская: ${stats.lineFemale}`}
            >
              <div className="rel-stats-ratio-bar" role="presentation">
                <span
                  className="rel-stats-ratio-seg rel-stats-ratio-seg--paternal"
                  style={{ flex: Math.max(stats.lineMale, 0.001) }}
                />
                <span
                  className="rel-stats-ratio-seg rel-stats-ratio-seg--maternal"
                  style={{ flex: Math.max(stats.lineFemale, 0.001) }}
                />
              </div>
              <div className="rel-stats-ratio-legend">
                <span className="rel-stats-ratio-legend-item">
                  <span className="rel-stats-dot rel-stats-dot--paternal" />
                  отц. {stats.lineMale}
                </span>
                <span className="rel-stats-ratio-legend-item">
                  <span className="rel-stats-dot rel-stats-dot--maternal" />
                  мат. {stats.lineFemale}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rel-stats-mosaic">
        <StatTile label="Родители" className="rel-stats-tile--parents">
          <div className="rel-stats-parents">
            <div className="rel-stats-parent">
              <span className="rel-stats-tile-val">{stats.father}</span>
              <span className="rel-stats-parent-role">отец</span>
            </div>
            <div className="rel-stats-parent-divider" aria-hidden />
            <div className="rel-stats-parent">
              <span className="rel-stats-tile-val">{stats.mother}</span>
              <span className="rel-stats-parent-role">мать</span>
            </div>
          </div>
        </StatTile>

        <StatTile label="Дети">
          <div className="rel-stats-tile-val">{stats.child}</div>
          <div className="rel-stats-tile-note">сыновья и дочери</div>
        </StatTile>

        <StatTile label="Супруги">
          <div className="rel-stats-tile-val">{stats.spouse}</div>
        </StatTile>

        <StatTile label="Братья и сёстры">
          <div className="rel-stats-tile-val">{stats.sibling}</div>
        </StatTile>

        <StatTile label="Дяди и тёти">
          <div className="rel-stats-tile-val">{stats.uncleAunt}</div>
        </StatTile>

        <StatTile label="Поколения">
          <div className="rel-stats-tile-val">{stats.grand}</div>
          <div className="rel-stats-tile-note">деды, бабушки, внуки…</div>
        </StatTile>
      </div>
    </section>
  );
}
