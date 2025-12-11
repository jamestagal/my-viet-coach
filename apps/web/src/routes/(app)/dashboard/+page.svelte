<script lang="ts">
	import { page } from '$app/state';
	import { toast } from '$lib/components/ui/toast';
	import { authClient } from '$lib/actions/authClient';
	import { ArrowRight, MessageCircle, Clock, TrendingUp, BookOpen, Mic } from 'lucide-svelte';

	const session = authClient.useSession();

	// Placeholder stats - will be replaced with real data
	let stats = $state({
		sessionsCompleted: 0,
		minutesPracticed: 0,
		currentStreak: 0,
		wordsLearned: 0
	});

	// Quick practice topics
	const topics = [
		{ id: 'greeting', name: 'Greetings', nameVi: 'Chào hỏi', icon: MessageCircle },
		{ id: 'food', name: 'Food & Dining', nameVi: 'Ẩm thực', icon: BookOpen },
		{ id: 'travel', name: 'Travel', nameVi: 'Du lịch', icon: TrendingUp },
		{ id: 'daily', name: 'Daily Life', nameVi: 'Cuộc sống', icon: Clock }
	];

	$effect(() => {
		const welcome = $page.url.searchParams.get('welcome');
		if (welcome === 'true') {
			setTimeout(() => {
				toast.success('Chào mừng bạn! Welcome aboard!');
			}, 1200);
		}
		if ($page.url.searchParams.get('toastError')) {
			toast.error($page.url.searchParams.get('toastError'));
		}
	});
</script>

<svelte:head>
	<title>Dashboard | Viet Coach</title>
</svelte:head>

<div class="min-h-[calc(100vh-3.5rem)]">
	<!-- Welcome Section -->
	<section class="mb-8">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<p class="text-primary font-medium viet-text mb-1">Xin chào!</p>
				<h1 class="text-2xl md:text-3xl text-foreground">
					Welcome back{#if $session.data?.user?.name}, {$session.data.user.name}{/if}
				</h1>
				<p class="text-muted-foreground mt-1">Ready to practice your Vietnamese?</p>
			</div>
			<a
				href="/practice"
				class="inline-flex items-center gap-3 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 group self-start sm:self-auto"
			>
				<Mic class="w-5 h-5" />
				<span>Start Practice</span>
				<ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
			</a>
		</div>
	</section>

	<!-- Stats Grid -->
	<section class="mb-8">
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center gap-3 mb-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<MessageCircle class="w-4 h-4 text-primary" />
					</div>
					<span class="text-sm text-muted-foreground">Sessions</span>
				</div>
				<p class="text-2xl font-semibold text-foreground">{stats.sessionsCompleted}</p>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center gap-3 mb-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<Clock class="w-4 h-4 text-primary" />
					</div>
					<span class="text-sm text-muted-foreground">Minutes</span>
				</div>
				<p class="text-2xl font-semibold text-foreground">{stats.minutesPracticed}</p>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center gap-3 mb-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<TrendingUp class="w-4 h-4 text-primary" />
					</div>
					<span class="text-sm text-muted-foreground">Streak</span>
				</div>
				<p class="text-2xl font-semibold text-foreground">{stats.currentStreak} days</p>
			</div>
			<div class="bg-card border border-border rounded-xl p-4">
				<div class="flex items-center gap-3 mb-2">
					<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<BookOpen class="w-4 h-4 text-primary" />
					</div>
					<span class="text-sm text-muted-foreground">Words</span>
				</div>
				<p class="text-2xl font-semibold text-foreground">{stats.wordsLearned}</p>
			</div>
		</div>
	</section>

	<!-- Quick Practice Topics -->
	<section class="mb-8">
		<h2 class="text-lg font-medium text-foreground mb-4">Quick Practice</h2>
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
			{#each topics as topic}
				<a
					href="/practice?topic={topic.id}"
					class="bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all duration-300 group"
				>
					<div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
						<topic.icon class="w-5 h-5 text-primary" />
					</div>
					<p class="font-medium text-foreground">{topic.name}</p>
					<p class="text-sm text-muted-foreground viet-text">{topic.nameVi}</p>
				</a>
			{/each}
		</div>
	</section>

	<!-- Getting Started / Tips -->
	<section>
		<div class="bg-card border border-border rounded-xl p-6">
			<h2 class="text-lg font-medium text-foreground mb-4">Tips for Learning Vietnamese</h2>
			<div class="grid md:grid-cols-2 gap-4">
				<div class="flex gap-3">
					<div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
						<span class="text-sm">1</span>
					</div>
					<div>
						<p class="font-medium text-foreground">Practice the tones</p>
						<p class="text-sm text-muted-foreground">Vietnamese has 6 tones. Focus on hearing and reproducing them correctly.</p>
					</div>
				</div>
				<div class="flex gap-3">
					<div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
						<span class="text-sm">2</span>
					</div>
					<div>
						<p class="font-medium text-foreground">Use diacritics</p>
						<p class="text-sm text-muted-foreground">The marks above and below letters change meaning completely.</p>
					</div>
				</div>
				<div class="flex gap-3">
					<div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
						<span class="text-sm">3</span>
					</div>
					<div>
						<p class="font-medium text-foreground">Speak daily</p>
						<p class="text-sm text-muted-foreground">Even 10 minutes of conversation practice helps build fluency.</p>
					</div>
				</div>
				<div class="flex gap-3">
					<div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
						<span class="text-sm">4</span>
					</div>
					<div>
						<p class="font-medium text-foreground">Learn phrases</p>
						<p class="text-sm text-muted-foreground">Start with common phrases rather than individual words.</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>
