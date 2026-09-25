import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderApp';
import { ThemeToggle } from './ThemeToggle';
import { useApplyTheme, useTheme } from './theme';

function Harness() {
  useApplyTheme();
  return <ThemeToggle />;
}

const isDark = () => document.documentElement.classList.contains('dark');

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    useTheme.setState({ theme: 'system' });
    document.documentElement.classList.remove('dark');
  });

  it('follows the system by default', () => {
    renderWithProviders(<Harness />);

    // The stubbed matchMedia reports no dark preference.
    expect(isDark()).toBe(false);
    expect(screen.getByRole('button', { name: /following the system/ })).toBeInTheDocument();
  });

  it('cycles system to light to dark and back', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: /following the system/ }));
    await waitFor(() => expect(useTheme.getState().theme).toBe('light'));

    await user.click(screen.getByRole('button', { name: /Theme: light/ }));
    await waitFor(() => expect(isDark()).toBe(true));

    await user.click(screen.getByRole('button', { name: /Theme: dark/ }));
    await waitFor(() => expect(useTheme.getState().theme).toBe('system'));
    expect(isDark()).toBe(false);
  });

  it('tells the browser which scheme is active, so its own chrome follows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: /following the system/ }));
    await user.click(screen.getByRole('button', { name: /Theme: light/ }));

    await waitFor(() => expect(document.documentElement.style.colorScheme).toBe('dark'));
  });

  it('remembers the choice across a reload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await user.click(screen.getByRole('button', { name: /following the system/ }));

    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('innoscripta.theme') ?? '{}').state).toEqual({
        theme: 'light',
      }),
    );
  });
});
