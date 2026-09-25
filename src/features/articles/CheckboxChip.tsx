import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * A checkbox that reads as a chip. It stays a real checkbox — label, role and keyboard
 * behaviour intact — because the filters have to be operable without a mouse.
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
    // Checked reads as filled-and-dark, not as the focus blue: at magnification a chip
    // tinted with --ring is hard to tell apart from the chip that merely has focus.
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.8rem] transition-colors ${
        checked
          ? 'border-foreground/25 bg-foreground/[0.06] text-foreground'
          : 'text-muted-foreground hover:border-foreground/20 hover:text-foreground'
      } ${className ?? ''}`}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <label htmlFor={id} className="cursor-pointer capitalize select-none">
        {label}
      </label>
    </div>
  );
}
