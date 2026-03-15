"use client";

import { useEffect, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';
import { toast } from 'react-hot-toast';
import { Megaphone } from 'lucide-react';

const GET_LATEST_ANNOUNCEMENT = gql`
    query GetLatestAnnouncement {
        allAnnouncements(
            condition: { isActive: true }
            orderBy: CREATED_AT_DESC
            first: 1
        ) {
            nodes {
                id
                title
                content
                priority
                targetAudience
            }
        }
    }
`;

export default function NotificationListener({ userRole }) {
    const { data } = useQuery(GET_LATEST_ANNOUNCEMENT, {
        pollInterval: 10000, // Check for new announcements every 10 seconds
    });

    const lastSeenAnnouncementId = useRef(null);

    useEffect(() => {
        // Initialize from localStorage on mount
        lastSeenAnnouncementId.current = localStorage.getItem('lastSeenAnnouncementId');
    }, []);

    useEffect(() => {
        const latestAnnouncement = data?.allAnnouncements?.nodes[0];

        if (latestAnnouncement) {
            const { id, title, content, targetAudience, priority } = latestAnnouncement;

            // Check if user is in target audience
            const isTargeted = targetAudience === 'all' || targetAudience === userRole + 's';

            if (isTargeted && id !== lastSeenAnnouncementId.current) {
                // Determine toast style based on priority
                const isUrgent = priority === 'urgent';
                
                toast.custom((t) => (
                    <div
                        className={`${
                            t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ${isUrgent ? 'ring-red-500/20 shadow-red-500/10' : 'ring-black ring-opacity-5'}`}
                    >
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0 pt-0.5">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isUrgent ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'}`}>
                                        <Megaphone className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className={`text-sm font-bold ${isUrgent ? 'text-red-900' : 'text-gray-900'}`}>
                                        {title}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                        {content}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex border-l border-gray-200">
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ), { duration: isUrgent ? 8000 : 5000, position: 'top-right' });

                lastSeenAnnouncementId.current = id;
                localStorage.setItem('lastSeenAnnouncementId', id);
            }
        }
    }, [data, userRole]);

    return null; // This component handles side effects only
}
