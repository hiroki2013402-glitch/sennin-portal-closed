export type NavigationItem = {
  label: string;
  icon: string;
};

type SidebarProps = {
  expanded: boolean;
  active: string;
  items: NavigationItem[];
  onToggle: () => void;
  onNavigate: (label: string) => void;
};

export default function Sidebar({ expanded, active, items, onToggle, onNavigate }: SidebarProps) {
  return (
    <aside className={`sidebar ${expanded ? 'expanded' : ''}`}>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="メニュー切替">
        <i className="fa-solid fa-bars" />
        {expanded && <span>ホーム</span>}
      </button>
      <nav className="nav-list" aria-label="メインメニュー">
        {items.map(item => (
          <button
            key={item.label}
            className={`nav-item ${active === item.label ? 'active' : ''}`}
            onClick={() => onNavigate(item.label)}
            title={item.label}
          >
            <i className={item.icon.startsWith('fa-brands') ? item.icon : `fa-solid ${item.icon}`} />
            <span className="nav-text">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">{expanded && <span>メニュー</span>}</div>
    </aside>
  );
}
