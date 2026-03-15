"use client";

import { useRef, useCallback } from 'react';
import { useQuery, gql } from '@apollo/client';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

const GET_RECENT_ATTENDANCE = gql`
    query GetRecentAttendance($studentId: UUID!, $first: Int, $after: Cursor) {
        allAttendances(
            condition: { studentId: $studentId }
            orderBy: DATE_DESC
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
                    date
                    status
                    remarks
                }
            }
            totalCount
        }
    }
`;

export default function RecentAttendanceCard({ studentId }) {
    const { data, loading, fetchMore, networkStatus } = useQuery(GET_RECENT_ATTENDANCE, {
        variables: { studentId, first: 7 },
        skip: !studentId,
        notifyOnNetworkStatusChange: true,
    });

    const observer = useRef();
    const hasNextPage = data?.allAttendances?.pageInfo?.hasNextPage;
    const records = data?.allAttendances?.edges?.map(e => e.node) || [];
    const isLoadingMore = networkStatus === 3;

    const lastRecordElementRef = useCallback(node => {
        if (loading || isLoadingMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchMore({
                    variables: {
                        after: data.allAttendances.pageInfo.endCursor,
                    },
                    updateQuery: (prev, { fetchMoreResult }) => {
                        if (!fetchMoreResult) return prev;
                        const existingIds = new Set(prev.allAttendances.edges.map(e => e.node.id));
                        const newEdges = fetchMoreResult.allAttendances.edges.filter(
                            e => !existingIds.has(e.node.id)
                        );

                        return {
                            allAttendances: {
                                ...fetchMoreResult.allAttendances,
                                edges: [
                                    ...prev.allAttendances.edges,
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]"
        >
            <div className="flex items-center space-x-3 p-6 pb-4 border-b border-gray-50 shrink-0 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Recent Attendance</h2>
                    <p className="text-sm text-gray-500">Your presence history</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0 custom-scrollbar">
                {loading && !records.length ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                    </div>
                ) : records.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        <p className="text-sm">No attendance records found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {records.map((record, index) => {
                            const isLastRecord = index === records.length - 1;

                            return (
                                <div
                                    key={record.id}
                                    ref={isLastRecord ? lastRecordElementRef : null}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center space-x-3">
                                        {record.status === 'present' ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        ) : record.status === 'late' ? (
                                            <Clock className="w-5 h-5 text-orange-500 shrink-0" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {new Date(record.date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                            <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                                                <span className={`font-semibold ${
                                                    record.status === 'present' ? 'text-green-600' :
                                                    record.status === 'late' ? 'text-orange-600' : 'text-red-600'
                                                }`}>
                                                    {record.status}
                                                </span>
                                                {record.remarks && <span>• {record.remarks}</span>}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {isLoadingMore && (
                            <div className="py-4 flex justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                            </div>
                        )}
                        {!hasNextPage && records.length > 0 && (
                            <div className="py-2 text-center text-xs text-gray-400">
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
