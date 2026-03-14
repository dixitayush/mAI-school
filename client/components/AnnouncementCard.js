"use client";

import { Bell, AlertTriangle, AlertCircle, Info, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, gql } from '@apollo/client';

const GET_ACTIVE_ANNOUNCEMENTS = gql`
    query GetActiveAnnouncements {
        allAnnouncements(
            condition: { isActive: true }
            orderBy: CREATED_AT_DESC
            first: 5
        ) {
            nodes {
                id
                title
                content
                priority
                targetAudience
                createdAt
            }
        }
    }
`;

const priorityConfig = {
    urgent: { icon: AlertTriangle, bg: 'bg-red-100', text: 'text-red-600', label: 'Urgent' },
    high: { icon: AlertCircle, bg: 'bg-orange-100', text: 'text-orange-600', label: 'High' },
    normal: { icon: Bell, bg: 'bg-blue-100', text: 'text-blue-600', label: 'Normal' },
    low: { icon: Info, bg: 'bg-gray-100', text: 'text-gray-500', label: 'Low' },
};

export default function AnnouncementCard() {
    const { data, loading } = useQuery(GET_ACTIVE_ANNOUNCEMENTS);
    const announcements = data?.allAnnouncements?.nodes || [];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Announcements</h3>
                {announcements.length > 0 && (
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full">
                        {announcements.length} active
                    </span>
                )}
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex items-start space-x-3 p-3">
                            <div className="w-9 h-9 bg-gray-200 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4" />
                                <div className="h-3 bg-gray-100 rounded w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active announcements</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {announcements.map((announcement, index) => {
                        const config = priorityConfig[announcement.priority] || priorityConfig.normal;
                        const Icon = config.icon;

                        return (
                            <motion.div
                                key={announcement.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className={`p-2 rounded-lg ${config.bg}`}>
                                    <Icon className={`w-4 h-4 ${config.text}`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <h4 className="text-sm font-medium text-gray-900 truncate">
                                            {announcement.title}
                                        </h4>
                                        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                        {announcement.content}
                                    </p>
                                    <div className="flex items-center mt-1.5 space-x-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${config.bg} ${config.text}`}>
                                            {config.label}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {announcement.targetAudience === 'all' ? 'Everyone' : announcement.targetAudience}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
}
