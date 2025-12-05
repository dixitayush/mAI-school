"use client";

import { Bell, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export default function AnnouncementCard({ announcements = [] }) {
    const mockAnnouncements = [
        {
            id: 1,
            title: 'Welcome Back to School',
            description: 'Management for EduFlow School',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            type: 'info'
        },
        {
            id: 2,
            title: 'Progress Event',
            description: 'EduFlow s commends, and processby Announcement',
            date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            type: 'success'
        }
    ];

    const displayAnnouncements = announcements.length > 0 ? announcements : mockAnnouncements;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
        >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Announcements</h3>

            <div className="space-y-3">
                {displayAnnouncements.map((announcement, index) => (
                    <motion.div
                        key={announcement.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <div className={`
              p-2 rounded-lg
              ${announcement.type === 'info' ? 'bg-blue-100' : 'bg-green-100'}
            `}>
                            {announcement.type === 'info' ? (
                                <Bell className="w-4 h-4 text-blue-600" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-green-600" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                    {announcement.title}
                                </h4>
                                <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                                    {formatDistanceToNow(announcement.date, { addSuffix: true })}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {announcement.description}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
