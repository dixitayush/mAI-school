"use client";

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = {
    primary: { chip: 'from-primary-500 to-primary-700 shadow-primary-600/30', glow: 'bg-primary-400' },
    blue: { chip: 'from-blue-500 to-indigo-600 shadow-blue-600/30', glow: 'bg-blue-400' },
    purple: { chip: 'from-violet-500 to-purple-600 shadow-purple-600/30', glow: 'bg-purple-400' },
    orange: { chip: 'from-orange-400 to-orange-600 shadow-orange-600/30', glow: 'bg-orange-400' },
    green: { chip: 'from-emerald-500 to-green-600 shadow-green-600/30', glow: 'bg-emerald-400' },
    yellow: { chip: 'from-amber-400 to-amber-600 shadow-amber-600/30', glow: 'bg-amber-400' },
    red: { chip: 'from-rose-500 to-red-600 shadow-red-600/30', glow: 'bg-red-400' },
};

export default function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    trendValue,
    color = 'primary',
    delay = 0
}) {
    const c = COLORS[color] || COLORS.primary;
    const up = trend === 'up';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(delay, 0.12), duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            className="group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft transition-shadow hover:shadow-lift sm:p-6"
        >
            {/* Soft accent glow in the corner, brighter on hover. */}
            <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${c.glow} opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-25`}
                aria-hidden
            />

            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-500 sm:text-sm">{title}</p>
                    <h3 className="mt-2 break-words text-2xl font-bold tracking-tight tabular-nums text-zinc-900 sm:text-[1.75rem]">{value}</h3>
                    {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
                </div>

                {Icon && (
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${c.chip} transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3`}>
                        <Icon className="h-5 w-5 text-white" />
                    </div>
                )}
            </div>

            {trend && (
                <div className="relative mt-4 flex items-center gap-2">
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                    >
                        {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {trendValue}
                    </span>
                    <span className="text-xs text-zinc-500">vs last month</span>
                </div>
            )}
        </motion.div>
    );
}
