"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, gql } from '@apollo/client';
import {
    Calendar, CheckSquare, Upload, Camera, Loader2,
    Users, BookOpen, TrendingUp, Clock, ArrowRight,
    FileText, BarChart3, Bell, Award
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import AnnouncementCard from '@/components/AnnouncementCard';

const GET_TEACHER_DASHBOARD = gql`
  query GetTeacherDashboard {
    allClasses {
      nodes {
        id
        name
        gradeLevel
        studentsByClassId {
          totalCount
        }
      }
    }
    allExams {
      nodes {
        id
        title
        subject
        date
        classId
        classByClassId {
          name
        }
      }
    }
    allStudents {
      totalCount
    }
  }
`;

function TeacherDashboardContent() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const { loading, data } = useQuery(GET_TEACHER_DASHBOARD);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const role = localStorage.getItem('role');

        if (!storedUser || role !== 'teacher') {
            router.push('/login');
        } else {
            setUser(JSON.parse(storedUser));
        }
    }, [router]);

    const handleAiAttendance = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        setAiResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const uploadData = await uploadRes.json();

            if (!uploadData.success) {
                throw new Error('File upload failed');
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/ai/attendance`, {
                method: 'POST',
                body: JSON.stringify({
                    classId: 'mock-class-id',
                    imageUrl: uploadData.fileUrl
                }),
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();
            setAiResult(data);
        } catch (err) {
            console.error(err);
            toast.error('AI Processing Failed: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    if (!user) return null;

    const classes = data?.allClasses?.nodes || [];
    const allStudents = data?.allStudents?.totalCount || 0;
    const exams = data?.allExams?.nodes || [];

    // Get upcoming exams (next 30 days)
    const now = new Date();
    const upcomingExams = exams
        .filter(exam => new Date(exam.date) > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);

    // Mock today's schedule - in production, fetch from timetable
    const todaySchedule = [
        { class: classes[0]?.name || 'Mathematics (10-A)', time: '09:00 AM - 10:00 AM', status: 'completed' },
        { class: classes[1]?.name || 'Physics (11-B)', time: '11:00 AM - 12:00 PM', status: 'upcoming' },
        { class: classes[2]?.name || 'Chemistry (10-A)', time: '02:00 PM - 03:00 PM', status: 'upcoming' },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-8"
        >
            {/* Welcome Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome Back, {user.full_name}</h1>
                    <p className="text-gray-500 mt-1">Here's what's happening with your classes today</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => router.push('/teacher/attendance')}
                        className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        Mark Attendance
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <motion.div variants={itemVariants} className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-600 text-sm font-medium mb-1">My Classes</p>
                            <p className="text-3xl font-bold text-blue-900">{classes.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-blue-700" />
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-600 text-sm font-medium mb-1">Total Students</p>
                            <p className="text-3xl font-bold text-green-900">{allStudents}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                            <Users className="w-6 h-6 text-green-700" />
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-600 text-sm font-medium mb-1">Classes Today</p>
                            <p className="text-3xl font-bold text-purple-900">{todaySchedule.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-purple-700" />
                        </div>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-600 text-sm font-medium mb-1">Upcoming Exams</p>
                            <p className="text-3xl font-bold text-orange-900">{upcomingExams.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-orange-700" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Today's Schedule */}
                <motion.div variants={itemVariants} className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Today's Schedule</h2>
                                <p className="text-sm text-gray-500">Your classes for {new Date().toLocaleDateString('en-US', { weekday: 'long' })}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {todaySchedule.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-indigo-100 transition-colors">
                                <div className="flex items-center space-x-4">
                                    <div className={`w-1 h-12 rounded-full ${item.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                    <div>
                                        <p className="font-bold text-gray-800">{item.class}</p>
                                        <p className="text-sm text-gray-500">{item.time}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 ${item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} text-xs rounded-full font-medium`}>
                                    {item.status === 'completed' ? 'Completed' : 'Upcoming'}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* AI Auto-Attendance */}
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Camera className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">AI Attendance</h2>
                            <p className="text-xs text-gray-500">Upload class photo</p>
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors relative">
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleAiAttendance}
                            accept="image/*"
                            disabled={isUploading}
                        />
                        {isUploading ? (
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                                <p className="text-gray-600 font-medium text-sm">Analyzing...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                <p className="text-gray-600 font-medium text-sm">Upload Photo</p>
                                <p className="text-xs text-gray-400 mt-1">Click to browse</p>
                            </div>
                        )}
                    </div>

                    {aiResult && (
                        <div className="mt-4 bg-green-50 border border-green-100 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="font-bold text-green-800 text-sm">Success!</h3>
                                <span className="bg-green-200 text-green-800 text-xs px-2 py-1 rounded-full">
                                    {aiResult.detected_faces} Students
                                </span>
                            </div>
                            <p className="text-xs text-green-700">{aiResult.message}</p>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* My Classes */}
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">My Classes</h2>
                                <p className="text-sm text-gray-500">Classes you're teaching</p>
                            </div>
                        </div>
                        <button className="text-primary-600 text-sm font-medium hover:text-primary-700">
                            View All
                        </button>
                    </div>
                    <div className="space-y-3">
                        {classes.slice(0, 4).map((cls) => (
                            <div key={cls.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                onClick={() => router.push('/teacher/attendance')}
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
                                        {cls.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{cls.name}</p>
                                        <p className="text-xs text-gray-500">{cls.studentsByClassId.totalCount} students</p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-400" />
                            </div>
                        ))}
                        {classes.length === 0 && (
                            <p className="text-center text-gray-500 py-4">No classes assigned yet</p>
                        )}
                    </div>
                </motion.div>

                {/* Announcements */}
                <motion.div variants={itemVariants}>
                    <AnnouncementCard />
                </motion.div>
            </div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                    onClick={() => router.push('/teacher/attendance')}
                    className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 rounded-xl text-white cursor-pointer hover:shadow-lg transition-shadow"
                >
                    <CheckSquare className="w-8 h-8 mb-3" />
                    <h3 className="font-bold text-lg mb-1">Mark Attendance</h3>
                    <p className="text-sm text-primary-100">Track student presence</p>
                </div>
                <div
                    onClick={() => router.push('/teacher/exams')}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white cursor-pointer hover:shadow-lg transition-shadow"
                >
                    <FileText className="w-8 h-8 mb-3" />
                    <h3 className="font-bold text-lg mb-1">Exams</h3>
                    <p className="text-sm text-purple-100">View and manage exams</p>
                </div>
                <div
                    onClick={() => router.push('/profile')}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white cursor-pointer hover:shadow-lg transition-shadow"
                >
                    <BarChart3 className="w-8 h-8 mb-3" />
                    <h3 className="font-bold text-lg mb-1">My Profile</h3>
                    <p className="text-sm text-orange-100">View your information</p>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function TeacherPage() {
    return <TeacherDashboardContent />;
}
