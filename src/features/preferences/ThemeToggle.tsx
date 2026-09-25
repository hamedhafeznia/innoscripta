import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme, type Theme } from './theme';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL: Record<Theme, string> = {
  system: 'Theme: following the system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

/**
 * Cycles system -> light -> dark. A three-way control because "follow the system" is a
 * real choice and not the same as whichever of the two the system happens to be now.
 */
export function ThemeToggle() {
  const theme = useTheme((state) => state.theme);
  const setTheme = useTheme((state) => state.setTheme);
  const Icon = ICON[theme];

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`${LABEL[theme]}. Activate to switch to ${NEXT[theme]}.`}
      title={LABEL[theme]}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon />
    </Button>
  );
}
