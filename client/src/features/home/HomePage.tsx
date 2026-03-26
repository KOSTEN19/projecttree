import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "@/shared/api";
import type { PersonClient, TreeApiResponse, UserClient } from "@/types/api";

export default function HomePage({ user }: { user: UserClient | null }) {
  const [stats, setStats] = useState({ people: 0, rels: 0 });

  useEffect(() => {
    void (async () => {
      try {
        const [persons, tree] = await Promise.all([
          apiGet<PersonClient[]>("/api/persons"),
          apiGet<TreeApiResponse>("/api/tree"),
        ]);
        const relatives = (persons || []).filter((p) => !p.isSelf && !p.isPlaceholder);
        setStats({
          people: relatives.length,
          rels: (tree?.relationships || []).length,
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <>
      <div className="dash-hero">
        <div className="dash-welcome">
          {user?.firstName ? `Добро пожаловать, ${user.firstName}!` : "Добро пожаловать!"}
        </div>
        <div className="dash-subtitle">
          «Память России» — цифровая платформа для сохранения и исследования истории вашей семьи. Создавайте генеалогическое
          древо, наносите родственников на карту и храните семейные записи.
        </div>

        <div className="dash-stats">
          <div className="dash-stat">
            <div className="dash-stat-icon blue">👥</div>
            <div>
              <div className="dash-stat-val">{stats.people}</div>
              <div className="dash-stat-label">Родственников</div>
            </div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-icon gold">🔗</div>
            <div>
              <div className="dash-stat-val">{stats.rels}</div>
              <div className="dash-stat-label">Связей</div>
            </div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-icon green">🛡️</div>
            <div>
              <div className="dash-stat-val" style={{ fontSize: 16 }}>
                Защищено
              </div>
              <div className="dash-stat-label">Локальное хранение</div>
            </div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-icon purple">📊</div>
            <div>
              <div className="dash-stat-val" style={{ fontSize: 16 }}>
                v2.0
              </div>
              <div className="dash-stat-label">Версия платформы</div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-title">Возможности платформы</div>

      <div className="dash-grid">
        <Link to="/app/relatives" className="dash-card">
          <div className="dash-card-icon blue">👨‍👩‍👧‍👦</div>
          <div className="dash-card-title">Моя семья</div>
          <div className="dash-card-desc">
            Создавайте цифровые профили для каждого члена семьи. Указывайте ФИО, даты, места рождения и захоронения, контакты и
            заметки.
          </div>
          <div className="dash-card-arrow">Перейти →</div>
        </Link>

        <Link to="/app/tree" className="dash-card">
          <div className="dash-card-icon gold">🌳</div>
          <div className="dash-card-title">Генеалогическое древо</div>
          <div className="dash-card-desc">
            Интерактивная визуализация вашей семьи. Перетаскивайте узлы, масштабируйте, просматривайте карточки — с маркерами
            эпох и поколений.
          </div>
          <div className="dash-card-arrow">Открыть древо →</div>
        </Link>

        <Link to="/app/map" className="dash-card">
          <div className="dash-card-icon purple">🗺️</div>
          <div className="dash-card-title">Интерактивная карта</div>
          <div className="dash-card-desc">
            География вашей семьи на карте России. Кластеры по городам, фильтры по месту рождения и захоронения, боковая панель
            с деталями.
          </div>
          <div className="dash-card-arrow">Открыть карту →</div>
        </Link>

        <Link to="/app/profile" className="dash-card">
          <div className="dash-card-icon green">⚙️</div>
          <div className="dash-card-title">Мой профиль</div>
          <div className="dash-card-desc">
            Управляйте личными данными. Ваш профиль — центральный узел генеалогического древа, от которого строятся все связи.
          </div>
          <div className="dash-card-arrow">Настроить →</div>
        </Link>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: "28px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          animation: "slideUp 0.6s ease-out backwards",
          animationDelay: "0.3s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 36 }}>🏛️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>О проекте «Память России»</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.7 }}>
              Платформа создана в рамках учебного проекта ПрофИУ МГТУ им. Н.Э. Баумана. Цель — предоставить удобный инструмент для
              цифровизации семейной истории граждан России. Все данные хранятся локально и защищены.
            </div>
          </div>
        </div>
      </div>

      <section className="home-static">
        <div className="section-title">Методология и правила заполнения</div>
        <div className="home-static-grid">
          <article className="home-static-card">
            <h3>Принципы достоверности</h3>
            <p>
              Указывайте точные ФИО, проверенные даты и реальные населённые пункты. Если сведения неполные, лучше оставить поле
              пустым, чем заполнять предположением.
            </p>
            <ul>
              <li>проверяйте даты по документам;</li>
              <li>добавляйте заметки с источником сведений;</li>
              <li>используйте единый формат написания имён.</li>
            </ul>
          </article>
          <article className="home-static-card">
            <h3>Как формировать качественное древо</h3>
            <p>
              Начните с себя, затем добавляйте родителей, бабушек и дедушек, после чего переходите к боковым ветвям. Такой подход
              уменьшает ошибки в связях.
            </p>
            <ul>
              <li>сначала прямая линия родства;</li>
              <li>потом братья, сёстры, дяди и тёти;</li>
              <li>в конце — двоюродные и дальние ветви.</li>
            </ul>
          </article>
          <article className="home-static-card">
            <h3>Работа с географией семьи</h3>
            <p>
              Используйте карту для визуальной оценки миграции семьи во времени: от места рождения до места захоронения. Это
              позволяет увидеть исторические траектории рода.
            </p>
            <ul>
              <li>сравнивайте поколение к поколению;</li>
              <li>отмечайте регионы переселений;</li>
              <li>проверяйте кластеры крупных городов.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="home-static">
        <div className="section-title">Справочный раздел</div>
        <div className="home-faq-grid">
          <article className="home-faq-card">
            <h4>Зачем нужны заметки у родственника?</h4>
            <p>
              В заметках можно хранить краткую биографию, профессию, военную службу, информацию о наградах, семейные легенды и
              ссылки на документы.
            </p>
          </article>
          <article className="home-faq-card">
            <h4>Какие поля обязательны для добавления?</h4>
            <p>
              Минимально достаточно имени и типа родственной связи. Остальные данные можно постепенно дополнять по мере уточнения
              семейных архивов.
            </p>
          </article>
          <article className="home-faq-card">
            <h4>Как читать маркеры эпох в древе?</h4>
            <p>
              Маркеры показывают ориентировочную временную эпоху поколения (век или десятилетие), рассчитанную по датам рождения
              узлов этого уровня.
            </p>
          </article>
          <article className="home-faq-card">
            <h4>Как защитить персональные данные?</h4>
            <p>
              Используйте уникальные логины/пароли, не публикуйте чувствительные контакты в заметках и периодически проверяйте
              корректность данных в профиле.
            </p>
          </article>
        </div>
      </section>

      <section className="home-static">
        <div className="section-title">Дорожная карта платформы</div>
        <div className="home-roadmap">
          <div className="home-roadmap-item">
            <div className="home-roadmap-dot" />
            <div>
              <div className="home-roadmap-title">Этап 1. Базовая цифровизация семьи</div>
              <div className="home-roadmap-text">
                Создание профилей родственников, первичное построение связей и визуализация генеалогического дерева.
              </div>
            </div>
          </div>
          <div className="home-roadmap-item">
            <div className="home-roadmap-dot" />
            <div>
              <div className="home-roadmap-title">Этап 2. Историко-географический слой</div>
              <div className="home-roadmap-text">
                Развитие картографических сценариев: миграции, региональные кластеры, временные фильтры и тематические карты.
              </div>
            </div>
          </div>
          <div className="home-roadmap-item">
            <div className="home-roadmap-dot" />
            <div>
              <div className="home-roadmap-title">Этап 3. Архив и источники</div>
              <div className="home-roadmap-text">
                Поддержка структурированных источников, прикрепления материалов и расширенного семейного архива.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
