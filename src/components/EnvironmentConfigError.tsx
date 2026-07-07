import SecureConfig from '@/lib/secure-config';

type ValidationResult = ReturnType<typeof SecureConfig.validate>;

interface EnvironmentConfigErrorProps {
  validation?: ValidationResult;
  isProduction?: boolean;
}

const getVisibleErrors = (validation: ValidationResult, isProduction: boolean) => {
  if (!isProduction) return validation.errors;

  return [
    'The application is not configured correctly for this deployment.',
    'Please contact the system administrator or deployment owner.',
  ];
};

export default function EnvironmentConfigError({
  validation = SecureConfig.validate(),
  isProduction = import.meta.env.PROD,
}: EnvironmentConfigErrorProps) {
  const visibleErrors = getVisibleErrors(validation, isProduction);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
        <div className="rounded-lg border border-destructive/30 bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-start gap-4">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              !
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">
                Service configuration required
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                SchoolXNow could not start because required backend configuration is missing or invalid.
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-4">
            <p className="text-sm font-medium">What happened</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {visibleErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>

          {!isProduction && (
            <div className="mt-4 rounded-md border bg-muted/40 p-4">
              <p className="text-sm font-medium">Developer setup</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Copy <code>.env.example</code> to <code>.env</code>.</li>
                <li>Set <code>VITE_API_URL</code> to your PHP API URL, for example <code>/api</code>.</li>
                <li>Restart the dev server after changing environment variables.</li>
              </ol>
            </div>
          )}

          {!isProduction && Object.keys(validation.safeInfo).length > 0 && (
            <div className="mt-4 rounded-md border bg-muted/40 p-4">
              <p className="text-sm font-medium">Safe diagnostics</p>
              <dl className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                {Object.entries(validation.safeInfo).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 border-b pb-1 sm:block sm:border-b-0">
                    <dt className="font-medium text-foreground">{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
