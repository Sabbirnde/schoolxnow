import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EnvironmentConfigError from './EnvironmentConfigError';

const invalidValidation = {
  isValid: false,
  errors: ['Missing VITE_API_URL', 'VITE_API_URL format is invalid'],
  safeInfo: {
    Environment: 'test',
    'Dev Mode': 'Yes',
  },
};

describe('EnvironmentConfigError', () => {
  it('shows developer diagnostics outside production', () => {
    render(
      <EnvironmentConfigError
        validation={invalidValidation}
        isProduction={false}
      />
    );

    expect(screen.getByText('Service configuration required')).toBeInTheDocument();
    expect(screen.getByText('Missing VITE_API_URL')).toBeInTheDocument();
    expect(screen.getByText('VITE_API_URL format is invalid')).toBeInTheDocument();
    expect(screen.getByText('Developer setup')).toBeInTheDocument();
    expect(screen.getByText('Safe diagnostics')).toBeInTheDocument();
  });

  it('hides raw validation details in production', () => {
    render(
      <EnvironmentConfigError
        validation={invalidValidation}
        isProduction
      />
    );

    expect(screen.getByText('Service configuration required')).toBeInTheDocument();
    expect(screen.getByText('The application is not configured correctly for this deployment.')).toBeInTheDocument();
    expect(screen.queryByText('Missing VITE_API_URL')).not.toBeInTheDocument();
    expect(screen.queryByText('Developer setup')).not.toBeInTheDocument();
    expect(screen.queryByText('Safe diagnostics')).not.toBeInTheDocument();
  });
});
