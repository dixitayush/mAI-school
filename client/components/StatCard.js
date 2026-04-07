"use client";

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    trendValue,
    color = 'primary',
    delay = 0
}) {
    const colorClasses = {
        primary: 'from-primary-500 to-primary-600',
        blue: 'from-blue-500 to-blue-600',
        purple: 'from-purple-500 to-purple-600',
        orange: 'from-orange-500 to-orange-600',
        green: 'from-green-500 to-green-600',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-medium text-zinc-500 sm:text-sm">{title}</p>
                    <h3 className="mb-2 break-words text-2xl font-bold tabular-nums text-zinc-900 sm:text-3xl">{value}</h3>

                    {trend && (
                        <div className="flex items-center space-x-1">
                            {trend === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                            )}
                            <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                                {trendValue}
                            </span>
                            <span className="text-sm text-zinc-500">vs last month</span>
                        </div>
                    )}
                </div>

                <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-100">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '75%' }}
                    transition={{ delay: delay + 0.3, duration: 0.8, ease: 'easeOut' }}
                    className={`h-full bg-gradient-to-r ${colorClasses[color]}`}
                />
            </div>
        </motion.div>
    );
}
