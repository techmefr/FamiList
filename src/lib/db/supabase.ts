import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from './types';

/**
 * Client unique, côté navigateur seulement (l'app est en SPA statique, il n'y a pas de serveur).
 * La clé publiable est faite pour être livrée au client : c'est la RLS qui protège les données,
 * pas le secret de la clé.
 */
export const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true
	}
});
