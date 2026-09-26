import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * A checkbox that reads as a chip. It stays a real checkbox (label, role and keyboard
 * behaviour intact) because the filters have to be operable without a mouse.
 */
export function CheckboxChip({
  label,
  checked,
  onToggle,
  className,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const id = useId();

  return (
    // The whole chip is the label, not just the 16px box and the word: a chip that looks
    // pressable everywhere must be pressable everywhere. Taller on touch than on desktop.
    // Checked reads as filled-and-dark, not as the focus blue: at magnification a chip
    // tinted with --ring is hard to tell apart from the chip that merely has focus.
    <label
      htmlFor={id}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8rem] transition-colors select-none sm:min-h-9 ${
        checked
          ? 'border-foreground/25 bg-foreground/[0.06] text-foreground'
          : 'text-muted-foreground hover:border-foreground/20 hover:text-foreground'
      } ${className ?? ''}`}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <span className="capitalize">{label}</span>
    </label>
  );
}
