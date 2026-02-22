'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    DollarSign,
    Clock,
    Users,
    UserCircle,
    CheckCircle2,
    CircleDashed,
    ArrowRight,
    ShieldCheck,
    AlertCircle,
    FileText
} from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { WalletAddress } from '@/components/wallet/WalletAddress';

export default function MissionDetailsPage() {
    const params = useParams();
    const id = params?.id || '1';

    // Mock Mission Data
    const mission = {
        id: id,
        title: 'Implement Dark Mode across all UI Components',
        description: `We need to properly support dark mode across all the dashboard components, including charts, tables, and modals. The current implementation only works for the top navigation.\n\nRequirements:\n- Tailwind dark mode classes applied properly.\n- Recharts theme adjusts automatically.\n- Modals and popovers background colors are updated.\n- Inputs have the correct focus state in dark mode.`,
        reward: 500,
        currency: 'USDC',
        fundedAmount: 350, // Progress indicator: 350 / 500
        status: 'pending', // 'funded', 'pending', 'completed'
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // 3 days, 4 hours from now
        creator: {
            name: 'Alice.eth',
            avatar: 'https://i.pravatar.cc/150?u=alice',
            address: '0x1A2B...3C4D',
        },
        contributors: [
            { id: 1, name: 'Bob', avatar: 'https://i.pravatar.cc/150?u=bob' },
            { id: 2, name: 'Charlie', avatar: 'https://i.pravatar.cc/150?u=charlie' },
            { id: 3, name: 'Dave', avatar: 'https://i.pravatar.cc/150?u=dave' },
        ],
        timeline: [
            { id: 1, label: 'Mission Created', date: 'Oct 24, 2024', status: 'completed' },
            { id: 2, label: 'Escrow Partially Funded', date: 'Oct 25, 2024', status: 'current' },
            { id: 3, label: 'Work Submitted', date: '--', status: 'upcoming' },
            { id: 4, label: 'Review Period', date: '--', status: 'upcoming' },
            { id: 5, label: 'Completed & Paid', date: '--', status: 'upcoming' },
        ]
    };

    const fundedPercentage = Math.min(100, Math.round((mission.fundedAmount / mission.reward) * 100));

    // Smart Escrow Badge Color/Icon
    const getEscrowBadge = (status: string) => {
        switch (status) {
            case 'funded':
                return { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800', icon: ShieldCheck, label: 'Fully Funded' };
            case 'pending':
                return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', icon: AlertCircle, label: 'Funding Pending' };
            case 'completed':
                return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800', icon: CheckCircle2, label: 'Completed' };
            default:
                return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: CircleDashed, label: 'Unknown' };
        }
    };

    const badgeInfo = getEscrowBadge(mission.status);
    const BadgeIcon = badgeInfo.icon;

    // Countdown timer logic
    const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number }>({ days: 0, hours: 0, minutes: 0 });

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = mission.deadline.getTime() - now;

            if (distance < 0) {
                clearInterval(timer);
                return;
            }

            setTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [mission.deadline]);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Top Navigation */}
            <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 py-4 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Gatherraa</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <WalletAddress />
                        <WalletButton />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
                    <span className="hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer">Missions</span>
                    <span className="text-gray-300 dark:text-gray-600">/</span>
                    <span className="text-gray-900 dark:text-gray-200 font-medium truncate max-w-[200px] sm:max-w-none">#{mission.id} - {mission.title}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Main Content (Left Column) */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Mission Header Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
                                    {mission.title}
                                </h1>

                                {/* Smart Escrow Badge */}
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium whitespace-nowrap ${badgeInfo.color}`}>
                                    <BadgeIcon className="w-4 h-4" />
                                    {badgeInfo.label}
                                </div>
                            </div>

                            {/* Advanced UI: Escrow Progress Indicator */}
                            <div className="mb-8 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Escrow Funding Target</span>
                                        <div className="mt-1 flex items-baseline gap-2">
                                            <span className="text-lg font-bold text-gray-900 dark:text-white">${mission.fundedAmount}</span>
                                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/ ${mission.reward} {mission.currency}</span>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{fundedPercentage}%</span>
                                </div>
                                {/* Progress Bar Track */}
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${fundedPercentage === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                                        style={{ width: `${fundedPercentage}%` }}
                                    />
                                </div>
                            </div>

                            <div className="prose prose-blue dark:prose-invert max-w-none">
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                                    <FileText className="w-5 h-5 text-gray-400" />
                                    Mission Details
                                </h3>
                                <div className="text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                                    {mission.description}
                                </div>
                            </div>
                        </div>

                        {/* Contributors Section */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                    <Users className="w-5 h-5 text-gray-400" />
                                    Contributors ({mission.contributors.length})
                                </h3>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {mission.contributors.map((contributor) => (
                                    <div key={contributor.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors py-2 px-4 rounded-full border border-gray-200 dark:border-gray-700 cursor-pointer">
                                        <img
                                            src={contributor.avatar}
                                            alt={contributor.name}
                                            className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{contributor.name}</span>
                                    </div>
                                ))}
                                <button className="flex items-center gap-2 py-2 px-4 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors text-sm font-medium">
                                    + Apply
                                </button>
                            </div>
                        </div>

                        {/* Timeline Section */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-8">
                            <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Timeline Status</h3>
                            <div className="relative pl-6 sm:pl-8 space-y-6 sm:space-y-8 before:absolute before:inset-0 before:ml-2.5 sm:before:ml-3 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-500 before:via-gray-300 before:to-gray-200 dark:before:via-gray-600 dark:before:to-gray-700">
                                {mission.timeline.map((step, index) => (
                                    <div key={step.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        {/* Icon */}
                                        <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-800 absolute -left-[18px] sm:-left-[20px] md:left-1/2 md:-translate-x-1/2 shadow shrink-0 ${step.status === 'completed' ? 'text-green-500' :
                                                step.status === 'current' ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'
                                            }`}>
                                            {step.status === 'completed' ? <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 fill-current text-white" /> :
                                                step.status === 'current' ? <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-blue-500 rounded-full animate-pulse" /> :
                                                    <CircleDashed className="w-3 h-3 sm:w-4 sm:h-4" />}
                                        </div>

                                        {/* Content */}
                                        <div className="w-full md:w-[calc(50%-2.5rem)] ml-4 md:ml-0 bg-white dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-sm transition-all hover:shadow-md">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                <span className={`font-medium ${step.status === 'completed' ? 'text-gray-900 dark:text-white' :
                                                        step.status === 'current' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                                                    }`}>{step.label}</span>
                                                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-md w-fit">{step.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Aside (Right Column) */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Action Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 sticky top-24">

                            {/* Reward Display */}
                            <div className="text-center mb-6 z-10">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Bounty Reward</p>
                                <div className="flex items-center justify-center gap-2">
                                    <DollarSign className="w-8 h-8 text-green-500" />
                                    <span className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">{mission.reward}</span>
                                    <span className="text-xl font-bold text-gray-400 dark:text-gray-500 align-bottom">{mission.currency}</span>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 dark:border-gray-700 my-6"></div>

                            {/* Countdown Timer */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3 text-sm font-medium">
                                    <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                        <Clock className="w-4 h-4" /> Expires In
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-100 dark:border-red-800/50">
                                        <span className="block text-xl font-bold text-red-600 dark:text-red-400">{timeLeft.days}</span>
                                        <span className="text-[10px] uppercase font-bold text-red-500/80">Days</span>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-100 dark:border-red-800/50">
                                        <span className="block text-xl font-bold text-red-600 dark:text-red-400">{timeLeft.hours}</span>
                                        <span className="text-[10px] uppercase font-bold text-red-500/80">Hours</span>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 border border-red-100 dark:border-red-800/50">
                                        <span className="block text-xl font-bold text-red-600 dark:text-red-400">{timeLeft.minutes}</span>
                                        <span className="text-[10px] uppercase font-bold text-red-500/80">Mins</span>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transform transition-all hover:-translate-y-0.5 shadow-md shadow-blue-500/30">
                                Submit Work
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            <p className="text-xs text-center text-gray-400 mt-3">Smart contract interaction required</p>
                        </div>

                        {/* Creator Info */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Mission Creator</h3>
                            <div className="flex items-center gap-4">
                                <div className="">
                                    <img
                                        src={mission.creator.avatar}
                                        alt={mission.creator.name}
                                        className="w-12 h-12 rounded-full ring-2 ring-gray-100 dark:ring-gray-700"
                                    />
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900 dark:text-white text-lg leading-tight">{mission.creator.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">{mission.creator.address}</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
