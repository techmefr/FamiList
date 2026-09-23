import { browser } from '$app/environment';
import { supabase } from '$db/supabase';
import { OAUTH_PROVIDERS, type ProviderId } from '$domain/oauth';
import { sync } from '$sync/index.svelte';
import type { Session, User } from '@supabase/supabase-js';

export type AccountStatus = 'pending' | 'approved' | 'rejected';

/** A TOTP factor as the screen needs it: the rest of the response is of no use here. */
export interface Factor {
	id: string;
	friendlyName: string;
	createdAt: string;
}

/** An open session, as `public.my_sessions()` returns it. */
export interface OpenSession {
	id: string;
	created_at: string;
	refreshed_at: string;
	user_agent: string | null;
	ip: string | null;
	aal: string;
	current: boolean;
}

export interface Profile {
	id: string;
	display_name: string;
	role: 'user' | 'admin';
	status: AccountStatus;
	is_demo: boolean;
}

class SessionStore {
	user = $state<User | null>(null);
	profile = $state<Profile | null>(null);
	loading = $state(true);
	error = $state<string | null>(null);

	/**
	 * Where this session stands on its second factor.
	 *
	 * `level` is what it presented, `nextLevel` what the account requires. Both are read from the token,
	 * with no network call: Supabase decodes them for us.
	 */
	level = $state<string | null>(null);
	nextLevel = $state<string | null>(null);

	isSignedIn = $derived(this.user !== null);

	/**
	 * A recovery link signed this session in on purpose, to let the person set a new password — not
	 * because they proved they know one.
	 *
	 * Set from the auth event itself, not from the current route: relying on "did we land on
	 * `/auth/reset`" alone means any place the link's redirect actually lands (a misconfigured Supabase
	 * redirect-URL allowlist falls back to the site's root) grants full access with no password ever
	 * asked for. Cleared once the new password is set, or if the person signs in normally afterwards.
	 */
	isPasswordRecovery = $state(false);

	/**
	 * The account asks for a second factor and this session has not given it yet.
	 *
	 * It is not only a screen: the database already refuses every read in this state (see
	 * `public.is_approved()`). Saying it on the client mainly serves to avoid starting the sync, which
	 * empties the local tables before filling them — it would empty them for nothing, and the device
	 * would lose its offline copy because of a code not typed yet.
	 */
	needsSecondFactor = $derived(
		this.isSignedIn && this.nextLevel === 'aal2' && this.level !== 'aal2'
	);

	isApproved = $derived(this.profile?.status === 'approved' && !this.needsSecondFactor);
	isAdmin = $derived(this.profile?.role === 'admin' && this.isApproved);

	async init() {
		if (!browser) return;

		const { data } = await supabase.auth.getSession();
		await this.apply(data.session);

		supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'PASSWORD_RECOVERY') this.isPasswordRecovery = true;
			else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') this.isPasswordRecovery = false;

