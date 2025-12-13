import { env } from '$env/dynamic/public';

export const load = async () => {
	return {
		env: {
			PUBLIC_PROJECT_NAME: env.PUBLIC_PROJECT_NAME,
			PUBLIC_DEFAULT_TITLE: env.PUBLIC_DEFAULT_TITLE,
			PUBLIC_DEFAULT_DESCRIPTION: env.PUBLIC_DEFAULT_DESCRIPTION,
			PUBLIC_ORIGIN: env.PUBLIC_ORIGIN
		}
	};
};
