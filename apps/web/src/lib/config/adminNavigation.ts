import {
	LayoutDashboard,
	Package,
	Users,
	CreditCard,
	Settings,
	ArrowLeft
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export interface NavLink {
	label: string;
	href: string;
	icon: ComponentType;
	disabled?: boolean;
}

export const adminLinks: NavLink[] = [
	{
		label: 'Dashboard',
		href: '/admin/dashboard',
		icon: LayoutDashboard
	},
	{
		label: 'Products',
		href: '/admin/products',
		icon: Package
	},
	{
		label: 'Users',
		href: '/admin/users',
		icon: Users
	},
	{
		label: 'Subscriptions',
		href: '/admin/subscriptions',
		icon: CreditCard
	},
	{
		label: 'Settings',
		href: '/admin/settings',
		icon: Settings,
		disabled: true
	}
];

export const backToAppLink: NavLink = {
	label: 'Back to App',
	href: '/dashboard',
	icon: ArrowLeft
};
