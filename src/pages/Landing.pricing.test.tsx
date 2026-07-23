import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Landing from './Landing';

describe('Landing pricing section', () => {
  it('shows all international plans and switches billing periods', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'A plan that grows with your school' })).toBeInTheDocument();
    expect(screen.getByText('Most popular')).toBeInTheDocument();
    expect(screen.getByText('$890')).toBeInTheDocument();
    expect(screen.getByText('3,000+ students')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Monthly' }));

    expect(screen.getByText('$89')).toBeInTheDocument();
    expect(screen.getAllByText('/month')).toHaveLength(3);
  });
});
