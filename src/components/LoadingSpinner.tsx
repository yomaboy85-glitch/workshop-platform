interface Props {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ message = '로딩 중...', fullScreen = true }: Props) {
  const content = (
    <div className="text-center">
      <div className="spinner mx-auto mb-3" />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}
