// ============================================================================
// RestoConnect — Edge Function : controlled-signup
// Inscription contrôlée rattachée à un restaurant via invitation valide
// (création Super Administrateur publique strictement interdite)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ControlledSignupBody {
  email: string;
  password: string;
  fullName: string;
  restaurantSlug: string;
  invitationCode: string;
  requestedRole?: string;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée.' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Configuration serveur Supabase manquante.' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  let body: ControlledSignupBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide.' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (body.requestedRole === 'super_admin') {
    return new Response(
      JSON.stringify({ error: 'Escalade de privilège refusée : rôle Super Administrateur interdit.' }),
      { status: 403, headers: JSON_HEADERS }
    );
  }

  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  const fullName = body.fullName?.trim() ?? '';
  const restaurantSlug = body.restaurantSlug?.trim().toLowerCase() ?? '';
  const invitationCode = body.invitationCode?.trim() ?? '';

  if (!email || password.length < 10 || fullName.length < 2 || !restaurantSlug || invitationCode.length < 6) {
    return new Response(
      JSON.stringify({ error: 'Données invalides ou mot de passe trop court (10 caractères min.).' }),
      { status: 400, headers: JSON_HEADERS }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Vérifier le restaurant cible et une licence active
  const { data: restaurant, error: restaurantError } = await adminClient
    .from('restaurants')
    .select('id, status')
    .eq('slug', restaurantSlug)
    .single();

  if (restaurantError || !restaurant) {
    return new Response(JSON.stringify({ error: 'Établissement introuvable.' }), {
      status: 404,
      headers: JSON_HEADERS,
    });
  }

  // 2. Vérifier l'invitation dans public.restaurant_invitations
  const { data: invitation, error: invError } = await adminClient
    .from('restaurant_invitations')
    .select('id, restaurant_id, email, role_id, status, expires_at')
    .eq('restaurant_id', restaurant.id)
    .eq('invitation_code', invitationCode)
    .eq('status', 'pending')
    .maybeSingle();

  if (invError || !invitation) {
    return new Response(JSON.stringify({ error: "Code d'invitation invalide ou déjà utilisé." }), {
      status: 403,
      headers: JSON_HEADERS,
    });
  }

  if (invitation.email.trim().toLowerCase() !== email) {
    return new Response(JSON.stringify({ error: "L'e-mail ne correspond pas à l'invitation délivrée." }), {
      status: 403,
      headers: JSON_HEADERS,
    });
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    await adminClient.from('restaurant_invitations').update({ status: 'expired' }).eq('id', invitation.id);
    return new Response(JSON.stringify({ error: 'Cette invitation a expiré.' }), {
      status: 410,
      headers: JSON_HEADERS,
    });
  }

  // 3. Création sécurisée de l'utilisateur dans Auth avec platform_role = standard_user
  const { data: authCreated, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      platform_role: 'standard_user',
    },
  });

  if (authErr || !authCreated.user) {
    return new Response(JSON.stringify({ error: authErr?.message ?? 'Création de compte refusée.' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // 4. Rattachement strict au restaurant cible et acceptation de l'invitation
  const { error: memberErr } = await adminClient.from('restaurant_members').insert({
    restaurant_id: restaurant.id,
    profile_id: authCreated.user.id,
    role_id: invitation.role_id,
    status: 'active',
    joined_at: new Date().toISOString(),
  });

  if (memberErr) {
    await adminClient.auth.admin.deleteUser(authCreated.user.id);
    return new Response(JSON.stringify({ error: 'Erreur lors de la liaison au restaurant.' }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }

  await adminClient.from('restaurant_invitations').update({ status: 'accepted' }).eq('id', invitation.id);

  return new Response(
    JSON.stringify({
      status: 'account_created',
      restaurantId: restaurant.id,
      userId: authCreated.user.id,
    }),
    { status: 201, headers: JSON_HEADERS }
  );
});
