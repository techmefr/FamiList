<script lang="ts">
	/**
	 * The instance settings, set from the screen rather than from a terminal.
	 *
	 * What this screen never does: show a secret. A secret field opens empty, whatever value is set, and the
	 * database does not return it anyway. The label beside it says "configured on …"; typing something
	 * replaces it, leaving it empty touches nothing.
	 *
	 * Why a test button. The real sending comes from a cron every five minutes and says nothing when it
	 * fails. Without this test, the only way to know whether the configuration holds would be to wait for a
	 * stranger to sign up. The verdict names the cause, because each is fixed elsewhere — and above all the
	 * unverified sender, which is not fixed here at all.
	 */

	import { supabase } from '$db/supabase';
	import { t, i18n } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { adminErrorKey } from '$domain/admin-error';
	import {
		type SettingField,
		type SettingGroup,
		type SettingRow,
		fieldsOf,
		initialValue,
		isMailConfigured,
		isMailTestSuccess,
		mailTestKey
	} from '$domain/instance-settings';
	import { Mail, Save, Send, Trash2, CircleDot } from '@lucide/svelte';

	/**
	 * The database's raw message goes up as it is to the parent screen, which translates it and decides
	 * whether it deserves the elevation button. Translating it here would deprive "elevation required" of
	 * its way out: an already translated sentence is no longer recognised.
	 */
	let { onRefused }: { onRefused: (message: string) => void } = $props();

	let rows = $state<SettingRow[]>([]);
	let drafts = $state<Record<string, string>>({});
	let notice = $state<string | null>(null);
	let testOutcome = $state<string | null>(null);
	let testing = $state(false);
	let saving = $state(false);

	const mailReady = $derived(isMailConfigured(rows));

	const rowOf = (key: string) => rows.find((row) => row.key === key);

	async function load() {
		const { data, error } = await supabase.rpc('instance_settings_read');
		if (error) {
			onRefused(error.message);
			return;
		}

		rows = (data as SettingRow[]) ?? [];
		drafts = Object.fromEntries(rows.map((row) => [row.key, initialValue(row)]));
	}

	/**
	 * Saves a group in one gesture.
	 *
	 * A secret field left empty is skipped and not cleared: otherwise, correcting the port would be enough to
	 * lose the password, and nobody would make the connection. Clearing has its own button.
	 */
	async function save(group: SettingGroup) {
		saving = true;
		notice = null;
		testOutcome = null;

		for (const field of fieldsOf(group)) {
			// The port field binds to a `type="number"` input, which Svelte gives back as a number rather
			// than a string — `.trim()` on it throws, silently in an unhandled rejection, and the save never
			// reaches the database.
			const draft = String(drafts[field.key] ?? '').trim();
			const current = rowOf(field.key);

			if (field.isSecret && draft === '') continue;
			if (!field.isSecret && draft === (current?.value ?? '')) continue;

			const { error } = await supabase.rpc('set_instance_setting', {
				setting_key: field.key,
				setting_value: draft
			});

			if (error) {
				saving = false;
				onRefused(error.message);
				return;
			}
		}

		saving = false;
		notice = t('instance.saved');
		await load();
	}

	async function clearSetting(key: string) {
		const { error } = await supabase.rpc('clear_instance_setting', { setting_key: key });
		if (error) {
			onRefused(error.message);
			return;
		}

		notice = t('instance.cleared');
		await load();
	}

	/**
	 * Asks the edge function for the test, which answers with a cause and not a trace.
	 *
	 * The recipient is not chosen here: the database returns the address of the account clicking, and it is
	 * the only one served. A free field would have made this button a sending form.
	 */
	async function sendTest() {
		testing = true;
		notice = null;
		testOutcome = null;

		const { data, error } = await supabase.functions.invoke('test-instance-mail', { body: {} });

		testing = false;

		if (error) {
			testOutcome = 'failed';
			return;
		}

		const outcome = (data as { outcome?: string; reason?: string } | null)?.outcome ?? 'failed';
		const reason = (data as { reason?: string } | null)?.reason;

		// A role or elevation refusal already knows how to say itself elsewhere: we hand it back to the parent
		// rather than turn it into a "send failed", which would send people looking at the SMTP server.
		if (outcome === 'failed' && reason && adminErrorKey(reason)) {
			onRefused(reason);
			return;
		}

		testOutcome = outcome;
	}

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);

	$effect(() => {
		load();
	});
