import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, Eye, ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/src/components/layout/BrandMark';
import { ThemeToggle } from '@/src/components/theme/ThemeToggle';
import { SiteAttributionBar } from '@/src/components/layout/SiteAttributionBar';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { supabaseConfigStatus } from '@/src/lib/supabase/client';
import { resolveDefaultWorkspaceRoute, validateControlledSignup } from '@/src/lib/auth/rbac';
import { useAuth } from './AuthProvider';

export function AuthPage() {
  const { isConfigured, accessContext, signIn, sendPasswordReset } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'reset'>('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupSlug, setSignupSlug] = useState('');
  const [signupCode, setSignupCode] = useState('');
  const [signupFeedback, setSignupFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  if (accessContext.isAuthenticated) {
    return <Navigate to={resolveDefaultWorkspaceRoute(accessContext)} replace />;
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setLoginFeedback(null);

    if (!loginEmail.trim() || !loginPassword) {
      setLoginFeedback({ type: 'error', message: 'Veuillez saisir votre adresse e-mail et votre mot de passe.' });
      return;
    }

    setLoginSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoginSubmitting(false);

    if (error) {
      setLoginFeedback({ type: 'error', message: error });
      return;
    }

    navigate(resolveDefaultWorkspaceRoute(accessContext));
  }

  function handleControlledSignupSubmit(event: FormEvent) {
    event.preventDefault();
    setSignupFeedback(null);

    const validation = validateControlledSignup({
      fullName: signupName,
      email: signupEmail,
      password: signupPassword,
      restaurantSlug: signupSlug,
      invitationCode: signupCode,
    });

    if (!validation.valid) {
      setSignupFeedback({ type: 'error', message: validation.error ?? 'Données invalides.' });
      return;
    }

    if (!isConfigured) {
      setSignupFeedback({
        type: 'error',
        message: "L'inscription contrôlée nécessite la connexion Supabase (Edge Function controlled-signup).",
      });
      return;
    }

    setSignupFeedback({
      type: 'error',
      message: "Veuillez déployer l'Edge Function controlled-signup et les migrations SQL avant de soumettre une invitation.",
    });
  }

  async function handleResetSubmit(event: FormEvent) {
    event.preventDefault();
    setResetFeedback(null);

    if (!resetEmail.trim()) {
      setResetFeedback({ type: 'error', message: 'Veuillez indiquer votre adresse e-mail.' });
      return;
    }

    setResetSubmitting(true);
    const { error } = await sendPasswordReset(resetEmail);
    setResetSubmitting(false);

    if (error) {
      setResetFeedback({ type: 'error', message: error });
      return;
    }

    setResetFeedback({
      type: 'success',
      message: "Si ce compte existe, un lien de réinitialisation vient d'être envoyé.",
    });
  }

  return (
    <div className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-fg)] flex flex-col">
      <header className="border-b border-[var(--rc-border)] bg-[var(--rc-header)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rc-gold)] rounded">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2.5">
            <ThemeToggle variant="compact" />
            <Button asChild variant="outline" size="sm">
              <Link to="/apercu-architecture">
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Aperçu des espaces</span>
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Accueil</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--rc-gold-text)]">
                Accès sécurisé multi-tenant
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--rc-fg)]">
                Portail professionnel RestoConnect
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--rc-muted)]">
                La gestion intelligente de votre restaurant. Connectez-vous pour accéder à votre espace dédié selon votre rôle et la licence de votre établissement.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--rc-fg)]">
                <Lock className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                <span>Règles d&apos;accès et sécurité</span>
              </div>
              <ul className="space-y-2 text-xs text-[var(--rc-muted)] leading-relaxed">
                <li>• Isolation stricte par établissement (<code className="text-[var(--rc-fg)]">restaurant_id</code>) via PostgreSQL RLS.</li>
                <li>• Le compte Super Administrateur ne peut jamais être créé depuis l&apos;inscription publique.</li>
                <li>• Les routes privées (<code className="text-[var(--rc-fg)]">/super-admin</code>, <code className="text-[var(--rc-fg)]">/admin</code>, <code className="text-[var(--rc-fg)]">/staff</code>) exigent une session Supabase Auth active.</li>
              </ul>
            </div>

            {!isConfigured && (
              <div
                role="status"
                className="rounded-xl border border-[var(--rc-warn-border)] bg-[var(--rc-warn-bg)] p-4 space-y-2"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--rc-warn-fg)]">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Configuration Supabase requise</span>
                </div>
                <p className="text-xs text-[var(--rc-fg)]/85 leading-relaxed">
                  Variables manquantes dans votre environnement :{' '}
                  <span className="font-mono font-medium">
                    {supabaseConfigStatus.missingVariables.join(', ')}
                  </span>
                  . Renseignez-les pour activer l&apos;authentification réelle. Vous pouvez toutefois consulter la structure visuelle des tableaux de bord via l&apos;aperçu dédié.
                </p>
                <div className="pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/apercu-architecture">Consulter les structures des espaces</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            <Card>
              <CardHeader>
                <CardTitle>Authentification</CardTitle>
                <CardDescription>
                  Session chiffrée via Supabase Auth. Aucune autorisation simulée.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val as 'login' | 'signup' | 'reset')}
                >
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="login">Connexion</TabsTrigger>
                    <TabsTrigger value="signup">Inscription contrôlée</TabsTrigger>
                    <TabsTrigger value="reset">Mot de passe</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email">Adresse e-mail professionnelle</Label>
                        <Input
                          id="login-email"
                          type="email"
                          autoComplete="email"
                          placeholder="nom@restaurant.cd"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password">Mot de passe</Label>
                        <Input
                          id="login-password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Votre mot de passe"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                      </div>

                      {loginFeedback && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-md border border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] p-3 text-xs text-[var(--rc-danger-fg)]"
                        >
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{loginFeedback.message}</span>
                        </div>
                      )}

                      <Button type="submit" className="w-full" disabled={loginSubmitting}>
                        {loginSubmitting ? 'Connexion en cours...' : 'Se connecter'}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleControlledSignupSubmit} className="space-y-4">
                      <p className="text-xs text-[var(--rc-muted)] leading-relaxed">
                        L&apos;inscription est strictement rattachée à un établissement existant disposant d&apos;un code d&apos;invitation valide.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-name">Nom complet</Label>
                          <Input
                            id="signup-name"
                            placeholder="Nom complet"
                            value={signupName}
                            onChange={(e) => setSignupName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email">E-mail</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="personnel@restaurant.cd"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="signup-slug">Identifiant restaurant (slug)</Label>
                          <Input
                            id="signup-slug"
                            placeholder="identifiant-restaurant"
                            value={signupSlug}
                            onChange={(e) => setSignupSlug(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-code">Code d&apos;invitation</Label>
                          <Input
                            id="signup-code"
                            placeholder="Code fourni par l'admin"
                            value={signupCode}
                            onChange={(e) => setSignupCode(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Mot de passe (10 caractères min.)</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          autoComplete="new-password"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                        />
                      </div>

                      {signupFeedback && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 rounded-md border border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] p-3 text-xs text-[var(--rc-danger-fg)]"
                        >
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{signupFeedback.message}</span>
                        </div>
                      )}

                      <Button type="submit" className="w-full">
                        Valider l&apos;invitation et créer le compte
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="reset">
                    <form onSubmit={handleResetSubmit} className="space-y-4">
                      <p className="text-xs text-[var(--rc-muted)] leading-relaxed">
                        Recevez un lien sécurisé de réinitialisation de mot de passe envoyé par Supabase Auth.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Adresse e-mail du compte</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="nom@restaurant.cd"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                      </div>

                      {resetFeedback && (
                        <div
                          role="alert"
                          className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
                            resetFeedback.type === 'success'
                              ? 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
                              : 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
                          }`}
                        >
                          {resetFeedback.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                          )}
                          <span>{resetFeedback.message}</span>
                        </div>
                      )}

                      <Button type="submit" className="w-full" disabled={resetSubmitting}>
                        {resetSubmitting ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <SiteAttributionBar />
    </div>
  );
}
