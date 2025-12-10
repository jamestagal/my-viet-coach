<script>
    import { toast } from '@components/Toast.svelte';


	let email = $state('');
	let subject = $state('');
	let message = $state('');
	let captcha = $state('');

	async function handleSubmit(event) {
        event.preventDefault();

		if (!email || !subject || !message || !captcha) {
			toast.error('Please fill in all fields.');
			return;
		}

		if (captcha !== '7') {
			toast.error('Incorrect answer to the security question.');
			return;
		}

		try {
			const response = await fetch('/api/public/contact', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, subject, message, captcha })
			});

			const result = await response.json();

			if (response.ok) {
				toast.success('Your message has been sent.');
				email = '';
				subject = '';
				message = '';
				captcha = '';
			} else {
				toast.error(result.message || 'An error occurred.');
			}
		} catch (error) {
			toast.error('An unexpected error occurred. Please try again.');
		}
	}
</script>

<svelte:head>
	<title>Contact Us</title>
	<meta name="description" content="Get in touch with us through our contact form." />
</svelte:head>

<section class="mx-auto px-4 py-8 md:py-12">
	<div class="card max-w-2xl mx-auto p-6 md:p-8">
		<h1 class="text-3xl font-bold text-center mb-6">Contact Us</h1>
		<p class="text-center mb-8 text-secondary-3">
			Have a question or feedback? Fill out the form below and we'll get back to you as soon as
			possible.
		</p>

		<form onsubmit={handleSubmit} class="space-y-6">
			<div class="input-container">
				<label for="email" class="text-secondary-3">Your Email</label>
				<div class="input-field">
					<input
						type="email"s
						id="email"
						bind:value={email}
						placeholder="you@example.com"
						required
					/>
				</div>
			</div>

			<div class="input-container">
				<label for="subject" class="text-secondary-3">Subject</label>
				<div class="input-field">
					<input
						type="text"
						id="subject"
						bind:value={subject}
						placeholder="Question about pricing"
						required
					/>
				</div>
			</div>

			<div class="input-container">
				<label for="message" class="text-secondary-3">Message</label>
				<div class="input-field">
					<textarea
						id="message"
						rows="4"
						bind:value={message}
						placeholder="Your message..."
						required
					></textarea>
				</div>
			</div>

			<div class="input-container">
				<label for="captcha" class="text-secondary-3">Security Question: What is 3 + 4?</label>
				<div class="input-field">
					<input
						type="text"
						id="captcha"
						bind:value={captcha}
						placeholder="Your answer"
						required
					/>
				</div>
			</div>

			<button type="submit" class="button action p-2 center w-full">Send Message</button>
		</form>
	</div>
</section>
