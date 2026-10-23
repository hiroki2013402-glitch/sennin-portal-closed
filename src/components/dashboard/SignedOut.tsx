export default function SignedOut() {
  return (
    <section className="signed-out">
      <div className="signed-out-icon"><i className="fa-solid fa-shield-halved" /></div>
      <h1>Sennin Portalへようこそ</h1>
      <p>サービスを利用するには、Sennin Accountでログインしてください。</p>
      <a className="primary-button" href="/auth/login">
        <i className="fa-solid fa-arrow-right-to-bracket" /> Sennin Accountでログイン
      </a>
      <p className="subtle">パスワードはこのアプリでは入力しません。認証はSennin Account側で行います。</p>
    </section>
  );
}
