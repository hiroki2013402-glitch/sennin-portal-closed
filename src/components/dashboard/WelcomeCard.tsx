type WelcomeCardProps = {
  name: string;
  email?: string;
  loading: boolean;
};

export default function WelcomeCard({ name, email, loading }: WelcomeCardProps) {
  return (
    <article className="welcome-card">
      <div className="welcome-orb" />
      <div className="welcome-content">
        <div className="welcome-label"><i className="fa-solid fa-circle-check" /> SENNIN ACCOUNT</div>
        <h2>{loading ? '読み込み中…' : <>ようこそ、<span>{name}</span> さん</>}</h2>
        <p>Sennin Portalをご利用いただきありがとうございます。</p>
        {email && <div className="welcome-email"><i className="fa-regular fa-envelope" /> {email}</div>}
      </div>
      <div className="welcome-mark"><i className="fa-solid fa-shapes" /></div>
    </article>
  );
}
