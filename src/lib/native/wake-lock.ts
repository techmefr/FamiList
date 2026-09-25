/**
 * Keeps the screen on while cook-along is open (#309): a phone going dark mid-recipe forces the very
 * touch with dirty hands the mode is there to avoid.
 *
 * The browser drops the lock whenever the page is hidden, so it is taken again on return. A browser
 * without the API, or refusing it (low battery), leaves the screen to its usual timeout: nothing breaks.
 */
interface ScreenLock {
	release(): Promise<void>;
}

interface WakeLockNavigator {
	wakeLock?: { request(type: 'screen'): Promise<ScreenLock> };
}

export function keepScreenOn(): () => void {
	if (typeof navigator === 'undefined') return () => {};

	const api = (navigator as WakeLockNavigator).wakeLock;
	if (!api) return () => {};

	let lock: ScreenLock | null = null;
	let released = false;

	const take = async () => {
		if (released || document.visibilityState !== 'visible') return;
		try {
			lock = await api.request('screen');
			if (released) void lock.release();
		} catch {
			lock = null;
		}
	};

	const onVisibility = () => void take();
	document.addEventListener('visibilitychange', onVisibility);
	void take();

	return () => {
		released = true;
		document.removeEventListener('visibilitychange', onVisibility);
		void lock?.release().catch(() => {});
		lock = null;
	};
}
