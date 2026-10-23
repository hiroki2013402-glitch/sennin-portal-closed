type PointsCardProps = {
  points: number | null;
  loading: boolean;
  message: string;
};

export default function PointsCard({ points, loading, message }: PointsCardProps) {
  return (
    <article className="points-card" id="points-card">
      <div className="card-heading">
        <div><p className="card-kicker">YOUR BALANCE</p><h2>保有ポイント</h2></div>
        <div className="points-icon"><i className="fa-solid fa-coins" /></div>
      </div>
      <div className="points-body">
        <strong>{loading ? '—' : points === null ? '—' : points.toLocaleString('ja-JP')}</strong>
        <span>P</span>
      </div>
      <div className="points-footer">
        {message || (points === null ? 'アカウント連携後に表示されます' : '現在のアカウント残高')}
      </div>
    </article>
  );
}