			this.apply(session);
		});

		this.loading = false;
	}

	private async apply(session: Session | null) {
		this.user = session?.user ?? null;

		if (!this.user) {
			this.profile = null;
			this.level = null;
			this.nextLevel = null;
			return;
		}

		await this.refreshLevels();

		const { data, error } = await supabase
			.from('profiles')
			.select('id, display_name, role, status, is_demo')
			.eq('id', this.user.id)
			.maybeSingle();

		// The profile is created by a trigger at sign-up. If it is still missing, we do not block: the
		// waiting screen will show, and the next refresh will find it.
		this.profile = error ? null : (data as Profile | null);
	}

	/**
	 * Re-reads the session's authentication level.
	 *
	 * Called on every session change, and again when the database refuses a write for "account not
	 * valid": it is the only way to know whether the refusal comes from a missing second factor rather
	 * than from an unapproved account. A read that fails leaves the levels unchanged — setting them to
	 * `null` would make a protected account look like one with no second factor.
	 */
	async refreshLevels() {
		const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
		if (error) return false;

		this.level = data?.currentLevel ?? null;
		this.nextLevel = data?.nextLevel ?? null;
		return true;
	}

	async signUp(email: string, password: string, displayName: string) {
		this.error = null;
		const { error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { display_name: displayName } }
		});

		if (error) this.error = error.message;
		return !error;
	}

	async signIn(email: string, password: string) {
		this.error = null;
		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) this.error = error.message;
		return !error;
	}

	/**
	 * Goes to the provider then comes back to the root. We do not redirect to a dedicated page: the
	 * Supabase client is created with detectSessionInUrl, it exchanges the code for a session on the
	 * first load, whatever the page. And the root already knows how to send to the waiting screen if the
	 * account is not approved yet.
	 */
	async signInWithProvider(id: ProviderId) {
		this.error = null;

		const provider = OAUTH_PROVIDERS.find((candidate) => candidate.id === id);
		const { error } = await supabase.auth.signInWithOAuth({
			provider: id,
			options: {
				redirectTo: `${location.origin}/`,
				scopes: provider?.scopes
			}
		});

		if (error) this.error = error.message;
		return !error;
	}

	/**
	 * Sends a six-digit code by email.
	 *
	 * The same call serves the magic link: the email template decides which of the two goes out, and
	 * Supabase accepts the code verification in both cases. No account is created along the way — a
	 * mistyped address would make a ghost account awaiting approval, which the administrator would then
	 * have to sort out.
	 */
	async sendEmailCode(email: string) {
		this.error = null;
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/` }
		});

		if (error) this.error = error.message;
		return !error;
	}

	async verifyEmailCode(email: string, token: string) {
		this.error = null;
		const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

		if (error) this.error = error.message;
		return !error;
	}

	/**
	 * Sends the password-reset email. The redirect is built from `location.origin`, like the OAuth and
	 * passwordless flows above: whatever domain this instance runs on, the link it sends out points back
	 * at itself.
	 */
	async sendPasswordReset(email: string) {
		this.error = null;
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${location.origin}/auth/reset`
		});

		if (error) this.error = error.message;
		return !error;
	}

	/**
	 * Sets a new password from a reset link. Supabase turns the link's token into a session before this
	 * screen loads — `updateUser` is enough, there is no old password to check as there is for
	 * `changePassword`: the link itself is the proof of identity.
	 */
	async completePasswordReset(next: string) {
		this.error = null;
		const { error } = await supabase.auth.updateUser({ password: next });

		if (error) {
			this.error = error.message;
			return false;
		}

		// `updateUser` fires `USER_UPDATED`, not `SIGNED_IN` — nothing else would clear the flag here.
		this.isPasswordRecovery = false;
		return true;
	}

	/**
	 * Changes the password, after re-checking the old one.
	 *
	 * Supabase does not ask for the old one: `updateUser` accepts a new password on the strength of the
	 * session alone. That is convenient and it is dangerous — a screen left open in an office would then
	 * be enough to take over the account, and the person it belongs to could no longer get in. So we sign
	 * in again with the old one before writing the new one.
	 *
	 * The check call opens one more session, which shows in the device list: that is the price, and it is
	 * small next to what it avoids.
	 */
	async changePassword(current: string, next: string) {
		this.error = null;

		const email = this.user?.email;
		if (!email) return false;

		const { error: refusal } = await supabase.auth.signInWithPassword({ email, password: current });
		if (refusal) {
			this.error = refusal.message;
			return false;
		}

		const { error } = await supabase.auth.updateUser({ password: next });
		if (error) {
			this.error = error.message;
			return false;
		}

		return true;
	}

	/**
	 * The account's verified TOTP factors. Unfinished enrolments do not count.
	 *
	 * `null` when the read fails: an empty list would mean "no second factor", which is a legitimate and
	 * reassuring state, whereas the call could establish nothing.
	 */
	async listFactors(): Promise<Factor[] | null> {
		const { data, error } = await supabase.auth.mfa.listFactors();

		if (error) {
			this.error = error.message;
			return null;
		}

		return (data?.totp ?? []).map((factor) => ({
			id: factor.id,
			friendlyName: factor.friendly_name ?? '',
			createdAt: factor.created_at
		}));
	}

	/**
	 * Starts a TOTP enrolment and returns what is needed to show it.
	 *
	 * Supabase draws the QR itself: nothing to encode here. The secret in plain text comes with it, for
	 * applications that cannot photograph and for anyone who cannot aim at a square.
	 */
	async enrollTotp() {
		this.error = null;
		const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

		if (error) {
			this.error = error.message;
			return null;
		}

		return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
	}

	/** Finishes the enrolment: the code proves the application really was set up. */
	async verifyEnrollment(factorId: string, code: string) {
		this.error = null;
		const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

		if (error) this.error = error.message;
		return !error;
	}

	/** Raises the current session to aal2. Same call, different moment: here we are signing in. */
	async challengeTotp(factorId: string, code: string) {
		return this.verifyEnrollment(factorId, code);
	}

	/**
	 * Removes the second factor. The session must be at aal2 for that — Supabase requires it, and rightly
	 * so: otherwise a stolen tab would be enough to switch it off.
	 */
	async unenrollTotp(factorId: string) {
		this.error = null;
		const { error } = await supabase.auth.mfa.unenroll({ factorId });

		if (error) {
			this.error = error.message;
			return false;
		}

		await supabase.auth.refreshSession();
		return true;
	}

	/**
	 * Uses up a backup code, which removes the account's second factor.
	 *
	 * The token is refreshed straight after: it still carried the trace of a factor that no longer exists,
	 * and without that the session would stay stuck in front of a door we have just removed.
	 */
	async useBackupCode(code: string) {
		this.error = null;
		const { data, error } = await supabase.rpc('consume_backup_code', { code });

		if (error) {
			this.error = error.message;
			return false;
		}

		if (!data) return false;

		await supabase.auth.refreshSession();
		return true;
	}

	/** Makes a fresh set. The plain codes will never pass through here again. */
	async newBackupCodes(): Promise<string[]> {
		this.error = null;
		const { data, error } = await supabase.rpc('create_backup_codes');

		if (error) {
			this.error = error.message;
			return [];
		}

		return (data ?? []) as string[];
	}

	/** `null` on failure: zero would read as "no backup codes left". */
	async backupCodesLeft(): Promise<number | null> {
		const { data, error } = await supabase.rpc('backup_codes_left');

		if (error) {
			this.error = error.message;
			return null;
		}

		return typeof data === 'number' ? data : 0;
	}

	/** `null` on failure: an empty list would read as "no connected device". */
	async listSessions(): Promise<OpenSession[] | null> {
		const { data, error } = await supabase.rpc('my_sessions');

		if (error) {
			this.error = error.message;
			return null;
		}

		return (data ?? []) as OpenSession[];
	}

	/**
	 * Closes a session. Closing your own is allowed, and amounts to signing out: the client notices at
	 * the next token refresh, we do not wait for it.
	 */
	async revokeSession(id: string) {
		this.error = null;
		const { error } = await supabase.rpc('revoke_session', { target: id });

		if (error) {
			this.error = error.message;
			return false;
		}

		return true;
	}

	/**
	 * Everything the app remembers about this account, as JSON. `null` on failure: an empty object would
	 * read as "we have nothing on you", which would be a lie by accident.
	 */
	async exportData(): Promise<unknown | null> {
		this.error = null;
		const { data, error } = await supabase.rpc('export_account');

		if (error) {
			this.error = error.message;
			return null;
		}

		return data;
	}

	/**
	 * Closes the account, for good. The local session is emptied straight after: the token stays valid for
	 * a few minutes after the account is deleted, and an app still showing lists on a device whose account
	 * no longer exists is not a state to let settle in.
	 */
	async deleteAccount(): Promise<boolean> {
		this.error = null;
		const { error } = await supabase.rpc('delete_account');

		if (error) {
			this.error = error.message;
			return false;
		}

		await this.signOut();
		return true;
	}

	/**
	 * What has not left yet leaves first.
	 *
	 * A write lives a few moments in the queue before reaching the server. Signing out during that time
	 * revoked the token underneath it: the request in flight failed, and the queue replayed it afterwards
	 * under the next account, which is not allowed to write on behalf of the previous one. The server
	 * therefore refused it for good and it was discarded — a message written, shown, then lost with
	 * nothing to say so.
	 */
	async signOut() {
		await sync.flush();

		await supabase.auth.signOut();
		this.user = null;
		this.profile = null;

		// The local cache survives sign-out if it is not emptied: on a shared device, the next person would
		// open the previous one's lists.
		const { data } = await import('$stores/data.svelte');
		await data.forget();

		// Same reasoning for the appearance bookkeeping: left in place, the next account on this device would
		// inherit a `hasSeenTour` and a `syncedFor` that were never theirs, and the guided tour would silently
		// stay off for someone who has never seen it here.
		const { settings } = await import('$stores/settings.svelte');
		settings.forgetAccount();
	}
}

export const session = new SessionStore();
