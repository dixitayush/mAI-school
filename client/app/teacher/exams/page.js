"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, gql } from '@apollo/client';
import { FileText, Award, Loader2, Calendar, BookOpen, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const GET_TEACHER_EXAMS = gql`
  query GetTeacherExams {
    allExams {
      nodes {
        id
        title
        subject
        date
        totalMarks
        classId
        classByClassId {
          name
          gradeLevel
        }
      }
    }
  }
`;

function TeacherExamsContent() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const { loading, data } = useQuery(GET_TEACHER_EXAMS);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || role !== 'teacher') {
            router.push('/login');
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    if (!user) return null;

    const exams = data?.allExams?.nodes || [];

    // Separate exams by status
    const now = new Date();
    const upcomingExams = exams
        .filter(exam => new Date(exam.date) > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const pastExams = exams
        .filter(exam => new Date(exam.date) <= now)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Exams & Assessments</h1>
                        <p className="text-gray-500 mt-1">View and track your scheduled exams</p>
                    </div>
                    <button
                        onClick={() => router.push('/teacher')}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-600 text-sm font-medium mb-1">Total Exams</p>
                            <p className="text-3xl font-bold text-blue-900">{exams.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-700" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-600 text-sm font-medium mb-1">Upcoming</p>
                            <p className="text-3xl font-bold text-green-900">{upcomingExams.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-green-700" />
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-sm"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-600 text-sm font-medium mb-1">Completed</p>
                            <p className="text-3xl font-bold text-purple-900">{pastExams.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                            <Award className="w-6 h-6 text-purple-700" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Upcoming Exams */}
            <div className="mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-green-100 rounded-lg text-green-600">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Upcoming Exams</h2>
                            <p className="text-sm text-gray-500">Scheduled assessments</p>
                        </div>
                    </div>

                    {upcomingExams.length > 0 ? (
                        <div className="space-y-3">
                            {upcomingExams.map((exam) => (
                                <div
                                    key={exam.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-green-200 transition-colors"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center text-white font-bold">
                                            {exam.subject.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{exam.title}</p>
                                            <div className="flex items-center space-x-3 mt-1">
                                                <span className="text-sm text-gray-500 flex items-center">
                                                    <BookOpen className="w-3.5 h-3.5 mr-1" />
                                                    {exam.subject}
                                                </span>
                                                <span className="text-sm text-gray-500 flex items-center">
                                                    <Users className="w-3.5 h-3.5 mr-1" />
                                                    {exam.classByClassId?.name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">
                                            {new Date(exam.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {new Date(exam.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                        </p>
                                        <p className="text-xs text-green-600 font-medium mt-1">
                                            {exam.totalMarks} marks
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No upcoming exams scheduled</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Past Exams */}
            <div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Past Exams</h2>
                            <p className="text-sm text-gray-500">Completed assessments</p>
                        </div>
                    </div>

                    {pastExams.length > 0 ? (
                        <div className="space-y-3">
                            {pastExams.map((exam) => (
                                <div
                                    key={exam.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-gray-300 to-gray-400 rounded-lg flex items-center justify-center text-white font-bold">
                                            {exam.subject.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{exam.title}</p>
                                            <div className="flex items-center space-x-3 mt-1">
                                                <span className="text-sm text-gray-500 flex items-center">
                                                    <BookOpen className="w-3.5 h-3.5 mr-1" />
                                                    {exam.subject}
                                                </span>
                                                <span className="text-sm text-gray-500 flex items-center">
                                                    <Users className="w-3.5 h-3.5 mr-1" />
                                                    {exam.classByClassId?.name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-gray-600">
                                            {new Date(exam.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(exam.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {exam.totalMarks} marks
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No past exams</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TeacherExamsPage() {
    return <TeacherExamsContent />;
}
