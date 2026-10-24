type TopbarProps = {
  name: string;
  initial: string;
  authenticated: boolean;
  onRefresh: () => void;
  onOpenAccount: () => void;
};

export default function Topbar({ name, initial, authenticated, onRefresh, onOpenAccount }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand-title">Sennin</div>
      <div className="topbar-actions">
        <button className="icon-button" onClick={onRefresh} aria-label="更新" title="更新">
          <i className="fa-solid fa-rotate" />
        </button>
        {authenticated ? (
          <button className="header-user" onClick={onOpenAccount}>
            <span className="avatar-sm">{initial}</span>
            <span className="header-name">{name}</span>
            <i className="fa-solid fa-chevron-down small-chevron" />
          </button>
        ) : (
          <a className="login-button" href="/auth/login">Sennin Accountでログイン</a>
        )}
      </div>
    </header>
  );
}
