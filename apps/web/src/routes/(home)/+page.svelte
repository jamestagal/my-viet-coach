<script lang="ts">
	import { PUBLIC_APP_NAME } from '$env/static/public';
	import { ArrowRight, MessageCircle, Sparkles, BookOpen } from 'lucide-svelte';
	import { Newsletter } from '$lib/components/dynamic';
</script>

<svelte:head>
	<title>{PUBLIC_APP_NAME} | Learn Vietnamese Through Conversation</title>
</svelte:head>

<div class="min-h-[calc(100vh-5rem)] paper-texture">
	<!-- Hero Section -->
	<section class="relative overflow-hidden">
		<!-- Decorative elements -->
		<div class="absolute top-0 left-0 w-full ink-stroke"></div>
		<div class="absolute top-20 right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
		<div class="absolute bottom-20 left-10 w-40 h-40 bg-accent/5 rounded-full blur-3xl"></div>

		<div class="container mx-auto px-4 py-20 md:py-32 relative">
			<div class="max-w-3xl mx-auto text-center">
				<!-- Vietnamese greeting -->
				<p class="text-primary font-medium mb-4 viet-text tracking-wide">
					Xin chào và chào mừng
				</p>

				<h1 class="text-5xl md:text-7xl text-foreground mb-6 leading-tight">
					Learn Vietnamese
					<span class="block text-primary">Through Conversation</span>
				</h1>

				<p class="text-xl text-muted-foreground mb-10 font-light max-w-xl mx-auto leading-relaxed">
					Practice speaking Vietnamese with an AI tutor that adapts to your level.
					Natural conversations, gentle corrections, cultural context.
				</p>

				<div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
					<a
						href="/login"
						class="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg group"
					>
						<span>Bắt đầu học</span>
						<ArrowRight class="w-5 h-5 transition-transform group-hover:translate-x-1" />
					</a>
					<span class="text-muted-foreground text-sm">Start Learning</span>
				</div>
			</div>
		</div>

		<div class="ink-stroke max-w-2xl mx-auto"></div>
	</section>

	<!-- Features Section -->
	<section class="container mx-auto px-4 py-20">
		<div class="max-w-4xl mx-auto">
			<h2 class="text-3xl md:text-4xl text-center mb-16 text-foreground">
				How It Works
			</h2>

			<div class="grid md:grid-cols-3 gap-8">
				<!-- Feature 1 -->
				<div class="text-center group">
					<div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-card border border-border flex items-center justify-center transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-md">
						<MessageCircle class="w-7 h-7 text-primary" />
					</div>
					<h3 class="text-xl mb-3 text-foreground">Natural Conversations</h3>
					<p class="text-muted-foreground leading-relaxed">
						Practice real Vietnamese dialogues on topics you care about—food, travel, family, and more.
					</p>
				</div>

				<!-- Feature 2 -->
				<div class="text-center group">
					<div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-card border border-border flex items-center justify-center transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-md">
						<Sparkles class="w-7 h-7 text-primary" />
					</div>
					<h3 class="text-xl mb-3 text-foreground">Adaptive Difficulty</h3>
					<p class="text-muted-foreground leading-relaxed">
						From beginner to advanced—your tutor adjusts vocabulary and complexity to match your level.
					</p>
				</div>

				<!-- Feature 3 -->
				<div class="text-center group">
					<div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-card border border-border flex items-center justify-center transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-md">
						<BookOpen class="w-7 h-7 text-primary" />
					</div>
					<h3 class="text-xl mb-3 text-foreground">Gentle Corrections</h3>
					<p class="text-muted-foreground leading-relaxed">
						Learn proper diacritics, grammar, and natural phrasing through supportive feedback.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Example Conversation -->
	<section class="container mx-auto px-4 py-20">
		<div class="max-w-2xl mx-auto">
			<div class="bg-card border border-border rounded-2xl p-8 shadow-sm">
				<p class="text-sm text-muted-foreground mb-6 text-center">Example conversation</p>

				<div class="space-y-4">
					<div class="flex justify-end">
						<div class="chat-bubble-user px-4 py-3 max-w-[80%]">
							<p class="viet-text">Xin chào! Tôi muốn học tiếng Việt.</p>
						</div>
					</div>

					<div class="flex justify-start">
						<div class="chat-bubble-assistant px-4 py-3 max-w-[80%]">
							<p class="viet-text">Chào bạn! Rất vui được gặp bạn. Bạn đã học tiếng Việt bao lâu rồi?</p>
						</div>
					</div>

					<div class="flex justify-end">
						<div class="chat-bubble-user px-4 py-3 max-w-[80%]">
							<p class="viet-text">Tôi học khoảng một năm.</p>
						</div>
					</div>

					<div class="flex justify-start">
						<div class="chat-bubble-assistant px-4 py-3 max-w-[80%]">
							<p class="viet-text">Tuyệt vời! Một năm là thời gian tốt để có nền tảng. Bạn thích nói về chủ đề gì nhất?</p>
						</div>
					</div>
				</div>

				<div class="text-center mt-8">
					<a
						href="/login"
						class="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-medium"
					>
						<span>Start your conversation</span>
						<ArrowRight class="w-4 h-4" />
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- Newsletter Section -->
	<section class="container mx-auto px-4 py-16">
		<div class="max-w-md mx-auto text-center">
			<h2 class="text-2xl md:text-3xl text-foreground mb-4">
				Stay Updated
			</h2>
			<p class="text-muted-foreground mb-6">
				Get weekly Vietnamese learning tips and updates on new features.
			</p>
			<Newsletter saveInBrowser={true} />
		</div>
	</section>

	<!-- Footer accent -->
	<div class="ink-stroke w-full"></div>
</div>
