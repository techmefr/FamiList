<script lang="ts">
	/**
	 * Where the app talks to, typed in rather than baked into the build.
	 *
	 * Saving reloads the page on purpose: the Supabase client is built once, at module load, the same way
	 * `config.js` already was — there is no live-swap of an open connection, and pretending otherwise would
	 * leave open sockets pointed at the old database.
	 *
	 * Both fields are public by construction (see `instance-config.ts`), so nothing here needs to be hidden
	 * the way a password field would.
	 */
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import {
		clearLocalInstanceConfig,
		loadLocalInstanceConfig,
		saveLocalInstanceConfig
	} from '$db/local-instance-config';
	import { Save, Trash2 } from '@lucide/svelte';

	const saved = loadLocalInstanceConfig();

	let url = $state(saved?.url ?? '');
	let anonKey = $state(saved?.anonKey ?? '');
	let error = $state(false);

	function save() {
		error = false;

		if (!saveLocalInstanceConfig(url, anonKey)) {
			error = true;
			return;
		}

		location.reload();
	}

	function reset() {
		clearLocalInstanceConfig();
		location.reload();
	}
</script>

<div class="space-y-4" data-test-id="connection-setup">
	<div class="space-y-1">
		<Label for="connection-url">{t('setup.form.url')}</Label>
		<Input
			id="connection-url"
			type="text"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			bind:value={url}
			placeholder="https://xxxxxxxx.supabase.co"
			data-test-id="connection-url"
		/>
	</div>

	<div class="space-y-1">
		<Label for="connection-anon-key">{t('setup.form.anonKey')}</Label>
		<Input
			id="connection-anon-key"
			type="text"
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			bind:value={anonKey}
			placeholder="eyJhbGciOi..."
			data-test-id="connection-anon-key"
		/>
	</div>

	{#if error}
		<p class="text-destructive text-caption" role="alert" data-test-id="connection-error">
			{t('setup.form.invalid')}
		</p>
	{/if}

	<div class="flex flex-wrap items-center gap-3">
		<Button onclick={save} data-test-id="connection-save">
			<Save size={18} aria-hidden="true" />
			{t('setup.form.save')}
		</Button>

		{#if saved}
			<Button variant="outline" onclick={reset} data-test-id="connection-reset">
				<Trash2 size={18} aria-hidden="true" />
				{t('setup.form.reset')}
			</Button>
		{/if}
	</div>
</div>
