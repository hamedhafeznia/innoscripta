import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SourceNotice } from '../query/types';
import { SourceNotices } from './SourceNotices';

const notice = (overrides: Partial<SourceNotice>): SourceNotice => ({
  id: 'n',
  sourceId: 'guardian',
  sourceLabel: 'The Guardian',
  kind: 'error',
  message: 'is not responding just now.',
  ...overrides,
});

describe('SourceNotices', () => {
  describe('how each kind is announced to a screen reader', () => {
    it('interrupts for a source that failed', () => {
      render(<SourceNotices notices={[notice({ kind: 'error' })]} />);

      expect(screen.getByRole('alert')).toHaveTextContent('The Guardian is not responding just now.');
    });

    it.each(['excluded', 'caveat'] as const)(
      'announces a %s politely, since it is context and not a failure',
      (kind) => {
        render(<SourceNotices notices={[notice({ kind, message: 'is showing recent headlines only.' })]} />);

        expect(screen.getByRole('status')).toHaveTextContent('is showing recent headlines only.');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      },
    );
  });

  it('says one thing once when several sources report the same trouble', () => {
    render(
      <SourceNotices
        notices={[
          notice({ id: 'a', sourceId: 'guardian', sourceLabel: 'The Guardian', message: 'would not let us in.' }),
          notice({ id: 'b', sourceId: 'nyt', sourceLabel: 'The New York Times', message: 'would not let us in.' }),
        ]}
      />,
    );

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The Guardian and The New York Times would not let us in.',
    );
  });

  it('removes a notice once it is dismissed, and leaves the others', async () => {
    const user = userEvent.setup();
    render(
      <SourceNotices
        notices={[
          notice({ kind: 'error' }),
          notice({ kind: 'caveat', sourceLabel: 'NewsAPI', message: 'is showing recent headlines only.' }),
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss notice about The Guardian' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
