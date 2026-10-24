type AccountModalProps = {
  name: string;
  initial: string;
  email?: string;
  userId?: string;
  onClose: () => void;
  onRefresh: () => void;
};

export default function AccountModal({ name, initial, email, userId, onClose, onRefresh }: AccountModalProps) {
  return (
    <div className="modal-overlay" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="account-panel" role="dialog" aria-modal="true" aria-label="アカウント情報">
        <div className="account-panel-header">
          <span>アカウント</span>
          <button className="close-button" onClick={onClose} aria-label="閉じる">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="profile-section">
          <div className="avatar-large">{initial}</div>
          <h2>{name}</h2>
          <p>{email || 'Sennin Accountで認証済み'}</p>
          {userId && <p className="account-user-id">ユーザーID: <code>{userId}</code></p>}
          <span className="connected-badge"><i className="fa-solid fa-check-circle" /> Sennin Accountと連携中</span>
        </div>
        <div className="account-actions">
          <button onClick={() => { onClose(); onRefresh(); }}>
            <i className="fa-solid fa-arrows-rotate" />
            <span>アカウント情報を更新</span>
            <i className="fa-solid fa-chevron-right action-chevron" />
          </button>
          <a href="/logout">
            <i className="fa-solid fa-arrow-right-from-bracket" />
            <span>ログアウト</span>
            <i className="fa-solid fa-chevron-right action-chevron" />
          </a>
        </div>
        <p className="account-footnote">認証情報はSennin Accountによって管理されます。</p>
      </section>
    </div>
  );
}
