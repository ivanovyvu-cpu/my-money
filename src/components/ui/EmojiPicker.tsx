import { useState } from 'react';

const SPEND_EMOJI = ['🛒', '💡', '🧸', '🚗', '💅', '🏠', '🍔', '☕', '🍷', '💊', '🩺', '👕', '👟', '📱', '💻', '🎮', '🎬', '📚', '🎓', '✈️', '🚕', '🚌', '⛽', '🐶', '🐱', '🎁', '💐', '🏋️', '💇', '🧾', '🔧', '🛠️', '🏦', '📦', '🧹', '🎉'];
const SAVE_EMOJI = ['✨', '🎁', '🚙', '🫙', '🏖️', '🏡', '💍', '🎓', '🛡️', '💰', '💎', '🌴', '🚲', '📷', '🎸', '🧳', '👶', '🩺', '🛋️', '🏔️', '⛵', '🌍', '🎯', '🐷'];

/** Выбор иконки: готовая сетка эмодзи + возможность вписать свой. */
export function EmojiPicker({
  value,
  onChange,
  kind,
}: {
  value: string;
  onChange: (v: string) => void;
  kind: 'spend' | 'save';
}) {
  const list = kind === 'spend' ? SPEND_EMOJI : SAVE_EMOJI;
  const [custom, setCustom] = useState('');
  return (
    <div>
      <div className="grid grid-cols-8 gap-1">
        {list.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className={`flex aspect-square min-h-10 items-center justify-center rounded-xl text-xl transition-colors duration-150 ${
              value === e ? (kind === 'spend' ? 'bg-spend-soft ring-2 ring-spend' : 'bg-save-soft ring-2 ring-save') : 'hover:bg-card-2'
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={custom}
        placeholder="или вставьте свой эмодзи"
        onChange={(e) => {
          setCustom(e.target.value);
          const first = Array.from(new Intl.Segmenter().segment(e.target.value.trim()))[0]?.segment;
          if (first) onChange(first);
        }}
        className="mt-2 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none"
      />
    </div>
  );
}
