type ServiceGridProps = {
  onNavigate: (label: string) => void;
};

const services = [
  { label: 'ポイント', description: '残高を確認する', icon: 'fa-solid fa-coins', color: 'amber' },
  { label: 'ゲーム', description: 'ゲームサービス', icon: 'fa-solid fa-gamepad', color: 'violet' },
  { label: 'YouTube', description: '動画サービス', icon: 'fa-brands fa-youtube', color: 'red' },
  { label: 'チャット', description: 'コミュニケーション', icon: 'fa-solid fa-comments', color: 'blue' }
];

export default function ServiceGrid({ onNavigate }: ServiceGridProps) {
  return (
    <section className="section-block">
      <div className="section-title">
        <div><p className="card-kicker">QUICK ACCESS</p><h2>サービス</h2></div>
      </div>
      <div className="service-grid">
        {services.map(service => (
          <button key={service.label} className="service-card" onClick={() => onNavigate(service.label)}>
            <span className={`service-icon ${service.color}`}><i className={service.icon} /></span>
            <span><b>{service.label}</b><small>{service.description}</small></span>
            <i className="fa-solid fa-arrow-up-right-from-square service-arrow" />
          </button>
        ))}
      </div>
    </section>
  );
}
