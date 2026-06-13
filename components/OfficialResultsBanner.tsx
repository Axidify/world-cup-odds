type Props = {
  onSwitch: () => void;
};

export function OfficialResultsBanner({ onSwitch }: Props) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand-tint/20 px-3 py-2 text-xs">
      <span className="text-text-muted">Confirmed results are available.</span>
      <button
        type="button"
        onClick={onSwitch}
        className="font-semibold text-brand hover:underline"
      >
        Switch to Official
      </button>
    </div>
  );
}
