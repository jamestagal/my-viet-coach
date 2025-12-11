import { authClient } from '$lib/actions/authClient';
import { get } from 'svelte/store';
import slugify from 'slugify';
import validator from 'validator';

// This is a place where we create wrapper functions for the authClient like validating input
// Do not use this file on Server Side

export const User = $state({
    // Custom user methods
})

export const Organization = $state({
    userActiveSessionId: null,
    userActiveOrganizationId: null,
    // Initialize if not already done
    useActiveOrganization() {
        const sessionStore = authClient.useSession();
        const organizationStore = authClient.useActiveOrganization();

        sessionStore.subscribe((value) => {
            const session = value.data?.session || null;
            if (session && session?.id && session.id !== this.userActiveSessionId) {
              this.userActiveSessionId = session.id;
              this.userActiveOrganizationId = session.activeOrganizationId ?? null;
              get(organizationStore)?.refetch?.();
            }
        });

        return organizationStore;
    },
    useListOrganizations() {
        return authClient.useListOrganizations();
    },
    async getBySlug(organizationSlug) {
        try {
            return authClient.organization.getFullOrganization({ query: { organizationSlug } });
        } catch (error) {
            console.error(error);
            return { data: null, error: { message: "Something went wrong, please try again." } };
        }
    },
    async create(name) {
        try {
            // Type validation
            if (!name || typeof name !== 'string') {
                return { data: null, error: { message: 'Invalid input: name must be a string.' } };
            }

        // Content validation
            const trimmedName = name.trim();
            if (!validator.isLength(trimmedName, { min: 3 })) {
                return { data: null, error: { message: 'Name must be at least 3 characters long.' } };
            }

            if(!validator.isAlphanumeric(trimmedName.replace(/\s/g, ''), 'en-US')){
                return { data: null, error: { message: 'Name can only contain letters and numbers.' } };
            }

            let slug = slugify(name, { lower: true, strict: true });
            const maxAttempts = 5; // max attempts to generate a unique slug

            for (let i = 0; i < maxAttempts; i++) {
                const result = await authClient.organization.create({ name, slug });

                // Return early if the organization is created successfully
                if (result.data && !result.error) {
                    return result;
                }

                // Return early error if it's [NOT] an ORGANIZATION_ALREADY_EXISTS error
                if (result.error.code !== 'ORGANIZATION_ALREADY_EXISTS') {
                    return result;
                }

                // Generate a random slug if the organization already exists and try again
                slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
            }

            // Return error if the organization could not be created after max attempts
            return { data: null, error: { message: `Could not generate a unique slug after ${maxAttempts} attempts.` } };
         } catch (error) {
            console.error(error);
            return { data: null, error: { message: "Something went wrong, please try again." } };
        }
    },
    async toggleActive(organizationId) {
        let result = { data: null, error: null };
        try {
            if (organizationId === this.userActiveOrganizationId) {
                // If the organization is already active, set it to null
                result = await authClient.organization.setActive({ organizationId: null })
            } else {
                // If the organization is not active, set it as active organization
                result = await authClient.organization.setActive({ organizationId })
            }
         
            this.userActiveOrganizationId = result.data?.id ?? null;
            return result;
        } catch (error) {
            console.error(error);
            return { data: null, error: { message: "Failed to toggle active organization" } };
        }
    }
})
