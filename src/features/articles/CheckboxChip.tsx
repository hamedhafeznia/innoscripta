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
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm ${
        checked ? 'border-primary text-primary' : ''
      } ${className ?? ''}`}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <label htmlFor={id} className="cursor-pointer capitalize select-none">
        {label}
      </label>
    </div>
  );
}
