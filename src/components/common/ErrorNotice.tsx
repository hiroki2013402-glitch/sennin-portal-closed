type ErrorNoticeProps = {
  message: string;
};

export default function ErrorNotice({ message }: ErrorNoticeProps) {
  if (!message) return null;

  return (
    <div className="notice error" role="alert">
      <i className="fa-solid fa-circle-exclamation" />
      {message}
    </div>
  );
}
