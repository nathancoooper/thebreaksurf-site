// Genuinely cuts the card's own bottom edge into a zigzag rather than
// faking the look with a background-colour-matched strip underneath —
// the old approach assumed whatever sat behind the receipt was the same
// flat cream as the page background, which breaks the moment it's placed
// over anything else (a photo, in this case). Clipping the real shape
// means whatever's actually behind it shows through correctly no matter
// what that is.
const ZIGZAG_TEETH = 16;
const RECEIPT_CLIP_PATH = `polygon(0% 0%, 100% 0%, ${Array.from({ length: ZIGZAG_TEETH + 1 }, (_, i) => {
  const x = 100 - (i * 100) / ZIGZAG_TEETH;
  const y = i % 2 === 0 ? 100 : 90;
  return `${x}% ${y}%`;
}).join(', ')})`;

const FIELD_STEPS = {
  studentName: 0,
  studentEmail: 1,
  garment: 2,
  placement: 3,
  photo: 4,
  colour: 5,
  note: 6,
} as const;

type Values = {
  studentName: string;
  studentEmail: string;
  garment: string;
  placement: string;
  colour: string;
  note: string;
};

function Row({ label, value, revealed }: { label: string; value: string; revealed: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-charcoal/20 py-2.5">
      <span className="text-[11px] tracking-wider text-charcoal/45">{label}</span>
      <span className={`truncate text-right text-sm ${revealed && value ? 'text-charcoal' : 'text-charcoal/25'}`}>
        {revealed && value ? value : '···········'}
      </span>
    </div>
  );
}

export default function UniversityReceipt({ values, step, hasPhoto }: { values: Values; step: number; hasPhoto: boolean }) {
  const revealed = (key: keyof typeof FIELD_STEPS) => step >= FIELD_STEPS[key];

  return (
    <div className="mx-auto w-full max-w-sm -rotate-1">
      <div
        className="bg-white px-8 pb-12 pt-9 font-departure shadow-lg"
        style={{ clipPath: RECEIPT_CLIP_PATH }}
      >
        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-charcoal">THE BREAK SURF</p>
          <p className="mt-1 text-[10px] tracking-[0.15em] text-charcoal/50">EMBROIDERY DROP-OFF</p>
        </div>

        <div className="mt-6 border-t border-dashed border-charcoal/20 pt-1">
          <Row label="NAME"      value={values.studentName}  revealed={revealed('studentName')} />
          <Row label="EMAIL"     value={values.studentEmail} revealed={revealed('studentEmail')} />
          <Row label="GARMENT"   value={values.garment}      revealed={revealed('garment')} />
          <Row label="PLACEMENT" value={values.placement}    revealed={revealed('placement')} />
          {revealed('photo') && (
            <Row label="PHOTO" value={hasPhoto ? 'ATTACHED' : 'NONE'} revealed />
          )}
          <Row label="COLOUR"    value={values.colour}       revealed={revealed('colour')} />
          {revealed('note') && values.note.trim() && (
            <Row label="NOTE" value={values.note} revealed />
          )}
        </div>

        <p className="mt-6 text-center text-[10px] tracking-[0.15em] text-charcoal/40">
          SEE YOU AT RECEPTION
        </p>
      </div>
    </div>
  );
}
