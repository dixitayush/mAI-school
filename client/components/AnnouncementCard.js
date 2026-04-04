"use client";

import { useEffect, useRef, useCallback } from 'react';
import { Bell, AlertTriangle, AlertCircle, Info, Megaphone, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useQuery, gql } from '@apollo/client';

const GET_ACTIVE_ANNOUNCEMENTS = gql`
    query GetActiveAnnouncements($first: Int, $after: Cursor) {
        allAnnouncements(
            condition: { isActive: true }
            orderBy: CREATED_AT_DESC
            first: $first
            after: $after
        ) {
            pageInfo {
                hasNextPage
                endCursor
            }
            edges {
                cursor
                node {
                    id
                    title
                    content
                    priority
                    targetAudience
                    createdAt
                }
            }
            totalCount
        }
    }
`;

const priorityConfig = {
    urgent: { icon: AlertTriangle, bg: 'bg-red-100', text: 'text-red-600', label: 'Urgent' },
    high: { icon: AlertCircle, bg: 'bg-orange-100', text: 'text-orange-600', label: 'High' },
    normal: { icon: Bell, bg: 'bg-blue-100', text: 'text-blue-600', label: 'Normal' },
    low: { icon: Info, bg: 'bg-zinc-100', text: 'text-zinc-500', label: 'Low' },
};

export default function AnnouncementCard() {
    const { data, loading, fetchMore, networkStatus } = useQuery(GET_ACTIVE_ANNOUNCEMENTS, {
        variables: { first: 5 },
        notifyOnNetworkStatusChange: true,
    });

    const observer = useRef();
    const hasNextPage = data?.allAnnouncements?.pageInfo?.hasNextPage;
    const announcements = data?.allAnnouncements?.edges?.map(e => e.node) || [];
    const isLoadingMore = networkStatus === 3; 

    const lastAnnouncementElementRef = useCallback(node => {
        if (loading || isLoadingMore) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchMore({
                    variables: {
                        after: data.allAnnouncements.pageInfo.endCursor,
                    },
                    updateQuery: (prev, { fetchMoreResult }) => {
                        if (!fetchMoreResult) return prev;
                        const existingIds = new Set(prev.allAnnouncements.edges.map(e => e.node.id));
                        const newEdges = fetchMoreResult.allAnnouncements.edges.filter(
                            e => !existingIds.has(e.node.id)
                        );
                        
                        return {
                            allAnnouncements: {
                                ...fetchMoreResult.allAnnouncements,
                                edges: [
                                    ...prev.allAnnouncements.edges,
                                    ...newEdges,
                                ],
                            },
                        };
                    },
                });
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loading, isLoadingMore, hasNextPage, fetchMore, data]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-sm border border-zinc-100 flex flex-col h-[400px]"
        >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-50 shrink-0">
                <h3 className="text-lg font-semibold text-zinc-900">Recent Announcements</h3>
                {data?.allAnnouncements?.totalCount > 0 && (
                    <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-semibold rounded-full">
                        {data.allAnnouncements.totalCount} active
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4 min-h-0 custom-scrollbar">
                {loading && !announcements.length ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse flex items-start space-x-3 p-3">
                                <div className="w-9 h-9 bg-zinc-200 rounded-lg shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-zinc-200 rounded w-3/4" />
                                    <div className="h-3 bg-zinc-100 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400 h-full flex flex-col items-center justify-center">
                        <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No active announcements</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {announcements.map((announcement, index) => {
                            const config = priorityConfig[announcement.priority] || priorityConfig.normal;
                            const Icon = config.icon;
                            const isLastAnnouncement = index === announcements.length - 1;

                            return (
                                <motion.div
                                    key={announcement.id}
                                    ref={isLastAnnouncement ? lastAnnouncementElementRef : null}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-zinc-50 transition-colors"
                                >
                                    <div className={`p-2 rounded-lg shrink-0 ${config.bg}`}>
                                        <Icon className={`w-4 h-4 ${config.text}`} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between">
                                            <h4 className="text-sm font-medium text-zinc-900 truncate pr-2">
                                                {announcement.title}
                                            </h4>
                                            <span className="text-xs text-zinc-500 whitespace-nowrap shrink-0">
                                                {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-600 mt-1 line-clamp-2">
                                            {announcement.content}
                                        </p>
                                        <div className="flex items-center mt-1.5 space-x-2">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${config.bg} ${config.text}`}>
                                                {config.label}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 truncate">
                                                {announcement.targetAudience === 'all' ? 'Everyone' : announcement.targetAudience}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                        {isLoadingMore && (
                            <div className="py-4 flex justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                            </div>
                        )}
                        {!hasNextPage && announcements.length > 0 && (
                            <div className="py-4 text-center text-xs text-zinc-400">
                                You've reached the end
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* Minimal scrollbar css */}
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #e5e7eb;
                    border-radius: 10px;
                }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb {
                    background-color: #d1d5db;
                }
            `}</style>
        </motion.div>
    );
}
