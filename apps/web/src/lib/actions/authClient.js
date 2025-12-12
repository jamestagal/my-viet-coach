// Better-Auth client - core settings
import { createAuthClient } from "better-auth/svelte"
import { emailOTPClient, organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [
        emailOTPClient(),
        organizationClient()
    ]
})