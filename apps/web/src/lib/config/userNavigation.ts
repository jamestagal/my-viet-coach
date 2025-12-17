import {
	LayoutDashboard,
	Mic,
	BookOpen,
	Settings,
	User,
	MessageSquare,
	ClipboardCheck
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export interface NavLink {
	label: string;
	href: string;
	icon: ComponentType;
	disabled?: boolean;
}

export const userLinks: NavLink[] = [
	{
		label: 'Dashboard',
		href: '/dashboard',
		icon: LayoutDashboard
	},
	{
		label: 'Practice',
		href: '/practice',
		icon: Mic
	},
	{
		label: 'Conversations',
		href: '/conversations',
		icon: MessageSquare
	},
	{
		label: 'Review',
		href: '/review/corrections',
		icon: ClipboardCheck
	},
	{
		label: 'Lessons',
		href: '/lessons',
		icon: BookOpen,
		disabled: true
	},
	{
		label: 'Account',
		href: '/account',
		icon: User,
		disabled: true
	},
	{
		label: 'Settings',
		href: '/settings',
		icon: Settings,
		disabled: true
	}
];