</script>

<!--
	One field, written once. Both groups have exactly the same display rules, and the rule that matters — a
	secret is never read back — must exist in only one place.
-->
{#snippet settingField(field: SettingField)}
	{@const row = rowOf(field.key)}
	<div class="space-y-1">
		<Label for="setting-{field.key}">{t(`instance.field.${field.key}`)}</Label>
		<Input
			id="setting-{field.key}"
			type={field.kind}
			autocomplete="off"
			bind:value={drafts[field.key]}
			placeholder={t(`instance.placeholder.${field.key}`)}
			data-test-class="instance-field"
		/>
		<p class="text-muted-foreground text-caption">
			{#if field.isSecret && row?.is_set && row.updated_at}
				{t('instance.secretSet', { date: formatDate(row.updated_at) })}
			{:else if field.isSecret}
				{t('instance.secretUnset')}
			{:else}
				{t(`instance.help.${field.key}`)}
			{/if}
		</p>
		{#if field.isSecret && row?.is_set}
			<Button
				variant="outline"
				onclick={() => clearSetting(field.key)}
				data-test-class="instance-clear"
			>
				<Trash2 size={18} aria-hidden="true" />
				{t('instance.clear')}
			</Button>
		{/if}
	</div>
{/snippet}

<h2 class="text-h2 mt-10 font-semibold" id="instance-settings">{t('instance.title')}</h2>
<p class="text-muted-foreground text-label mt-2">{t('instance.hint')}</p>

{#if notice}
	<p class="text-primary mt-4" role="status" data-test-id="instance-notice">{notice}</p>
{/if}

<Card.Root class="mt-6" data-test-id="instance-mail">
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Mail size={18} aria-hidden="true" />
			{t('instance.mailTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<!--
			Said before the fields and not after: somebody arriving here believes email works, and learning it
			after filling in five fields would have no warning value left.
		-->
		{#if !mailReady}
			<p class="text-label" role="status" data-test-id="instance-mail-idle">
				{t('instance.mailIdle')}
			</p>
		{/if}

		{#each fieldsOf('mail') as field (field.key)}
			{@render settingField(field)}
		{/each}

		<div class="flex flex-wrap items-center gap-3">
			<Button onclick={() => save('mail')} disabled={saving} data-test-id="instance-save-mail">
				<Save size={18} aria-hidden="true" />
				{t('instance.save')}
			</Button>
			<Button
				variant="outline"
				onclick={sendTest}
				disabled={testing || !mailReady}
				data-test-id="instance-test-mail"
			>
				<Send size={18} aria-hidden="true" />
				{testing ? t('instance.testing') : t('instance.test')}
			</Button>
		</div>

		{#if testOutcome}
			<p
				class={isMailTestSuccess(testOutcome) ? 'text-primary' : 'text-destructive'}
				role="status"
				data-test-id="instance-test-result"
			>
				{t(mailTestKey(testOutcome))}
			</p>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6" data-test-id="instance-tracker">
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<CircleDot size={18} aria-hidden="true" />
			{t('instance.trackerTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<p class="text-muted-foreground text-label">{t('instance.trackerHint')}</p>

		{#each fieldsOf('tracker') as field (field.key)}
			{@render settingField(field)}
		{/each}

		<Button onclick={() => save('tracker')} disabled={saving} data-test-id="instance-save-tracker">
			<Save size={18} aria-hidden="true" />
			{t('instance.save')}
		</Button>
	</Card.Content>
</Card.Root>
