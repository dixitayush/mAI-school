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
            className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100"
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-gray-900 mb-2">{value}</h3>

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
                            <span className="text-sm text-gray-500">vs last month</span>
                        </div>
                    )}
                </div>

                <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} shadow-sm`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
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
