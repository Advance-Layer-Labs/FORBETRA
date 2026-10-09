<script lang="ts">
	import type { PageData } from './$types';

	import { MessageSquare } from 'lucide-svelte';
	import { renderMarkdown } from '$lib/utils/markdown';

	const { data }: { data: PageData } = $props();

	type Message = { id: number; role: 'user' | 'assistant'; content: string };

	let messages = $state<Message[]>([]);
	let nextMessageId = $state(0);
	let input = $state('');
	let isStreaming = $state(false);
	let scrollContainer = $state<HTMLElement | null>(null);

	const scrollToBottom = () => {
		if (scrollContainer) {
			requestAnimationFrame(() => {
				scrollContainer!.scrollTop = scrollContainer!.scrollHeight;
			});
		}
	};

	let streamingTimeout: ReturnType<typeof setTimeout> | null = null;

	const sendMessage = async () => {
		const text = input.trim();
		if (!text || isStreaming) return;

		const userMessage: Message = { id: nextMessageId++, role: 'user', content: text };
		messages = [...messages, userMessage];
		input = '';
		isStreaming = true;
		scrollToBottom();

		// Safety timeout: reset isStreaming after 30 seconds if still true
		if (streamingTimeout) clearTimeout(streamingTimeout);
		streamingTimeout = setTimeout(() => {
			if (isStreaming) {
				isStreaming = false;
				messages[messages.length - 1].content =
					messages[messages.length - 1].content || 'Response timed out. Please try again.';
				messages = [...messages];
			}
		}, 30000);

		const assistantMessage: Message = { id: nextMessageId++, role: 'assistant', content: '' };
		messages = [...messages, assistantMessage];

		try {
			const response = await fetch('/api/insights/ask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: messages.filter((m) => m.content.length > 0) })
			});

			if (!response.ok) {
				const err = await response.json();
				messages[messages.length - 1].content =
					err.error || 'Something went wrong. Please try again.';
				messages = [...messages];
				isStreaming = false;
				return;
			}

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (!reader) {
				messages[messages.length - 1].content = 'Failed to connect. Please try again.';
				messages = [...messages];
				isStreaming = false;
				return;
			}

			let buffer = '';
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const payload = line.slice(6).trim();
						if (payload === '[DONE]') break;
						try {
							const parsed = JSON.parse(payload);
							if (parsed.text) {
								messages[messages.length - 1].content += parsed.text;
								messages = [...messages];
								scrollToBottom();
							}
							if (parsed.error) {
								messages[messages.length - 1].content += '\n\n[Error: ' + parsed.error + ']';
								messages = [...messages];
							}
						} catch {
							/* SSE parse – non-JSON lines are expected */
						}
					}
				}
			}
		} catch {
			messages[messages.length - 1].content = 'Network error. Please check your connection.';
			messages = [...messages];
		} finally {
			if (streamingTimeout) {
				clearTimeout(streamingTimeout);
				streamingTimeout = null;
			}
			isStreaming = false;
			scrollToBottom();
		}
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	const suggestedQuestions = [
		'What patterns do you see in my effort scores?',
		'How does my self-assessment compare to my reviewers?',
		'What should I focus on next week?',
		'Am I making progress toward my goal?'
	];
</script>

<svelte:head>
	<title>Ask | Forbetra</title>
</svelte:head>

<section class="mx-auto flex h-[calc(100dvh-2rem)] max-w-3xl flex-col p-4 pb-24 lg:pb-4">
	<div class="mb-4">
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<nav aria-label="Breadcrumb" class="mb-2">
			<ol class="flex items-center gap-1.5 text-sm text-text-tertiary">
				<li>
					<a
						href="/individual"
						class="rounded transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
						>Journeys</a
					>
				</li>
				<li aria-hidden="true" class="text-text-muted">/</li>
				<li><span class="font-medium text-text-primary">Ask</span></li>
			</ol>
		</nav>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<h1 class="text-2xl font-bold text-text-primary">Ask About Your Data</h1>
	</div>

	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if !data.hasActiveCycle}
		<div class="flex flex-1 items-center justify-center">
			<div
				class="max-w-md rounded-2xl border border-border-default bg-surface-raised p-8 text-center"
			>
				<MessageSquare class="mx-auto mb-3 h-10 w-10 text-text-muted" />
				<p class="text-lg font-semibold text-text-secondary">No active journey</p>
				<p class="mt-1 text-sm text-text-tertiary">
					Start a journey to ask questions about your development data.
				</p>
				<a
					href="/individual/new-cycle"
					class="mt-4 inline-block rounded-lg bg-accent px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
				>
					Start a journey
				</a>
			</div>
		</div>
	{:else}
		<!-- Messages -->
		<div bind:this={scrollContainer} class="flex-1 space-y-4 overflow-y-auto pb-4">
			{#if messages.length === 0}
				<div class="flex h-full flex-col items-center justify-center text-center">
					<MessageSquare class="mx-auto mb-4 h-12 w-12 text-accent" />
					<p class="text-lg font-semibold text-text-secondary">Hi {data.userName}!</p>
					<p class="mt-1 max-w-sm text-sm text-text-tertiary">
						Ask me anything about your development data — patterns, trends, comparisons, or
						recommendations.
					</p>
					<div class="mt-6 flex flex-wrap justify-center gap-2">
						{#each suggestedQuestions as question (question)}
							<button
								type="button"
								onclick={() => {
									input = question;
									sendMessage();
								}}
								class="rounded-full border border-accent/20 bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent-muted/80"
							>
								{question}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				{#each messages as message (message.id)}
					<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed {message.role ===
							'user'
								? 'bg-accent text-white'
								: 'border border-border-default bg-surface-raised text-text-primary'}"
						>
							{#if message.role === 'assistant' && message.content === '' && isStreaming}
								<div class="flex items-center gap-1.5">
									<div class="h-2 w-2 animate-pulse rounded-full bg-text-muted"></div>
									<div
										class="h-2 w-2 animate-pulse rounded-full bg-text-muted"
										style="animation-delay: 0.2s"
									></div>
									<div
										class="h-2 w-2 animate-pulse rounded-full bg-text-muted"
										style="animation-delay: 0.4s"
									></div>
								</div>
							{:else}
								<!-- eslint-disable svelte/no-at-html-tags -->
								<div class="prose-chat">{@html renderMarkdown(message.content)}</div>
								<!-- eslint-enable svelte/no-at-html-tags -->
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Input -->
		<div class="border-t border-border-default pt-3">
			<div class="flex items-end gap-2">
				<textarea
					bind:value={input}
					onkeydown={handleKeydown}
					aria-label="Ask a question about your data"
					placeholder="Ask about your progress, patterns, or what to focus on..."
					rows="1"
					disabled={isStreaming}
					class="flex-1 resize-none rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary transition-all placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none disabled:opacity-60"
				></textarea>
				<button
					type="button"
					onclick={sendMessage}
					disabled={!input.trim() || isStreaming}
					aria-label="Send message"
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 19V5m0 0l-7 7m7-7l7 7"
						/>
					</svg>
				</button>
			</div>
			<p class="text-2xs mt-2 text-center text-text-muted">
				AI responses are based on your actual data. Not a substitute for professional coaching.
			</p>
		</div>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</section>
