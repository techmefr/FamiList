<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '$i18n/index.svelte';
	import { timers } from '$stores/timers.svelte';
	import { Button } from '$components/ui/button';
	import { AlarmClock, Plus, X } from '@lucide/svelte';

	/**
	 * A timer that ran out (#310), over whatever screen is open: the person may have left cook-along, or be
	 * on another list. Big, worded and iconed, so it does not rest on the flashing alone.
	 */
	const ringing = $derived(timers.ringing);
	let heading = $state<HTMLElement | null>(null);

	$effect(() => {
		if (ringing.length > 0) void tick().then(() => heading?.focus());
	});
</script>

{#if ringing.length > 0}
	<div
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="timer-alarm-title"
		aria-describedby="timer-alarm-list"
		data-test-id="timer-alarm"
		class="bg-background/95 fixed inset-0 z-[60] overflow-y-auto p-[8px]"
	>
		<!-- Fixed pixel margins: at the largest text size, rem padding would eat half the phone's width. -->
		<div class="flex min-h-full items-center justify-center">
			<div
				class="border-destructive bg-card text-card-foreground w-full max-w-md rounded-2xl border-4 p-[14px] shadow-xl motion-safe:animate-pulse"
			>
				<h2
					id="timer-alarm-title"
					bind:this={heading}
					tabindex="-1"
					class="text-h2 flex items-center gap-3 font-semibold break-words hyphens-auto outline-none"
				>
					<AlarmClock size={36} class="text-destructive shrink-0" aria-hidden="true" />
					<span class="min-w-0">{t('timers.doneTitle')}</span>
				</h2>

				<ul id="timer-alarm-list" class="mt-4 space-y-4">
					{#each ringing as timer (timer.id)}
						<li class="space-y-3" data-test-class="timer-alarm-item">
							<p class="text-product break-words hyphens-auto [overflow-wrap:anywhere]">
								<span class="font-semibold">{timer.recipeName}</span>
								— {t('timers.stepLabel', { rank: timer.stepIndex + 1 })} · {timer.label}
							</p>
							<div class="flex flex-col gap-3 sm:flex-row">
								<Button
									onclick={() => timers.stop(timer.id)}
									data-test-class="timer-alarm-stop"
									class="fl-press h-auto min-h-14 flex-1 py-2 text-lg whitespace-normal"
								>
									<X size={22} aria-hidden="true" />
									{t('timers.stopAlarm')}
								</Button>
								<Button
									variant="outline"
									onclick={() => timers.addMinute(timer.id)}
									data-test-class="timer-alarm-add"
									class="fl-press h-auto min-h-14 flex-1 py-2 whitespace-normal"
								>
									<Plus size={22} aria-hidden="true" />
									{t('timers.addMinute')}
								</Button>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
{/if}
