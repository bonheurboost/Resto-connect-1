import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '@/src/lib/supabase/client';
import type {
  LicenseRecord,
  ProfileRecord,
  RestaurantRecord,
  RestaurantRoleCode,
} from '@/src/lib/supabase/database.types';
import { isLicenseOperational } from '@/src/lib/licensing/licenseRules';
import type { AuthAccessContext } from '@/src/lib/auth/rbac';

interface ActiveMembership {
  restaurant: RestaurantRecord;
  roleCode: RestaurantRoleCode;
  license: LicenseRecord | null;
}

interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRecord | null;
  membership: ActiveMembership | null;
  accessContext: AuthAccessContext;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState<boolean>(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [membership, setMembership] = useState<ActiveMembership | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadProfileAndTenant = useCallback(async (activeSession: Session | null) => {
    const client = getSupabaseClient();
    if (!client || !activeSession?.user) {
      setProfile(null);
      setMembership(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setAuthError(null);
    try {
      const { data: profileData, error: profileErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', activeSession.user.id)
        .single();

      if (profileErr || !profileData) {
        setProfile(null);
        setMembership(null);
        setAuthError('Impossible de charger votre profil utilisateur.');
        return;
      }

      const typedProfile = profileData as ProfileRecord;
      setProfile(typedProfile);

      if (typedProfile.platform_role === 'super_admin') {
        setMembership(null);
        return;
      }

      const { data: memberRows } = await client
        .from('restaurant_members')
        .select('restaurant_id, status, roles(code), restaurants(*)')
        .eq('profile_id', activeSession.user.id)
        .eq('status', 'active')
        .limit(1);

      const firstMember = memberRows?.[0] as
        | {
            restaurant_id: string;
            roles: { code: RestaurantRoleCode } | null;
            restaurants: RestaurantRecord | null;
          }
        | undefined;

      if (firstMember?.restaurants && firstMember.roles?.code) {
        const { data: licenseRow } = await client
          .from('licenses')
          .select('*')
          .eq('restaurant_id', firstMember.restaurant_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setMembership({
          restaurant: firstMember.restaurants,
          roleCode: firstMember.roles.code,
          license: (licenseRow as LicenseRecord | null) ?? null,
        });
      } else {
        setMembership(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      void loadProfileAndTenant(data.session);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfileAndTenant(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfileAndTenant]);

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        error: 'Supabase n\'est pas encore configuré. Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
      };
    }
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    await client.auth.signOut();
    setProfile(null);
    setMembership(null);
  };

  const sendPasswordReset = async (email: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        error: 'Supabase n\'est pas encore configuré pour envoyer des e-mails de réinitialisation.',
      };
    }
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    return { error: error ? error.message : null };
  };

  const hasActiveLicense = Boolean(
    membership?.license &&
      membership.restaurant.status === 'active' &&
      isLicenseOperational(membership.license)
  );

  const accessContext: AuthAccessContext = {
    isAuthenticated: Boolean(session?.user && profile),
    isActiveProfile: Boolean(profile?.is_active),
    platformRole: profile?.platform_role ?? null,
    activeRestaurantRole: membership?.roleCode ?? null,
    hasActiveLicense,
  };

  return (
    <AuthContext.Provider
      value={{
        isConfigured: isSupabaseConfigured,
        isLoading,
        session,
        user: session?.user ?? null,
        profile,
        membership,
        accessContext,
        authError,
        signIn,
        signOut,
        sendPasswordReset,
        refreshContext: () => loadProfileAndTenant(session),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de AuthProvider.');
  }
  return ctx;
}
